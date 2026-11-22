// 预约内核：占用（条件更新防超卖）与取消。
// 关键约束：占用必须是单语句原子条件更新，禁止"先查余量再改"（架构文档 §4.2）；
// 任何涉及 reservedQty 的写操作都在同一事务内完成（§5）。
import { Router } from 'express'
import { randomInt } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { BizError, ERR } from '../lib/errors'
import { ok } from '../lib/response'
import { reserveSchema } from '../lib/schema'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/role'
import { validate } from '../middleware/validate'
import { sweepExpired } from '../lib/expire'
import { CODE_CHARS } from '../lib/constants'
import { CONFIG_KEYS, getConfigInt } from '../lib/config'

const router = Router()

/** 生成 8 位领取码：剔除易混字符，先查重再落库，冲突概率极低但仍循环兜底 */
async function generateCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
    const exists = await prisma.reservation.findUnique({ where: { code } })
    if (!exists) return code
  }
  // 连续 8 次撞码在当前量级下不可能发生，仅为类型完备性兜底
  throw new BizError(ERR.INTERNAL, '领取码生成失败，请重试')
}

// 创建预约（挂载于 /api → 实际路径 POST /api/items/:id/reservations）
// 权限矩阵：预约仅学生可操作（管理员 ❌）
router.post(
  '/items/:id/reservations',
  requireAuth,
  requireRole('STUDENT'),
  validate({ body: reserveSchema }),
  async (req, res, next) => {
    try {
      const itemId = Number(req.params.id)
      const { qty } = req.body
      const userId = req.user!.id

      // 先做一次本人范围的惰性超时回收，避免过期单占用"2 个未领取"名额
      await sweepExpired('user', userId)

      const item = await prisma.item.findUnique({ where: { id: itemId } })
      if (!item) throw new BizError(ERR.NOT_FOUND, '物品不存在或已下架')

      // 校验顺序见 S3-06：上限 → 状态 → 条件更新
      const maxPending = await getConfigInt(CONFIG_KEYS.maxPending, 2)
      const pendingCount = await prisma.reservation.count({
        where: { userId, status: 'PENDING' },
      })
      if (pendingCount >= maxPending) {
        throw new BizError(
          ERR.PENDING_OVERFLOW,
          `最多同时持有 ${maxPending} 个未领取预约，请先到「我的记录」领取或取消`,
        )
      }
      if (item.status !== 'ON_SHELF') {
        throw new BizError(ERR.BAD_STATE, '物品当前不在架，无法预约')
      }

      const ttlDays = await getConfigInt(CONFIG_KEYS.ttlDays, 3)
      const expireAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
      const code = await generateCode()

      await prisma.$transaction(async (tx) => {
        // 原子条件更新：判断与写入合并为一条语句，影响行数为 1 才算占用成功
        const affected = await tx.$executeRaw`
          UPDATE Item
             SET reservedQty = reservedQty + ${qty}
           WHERE id = ${itemId}
             AND status = 'ON_SHELF'
             AND (totalQty - reservedQty - collectedQty) >= ${qty}
        `
        if (affected === 0) {
          throw new BizError(ERR.INSUFFICIENT, '余量不足，该物品可能刚被他人预约')
        }
        await tx.reservation.create({
          data: { code, itemId, userId, qty, status: 'PENDING', expireAt },
        })
        await tx.itemLog.create({
          data: {
            itemId,
            scope: 'RESERVATION',
            action: 'RESERVE',
            qty,
            fromStatus: 'ON_SHELF',
            toStatus: 'ON_SHELF',
            operatorId: userId,
          },
        })
      })

      // 事务已提交，重读派生余量返回（服务端为唯一真相）
      const fresh = await prisma.item.findUniqueOrThrow({ where: { id: itemId } })
      const available = fresh.totalQty - fresh.reservedQty - fresh.collectedQty
      const created = await prisma.reservation.findUniqueOrThrow({ where: { code } })
      res.json(
        ok({
          reservationId: created.id,
          code,
          qty,
          expireAt: expireAt.toISOString(),
          available,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

// 取消预约（实际路径 POST /api/reservations/:id/cancel）：整单取消，不支持部分取消
router.post(
  '/reservations/:id/cancel',
  requireAuth,
  requireRole('STUDENT'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id)
      const userId = req.user!.id

      // 先回收本人过期单：过期后取消入口应提示"已超时"而不是"不能取消"
      await sweepExpired('user', userId)

      const r = await prisma.reservation.findUnique({ where: { id } })
      if (!r) throw new BizError(ERR.NOT_FOUND, '预约不存在')

      // 越权校验：只能取消本人的预约（S4-03 重点核对项）
      if (r.userId !== userId) throw new BizError(ERR.FORBIDDEN, '只能取消本人的预约')

      if (r.status === 'EXPIRED') {
        throw new BizError(ERR.RESERVATION_EXPIRED, `该预约已超过有效期，${r.qty} 件数量已自动释放`)
      }
      if (r.status !== 'PENDING') {
        throw new BizError(ERR.BAD_STATE, '仅待领取的预约可以取消')
      }

      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: '学生取消' },
        }),
        prisma.item.update({
          where: { id: r.itemId },
          data: { reservedQty: { decrement: r.qty } },
        }),
        prisma.itemLog.create({
          data: {
            itemId: r.itemId,
            reservationId: id,
            scope: 'RESERVATION',
            action: 'CANCEL',
            qty: r.qty,
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
            operatorId: userId,
          },
        }),
      ])
      res.json(ok({ id, status: 'CANCELLED' }))
    } catch (e) {
      next(e)
    }
  },
)

export default router
