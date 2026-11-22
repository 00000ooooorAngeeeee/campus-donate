// 管理端路由（挂载于 /api/admin，整体 requireRole('ADMIN')）：
//   S3-09  GET  /items                       列表（按状态分组计数）
//          POST /items/:id/approve           审核通过   PENDING → RECEIVING
//          POST /items/:id/reject            驳回/退回  PENDING|RECEIVING → REJECTED
//          POST /items/:id/receive           收货确认   RECEIVING → ON_SHELF（可修正数量）
//          POST /items/:id/offline           下架       ON_SHELF → OFFLINE（3006 校验）
//   S3-10  POST /reservations/redeem         凭码核销（整单，先惰性超时扫描）
//          GET  /reservations/today          今日待领取 + 当日核销记录 + 汇总（聚合策略）
import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { BizError, ERR } from '../lib/errors'
import { ok } from '../lib/response'
import { rejectSchema, receiveSchema, redeemSchema, adminItemsQuerySchema } from '../lib/schema'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/role'
import { validate } from '../middleware/validate'
import { sweepExpired } from '../lib/expire'
import { CONFIG_KEYS, getConfigInt } from '../lib/config'

const router = Router()
// 先解析 token 再校验角色：漏掉 requireAuth 时 req.user 恒为空，所有人都会被 1002 拦截
router.use(requireAuth, requireRole('ADMIN'))

const DAY = 24 * 60 * 60 * 1000

/** MM-DD HH:mm，用于错误文案里的时间（如重复核销提示） */
function fmtShort(d: Date | null | undefined): string {
  if (!d) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 解析 Item.imagesJson；脏数据时不让整页 500 */
function parseImages(json: string): string[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------- S3-09 列表

router.get('/items', validate({ query: adminItemsQuerySchema }), async (req, res, next) => {
  try {
    const { status, keyword, categoryId, page, size } = req.query as unknown as {
      status: string
      keyword?: string
      categoryId?: number
      page: number
      size: number
    }

    // 角标计数：一次 groupBy 拿全部状态的数量，前端 Tab 直接渲染
    const grouped = await prisma.item.groupBy({ by: ['status'], _count: { _all: true } })
    const counts: Record<string, number> = {}
    for (const g of grouped) counts[g.status] = g._count._all

    const where: {
      status: string
      categoryId?: number
      OR?: Array<{ title: { contains: string } } | { code: { contains: string } }>
    } = { status }
    if (categoryId) where.categoryId = categoryId
    if (keyword) {
      // 原型 06：搜索"物品标题或入库编号"
      where.OR = [{ title: { contains: keyword } }, { code: { contains: keyword } }]
    }

    const [total, rows, categories] = await Promise.all([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy: { submittedAt: 'asc' }, // 先到先审：升序，与用户端倒序刻意相反
        skip: (page - 1) * size,
        take: size,
        include: {
          category: { select: { name: true } },
          station: { select: { name: true } },
          donor: { select: { name: true, studentNo: true } },
        },
      }),
      // 品类下拉直接随列表接口返回（"一个接口返回一个页面所需数据"的聚合策略）
      prisma.category.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
    ])

    // 待收货 Tab 需要展示"审核通过"时间：批量取本页物品最近一条 APPROVE 日志
    const ids = rows.map((r) => r.id)
    const approveLogs = ids.length
      ? await prisma.itemLog.findMany({
          where: { itemId: { in: ids }, action: 'APPROVE' },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const approveAtMap = new Map<number, Date>()
    for (const log of approveLogs) {
      if (!approveAtMap.has(log.itemId)) approveAtMap.set(log.itemId, log.createdAt)
    }

    res.json(
      ok({
        list: rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          code: r.code,
          condition: r.condition,
          status: r.status,
          totalQty: r.totalQty,
          available: r.totalQty - r.reservedQty - r.collectedQty,
          rejectReason: r.rejectReason,
          images: parseImages(r.imagesJson),
          submittedAt: r.submittedAt,
          receivedAt: r.receivedAt,
          shelfAt: r.shelfAt,
          approvedAt: approveAtMap.get(r.id) ?? null,
          categoryName: r.category.name,
          stationName: r.station.name,
          donorName: r.donor.name,
          donorStudentNo: r.donor.studentNo,
        })),
        total,
        page,
        size,
        counts,
        categories,
      }),
    )
  } catch (e) {
    next(e)
  }
})

/** 取批次并在事务外做状态前置校验，减少重复代码 */
async function getItemOr404(id: number) {
  const item = await prisma.item.findUnique({ where: { id } })
  if (!item) throw new BizError(ERR.NOT_FOUND, '物品不存在')
  return item
}

// ------------------------------------------------------- S3-09 状态流转接口

// 审核通过：PENDING → RECEIVING。审核通过 ≠ 入库（BR-02），必须再经收货确认
router.post('/items/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const item = await getItemOr404(id)
    if (item.status !== 'PENDING') {
      throw new BizError(ERR.BAD_STATE, '仅待审核的批次可通过审核')
    }
    const adminId = req.user!.id
    // 条件更新兜底并发：状态在事务外校验过，但事务内仍需以 where 保证只流转一次
    await prisma.$transaction(async (tx) => {
      const moved = await tx.item.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'RECEIVING' },
      })
      if (moved.count === 0) throw new BizError(ERR.BAD_STATE, '批次状态已变化，请刷新后重试')
      await tx.itemLog.create({
        data: {
          itemId: id,
          scope: 'BATCH',
          action: 'APPROVE',
          fromStatus: 'PENDING',
          toStatus: 'RECEIVING',
          operatorId: adminId,
        },
      })
    })
    res.json(ok({ id, status: 'RECEIVING' }))
  } catch (e) {
    next(e)
  }
})

// 驳回（待审核）/ 退回（待收货，实物与申报严重不符）：同一接口承载两种动作，
// 语义差异在文案与日志 note 中体现（原型 06 交互说明最后一条）
router.post('/items/:id/reject', validate({ body: rejectSchema }), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { reason } = req.body
    const item = await getItemOr404(id)
    if (item.status !== 'PENDING' && item.status !== 'RECEIVING') {
      throw new BizError(ERR.BAD_STATE, '仅待审核或待收货的批次可驳回/退回')
    }
    const isReturn = item.status === 'RECEIVING'
    const adminId = req.user!.id
    await prisma.$transaction(async (tx) => {
      const moved = await tx.item.updateMany({
        where: { id, status: { in: ['PENDING', 'RECEIVING'] } },
        data: { status: 'REJECTED', rejectReason: reason },
      })
      if (moved.count === 0) throw new BizError(ERR.BAD_STATE, '批次状态已变化，请刷新后重试')
      await tx.itemLog.create({
        data: {
          itemId: id,
          scope: 'BATCH',
          action: 'REJECT',
          fromStatus: item.status,
          toStatus: 'REJECTED',
          operatorId: adminId,
          note: isReturn ? `退回：${reason}` : reason,
        },
      })
    })
    res.json(ok({ id, status: 'REJECTED' }))
  } catch (e) {
    next(e)
  }
})

// 收货确认：RECEIVING → ON_SHELF，可修正实际数量并强制留痕（BR-07），
// 生成入库编号 SR-YYYY-NNNN
router.post('/items/:id/receive', validate({ body: receiveSchema }), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { actualQty } = req.body
    const item = await getItemOr404(id)
    if (item.status !== 'RECEIVING') {
      throw new BizError(ERR.BAD_STATE, '仅待收货的批次可确认入库')
    }

    // 入库编号：同年已有编号数 + 1。单人管理端场景，冲突概率可忽略
    const year = new Date().getFullYear()
    const prefix = `SR-${year}-`
    const existed = await prisma.item.count({ where: { code: { startsWith: prefix } } })
    const code = `${prefix}${String(existed + 1).padStart(4, '0')}`

    const adminId = req.user!.id
    const adjusted = actualQty !== item.totalQty
    await prisma.$transaction(async (tx) => {
      // 条件更新：防止双击/并发导致同一批次被重复收货、生成两个入库编号
      const moved = await tx.item.updateMany({
        where: { id, status: 'RECEIVING' },
        data: {
          totalQty: actualQty,
          status: 'ON_SHELF',
          code,
          receivedAt: new Date(),
          shelfAt: new Date(),
        },
      })
      if (moved.count === 0) throw new BizError(ERR.BAD_STATE, '批次状态已变化，请刷新后重试')
      // 数量修正必须留痕，不做静默修改（原型 06 交互说明第 4 条）
      if (adjusted) {
        await tx.itemLog.create({
          data: {
            itemId: id,
            scope: 'BATCH',
            action: 'QTY_ADJUST',
            qty: actualQty,
            fromStatus: 'RECEIVING',
            toStatus: 'RECEIVING',
            operatorId: adminId,
            note: `申报 ${item.totalQty} 件，实收 ${actualQty} 件`,
          },
        })
      }
      await tx.itemLog.create({
        data: {
          itemId: id,
          scope: 'BATCH',
          action: 'RECEIVE',
          qty: actualQty,
          fromStatus: 'RECEIVING',
          toStatus: 'ON_SHELF',
          operatorId: adminId,
        },
      })
    })
    res.json(ok({ id, status: 'ON_SHELF', totalQty: actualQty, code, adjusted }))
  } catch (e) {
    next(e)
  }
})

// 下架：ON_SHELF → OFFLINE。存在未核销预约时禁止（BR-05 / E-05）
router.post('/items/:id/offline', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const item = await getItemOr404(id)
    if (item.status !== 'ON_SHELF') {
      throw new BizError(ERR.BAD_STATE, '仅在架批次可下架')
    }
    // 先做本批次范围的惰性超时回收，避免已过期单"虚占"导致误拦
    await sweepExpired('item', id)
    const pending = await prisma.reservation.count({ where: { itemId: id, status: 'PENDING' } })
    if (pending > 0) {
      throw new BizError(ERR.OFFLINE_BLOCKED, `有 ${pending} 个预约未领取，需先取消后才能下架`)
    }
    const adminId = req.user!.id
    await prisma.$transaction(async (tx) => {
      const moved = await tx.item.updateMany({
        where: { id, status: 'ON_SHELF' },
        data: { status: 'OFFLINE' },
      })
      if (moved.count === 0) throw new BizError(ERR.BAD_STATE, '批次状态已变化，请刷新后重试')
      await tx.itemLog.create({
        data: {
          itemId: id,
          scope: 'BATCH',
          action: 'OFFLINE',
          fromStatus: 'ON_SHELF',
          toStatus: 'OFFLINE',
          operatorId: adminId,
        },
      })
    })
    res.json(ok({ id, status: 'OFFLINE' }))
  } catch (e) {
    next(e)
  }
})

// ------------------------------------------------------------ S3-10 核销台

// 凭码核销：先惰性扫描再校验，杜绝"先核销成功、事后发现过期"的错乱（原型 07 红字提示）
router.post(
  '/reservations/redeem',
  validate({ body: redeemSchema }),
  async (req, res, next) => {
    try {
      const { code } = req.body
      const adminId = req.user!.id

      const r0 = await prisma.reservation.findUnique({
        where: { code },
        include: { collector: { select: { studentNo: true } } },
      })
      if (!r0) throw new BizError(ERR.NOT_FOUND, '领取码不存在，请核对后重试')

      // 核销前的超时扫描（架构文档 §4.3 三个入口之一）
      await sweepExpired('item', r0.itemId)
      const r = await prisma.reservation.findUnique({
        where: { code },
        include: { item: true, user: { select: { name: true, studentNo: true } }, collector: { select: { studentNo: true } } },
      })
      if (!r) throw new BizError(ERR.NOT_FOUND, '领取码不存在，请核对后重试')

      // 四类失败的判定顺序见 S3-10：已核销 → 已超时 → 已取消 → 批次状态
      if (r.status === 'COLLECTED') {
        throw new BizError(
          ERR.DUPLICATE_REDEEM,
          `该单已于 ${fmtShort(r.collectedAt)} 由 ${r.collector?.studentNo ?? '管理员'} 核销，请勿重复操作`,
        )
      }
      if (r.status === 'EXPIRED') {
        const ttlDays = await getConfigInt(CONFIG_KEYS.ttlDays, 3)
        throw new BizError(
          ERR.RESERVATION_EXPIRED,
          `该预约已超过 ${ttlDays} 天有效期，${r.qty} 件数量已自动释放`,
        )
      }
      if (r.status === 'CANCELLED') {
        throw new BizError(
          ERR.BAD_STATE,
          `该预约由领取人于 ${fmtShort(r.cancelledAt)} 主动取消`,
        )
      }
      if (r.item.status !== 'ON_SHELF') {
        throw new BizError(ERR.BAD_STATE, '物品当前不在架（已下架或已完结），无法核销')
      }

      const collectedAt = new Date()
      const itemClosed = r.item.collectedQty + r.qty >= r.item.totalQty

      await prisma.$transaction(async (tx) => {
        // 事务内条件更新：两名管理员同时核销同一单时，只有一次能成功扣减账目
        const moved = await tx.reservation.updateMany({
          where: { id: r.id, status: 'PENDING' },
          data: { status: 'COLLECTED', collectedAt, collectedBy: adminId },
        })
        if (moved.count === 0) {
          throw new BizError(ERR.DUPLICATE_REDEEM, '该预约刚刚已被处理，请勿重复操作')
        }
        await tx.item.update({
          where: { id: r.itemId },
          data: {
            reservedQty: { decrement: r.qty },
            collectedQty: { increment: r.qty },
          },
        })
        // 最后一件核销完 → 批次完结（R3），发现页不再展示
        if (itemClosed) {
          await tx.item.update({
            where: { id: r.itemId },
            data: { status: 'CLOSED', closedAt: collectedAt },
          })
          await tx.itemLog.create({
            data: {
              itemId: r.itemId,
              scope: 'BATCH',
              action: 'CLOSE',
              qty: r.item.totalQty,
              fromStatus: 'ON_SHELF',
              toStatus: 'CLOSED',
              operatorId: adminId,
              createdAt: collectedAt,
            },
          })
        }
        await tx.itemLog.create({
          data: {
            itemId: r.itemId,
            reservationId: r.id,
            scope: 'RESERVATION',
            action: 'COLLECT',
            qty: r.qty,
            fromStatus: 'PENDING',
            toStatus: 'COLLECTED',
            operatorId: adminId,
            createdAt: collectedAt,
          },
        })
      })

      const remaining = r.item.totalQty - (r.item.reservedQty - r.qty) - (r.item.collectedQty + r.qty)
      res.json(
        ok({
          itemTitle: r.item.title,
          qty: r.qty,
          collectedAt: collectedAt.toISOString(),
          itemClosed,
          remaining,
          receiverName: r.user.name,
          receiverStudentNo: r.user.studentNo,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

// 今日待领取 + 当日核销记录：聚合策略，一次返回核销台右侧全部数据
router.get('/reservations/today', async (_req, res, next) => {
  try {
    // 全量惰性回收：过期单不该出现在"今日待领取"里
    await sweepExpired('all')

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [pending, redeemedToday, station] = await Promise.all([
      prisma.reservation.findMany({
        where: { status: 'PENDING' },
        orderBy: { expireAt: 'asc' }, // 快过期的排最前
        include: {
          item: { select: { title: true } },
          user: { select: { name: true, studentNo: true } },
        },
      }),
      prisma.reservation.findMany({
        where: { status: 'COLLECTED', collectedAt: { gte: startOfToday } },
        orderBy: { collectedAt: 'desc' },
        include: {
          item: { select: { title: true } },
          collector: { select: { studentNo: true } },
        },
      }),
      // 顶栏驿站信息：取第一个启用中的驿站
      prisma.station.findFirst({ where: { active: true }, orderBy: { id: 'asc' } }),
    ])

    res.json(
      ok({
        pending: pending.map((r) => ({
          code: r.code,
          itemTitle: r.item.title,
          qty: r.qty,
          expireAt: r.expireAt,
          receiverName: r.user.name,
          receiverStudentNo: r.user.studentNo,
        })),
        redeemedToday: redeemedToday.map((r) => ({
          code: r.code,
          itemTitle: r.item.title,
          qty: r.qty,
          collectedAt: r.collectedAt,
          operatorNo: r.collector?.studentNo ?? '-',
        })),
        stats: {
          orders: redeemedToday.length,
          pieces: redeemedToday.reduce((s, r) => s + r.qty, 0),
        },
        station: station ? { name: station.name, openHours: station.openHours } : null,
      }),
    )
  } catch (e) {
    next(e)
  }
})

export default router
