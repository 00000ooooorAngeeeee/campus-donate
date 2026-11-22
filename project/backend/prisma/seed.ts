// 拾光 · 校园旧物捐赠平台 —— 种子数据
// 幂等：字典与学生/管理员用 upsert；Item 已存在时整体跳过，重复执行不会翻倍。
// 运行：npm run db:seed

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const now = Date.now()
const at = (days: number, hours = 0) => new Date(now + days * DAY + hours * HOUR)

/** 固定种子，保证每次生成的标题/数量一致 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261120)
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)]

/** 领取码字符集：去掉 O/0/I/1 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () =>
  Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)]).join('')

const categories = [
  { slug: 'books', name: '教材书籍', icon: 'book', weightPerUnitKg: 1.5, co2FactorPerKg: 1.2, sortOrder: 1 },
  { slug: 'clothes', name: '衣物鞋帽', icon: 'shirt', weightPerUnitKg: 0.5, co2FactorPerKg: 10, sortOrder: 2 },
  { slug: 'daily', name: '生活用品', icon: 'cup', weightPerUnitKg: 0.8, co2FactorPerKg: 3, sortOrder: 3 },
  { slug: 'appliance', name: '小家电与数码', icon: 'plug', weightPerUnitKg: 1.2, co2FactorPerKg: 25, sortOrder: 4 },
  { slug: 'stationery', name: '文具杂物', icon: 'pen', weightPerUnitKg: 0.2, co2FactorPerKg: 4, sortOrder: 5 },
  { slug: 'sports', name: '体育器材', icon: 'ball', weightPerUnitKg: 1.0, co2FactorPerKg: 6, sortOrder: 6 },
]

const stations = [
  {
    name: '一食堂西侧爱心驿站',
    address: '一食堂西门南侧 20 米，快递柜旁',
    openHours: '周一至周五 10:00-18:00',
    contactPhone: '0571-88880001',
  },
  {
    name: '三号宿舍楼下爱心驿站',
    address: '三号宿舍楼一层门厅东侧',
    openHours: '每日 09:00-21:00',
    contactPhone: '0571-88880002',
  },
]

const admins = [
  { studentNo: 'admin', name: '系统管理员', phone: null },
  { studentNo: 'admin02', name: '驿站管理员', phone: null },
]

const studentNames = [
  '陈嘉禾',
  '林书瑶',
  '周予安',
  '苏晓棠',
  '何一鸣',
  '郑星野',
  '梁清越',
  '许知遥',
  '唐未晞',
]
/** 第 10 个学生无任何记录，用于演示空状态 */
const emptyStudent = { studentNo: '2023010202', name: '沈叙白' }

const titles: Record<string, string[]> = {
  books: [
    '高等数学 第七版 上册',
    '线性代数 第六版',
    '大学物理 上册',
    '数据结构（C 语言版）',
    '计算机网络 自顶向下方法',
    '操作系统概念 第九版',
    '大学英语四级真题',
    '概率论与数理统计',
    '离散数学导论',
    '数字电路基础',
    '西方经济学 微观部分',
    '现代汉语词典 第 7 版',
    '建筑材料学',
    '马克思主义基本原理',
  ],
  clothes: [
    '优衣库摇粒绒外套',
    '藏青色连帽卫衣',
    '牛仔直筒裤',
    '加厚羽绒服',
    '帆布鞋 41 码',
    '羊毛围巾',
    '针织开衫',
    '运动短袖 T 恤',
    '三合一冲锋衣',
    '纯棉睡衣套装',
  ],
  daily: [
    '护眼台灯',
    '电热水壶',
    '折叠衣架 十只装',
    '收纳箱 60L',
    '陶瓷马克杯',
    '长柄雨伞',
    '床上四件套',
    '洗衣液 未开封',
    '保温饭盒',
    '免打孔置物架',
  ],
  appliance: [
    '罗技无线鼠标',
    '机械键盘 87 键',
    '蓝牙音箱',
    '小米充电宝 10000mAh',
    '负离子吹风机',
    '桌面小风扇',
    'USB-C 扩展坞',
    '电子体重秤',
    '函数计算器',
    '迷你加湿器',
  ],
  stationery: [
    '晨光中性笔 一盒',
    '康奈尔笔记本',
    '工程绘图工具套装',
    'A4 打印纸 500 张',
    '文件收纳袋',
    '荧光笔 六色',
    '订书机',
    '素描本 A4',
    '便利贴套装',
    '桌面文件架',
  ],
  sports: [
    '羽毛球拍 对装',
    '瑜伽垫 加厚',
    '跳绳 计数款',
    '篮球 7 号',
    '哑铃 5kg 一对',
    '乒乓球拍 双面反胶',
    '运动护膝',
    '运动水壶 1L',
    '弹力带 五档',
    '泳镜 防雾',
  ],
}

const descSuffix: Record<string, string> = {
  books: '书页完整无缺页，少量铅笔笔记，可自取。',
  clothes: '已清洗晾晒，无破损无污渍，尺码合适再约。',
  daily: '功能正常，使用痕迹轻微，附件齐全。',
  appliance: '功能正常，配件齐全，已充满电试机。',
  stationery: '全新或仅拆封，数量如题，打包一起领。',
  sports: '使用次数不多，握把完好，可现场验货。',
}

const conditions = ['NEW', 'GOOD', 'USABLE']

const statusPlan: string[] = [
  ...Array(5).fill('PENDING'),
  ...Array(3).fill('REJECTED'),
  ...Array(4).fill('RECEIVING'),
  ...Array(60).fill('ON_SHELF'),
  ...Array(5).fill('OFFLINE'),
  ...Array(3).fill('CLOSED'),
]
// 打散状态顺序，让编号与状态分布自然交错
for (let i = statusPlan.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1))
  ;[statusPlan[i], statusPlan[j]] = [statusPlan[j], statusPlan[i]]
}

const rejectReasons = [
  '图片不清晰，请重新上传实物照片',
  '描述过于简单，请补充品牌与使用情况',
  '疑似非闲置物品，请确认后重新提交',
]

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10)
  const studentHash = await bcrypt.hash('123456', 10)

  // 字典：品类
  const categoryIdBySlug = new Map<string, number>()
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, weightPerUnitKg: c.weightPerUnitKg, co2FactorPerKg: c.co2FactorPerKg, sortOrder: c.sortOrder },
      create: c,
    })
    categoryIdBySlug.set(c.slug, row.id)
  }

  // 字典：驿站（name 非唯一，先查后建）
  const stationIds: number[] = []
  for (const s of stations) {
    const found = await prisma.station.findFirst({ where: { name: s.name } })
    const row = found ?? (await prisma.station.create({ data: s }))
    stationIds.push(row.id)
  }

  // 用户
  const adminIds: number[] = []
  for (const a of admins) {
    const row = await prisma.user.upsert({
      where: { studentNo: a.studentNo },
      update: { name: a.name, role: 'ADMIN', passwordHash: adminHash },
      create: { ...a, role: 'ADMIN', passwordHash: adminHash },
    })
    adminIds.push(row.id)
  }

  const studentIds: number[] = []
  for (const [i, name] of studentNames.entries()) {
    const studentNo = String(2022010101 + i)
    const row = await prisma.user.upsert({
      where: { studentNo },
      update: { name, role: 'STUDENT', passwordHash: studentHash },
      create: { studentNo, name, role: 'STUDENT', passwordHash: studentHash, building: `${(i % 6) + 1} 号楼` },
    })
    studentIds.push(row.id)
  }
  await prisma.user.upsert({
    where: { studentNo: emptyStudent.studentNo },
    update: { name: emptyStudent.name, role: 'STUDENT', passwordHash: studentHash },
    create: { ...emptyStudent, role: 'STUDENT', passwordHash: studentHash },
  })

  // 配置
  const configs = [
    { key: 'reservation.ttlDays', value: '3', description: '预约有效期（天）' },
    { key: 'reservation.maxPending', value: '2', description: '单个学生同时未领取上限' },
  ]
  for (const c of configs) {
    await prisma.systemConfig.upsert({ where: { key: c.key }, update: { value: c.value, description: c.description }, create: c })
  }

  // 物品与流水已存在则跳过，保证幂等
  const itemCount = await prisma.item.count()
  if (itemCount > 0) {
    console.log(`已存在 ${itemCount} 个批次，跳过物品与预约生成（字典与账号已对齐）`)
    return
  }

  const admin = adminIds[0]
  const slugs = categories.map((c) => c.slug)
  const created: { id: number; status: string; totalQty: number; shelfAt: Date }[] = []

  for (const [i, status] of statusPlan.entries()) {
    const slug = slugs[i % slugs.length]
    const pool = titles[slug]
    const donorId = studentIds[i % studentIds.length]
    // 提交时间从 90 天前均匀铺到 11 天前，收货/上架依次后移，保证全部落在过去
    const submittedAt = at(-(90 - i), -int(0, 8))
    const receivedAt = at(-(88 - i), 2)
    const shelfAt = at(-(86 - i), 4)
    const totalQty = status === 'CLOSED' ? int(1, 3) : int(2, 5)
    const condition = pick(conditions)
    const received = ['ON_SHELF', 'OFFLINE', 'CLOSED'].includes(status)

    const item = await prisma.item.create({
      data: {
        title: `${pool[i % pool.length]}${status === 'PENDING' ? '（待审核）' : ''}`,
        description: `${descSuffix[slug]}毕业季整理宿舍出清，共 ${totalQty} 件。`,
        categoryId: categoryIdBySlug.get(slug)!,
        stationId: stationIds[i % stationIds.length],
        condition,
        totalQty,
        status,
        donorId,
        submittedAt,
        rejectReason: status === 'REJECTED' ? rejectReasons[i % rejectReasons.length] : null,
        receivedAt: received ? receivedAt : null,
        shelfAt: received ? shelfAt : null,
        closedAt: status === 'CLOSED' ? new Date(shelfAt.getTime() + 3 * DAY) : null,
        code: received
          ? `SR-2026-${String(created.filter((c) => ['ON_SHELF', 'OFFLINE', 'CLOSED'].includes(c.status)).length + 1).padStart(4, '0')}`
          : null,
      },
    })
    created.push({ id: item.id, status, totalQty, shelfAt })

    // 每条批次至少一条日志；通过审核的补齐链路
    // 显式标注可空字段，避免数组字面量把 fromStatus/note 推断成 null 只读类型
    const logs: { action: string; fromStatus: string | null; toStatus: string; createdAt: Date; note: string | null }[] = [
      { action: 'SUBMIT', fromStatus: null, toStatus: 'PENDING', createdAt: submittedAt, note: null },
    ]
    if (status === 'REJECTED') {
      logs.push({ action: 'REJECT', fromStatus: 'PENDING', toStatus: 'REJECTED', createdAt: new Date(submittedAt.getTime() + DAY), note: item.rejectReason })
    }
    if (['RECEIVING', 'ON_SHELF', 'OFFLINE', 'CLOSED'].includes(status)) {
      logs.push({ action: 'APPROVE', fromStatus: 'PENDING', toStatus: 'RECEIVING', createdAt: new Date(submittedAt.getTime() + DAY), note: null })
    }
    if (received) {
      logs.push({ action: 'RECEIVE', fromStatus: 'RECEIVING', toStatus: 'ON_SHELF', createdAt: receivedAt, note: null })
    }
    if (status === 'OFFLINE') {
      logs.push({ action: 'OFFLINE', fromStatus: 'ON_SHELF', toStatus: 'OFFLINE', createdAt: new Date(shelfAt.getTime() + 5 * DAY), note: '超过 30 天未领取，统一下架' })
    }

    for (const l of logs) {
      await prisma.itemLog.create({
        data: {
          itemId: item.id,
          scope: 'BATCH',
          action: l.action,
          qty: l.action === 'SUBMIT' || l.action === 'RECEIVE' ? totalQty : null,
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          operatorId: l.action === 'SUBMIT' ? donorId : admin,
          note: l.note,
          createdAt: l.createdAt,
        },
      })
    }
  }

  const shelfItems = created.filter((c) => c.status === 'ON_SHELF')
  const closedItems = created.filter((c) => c.status === 'CLOSED')
  let shelfCursor = 0

  /** 写一条预约 + RESERVE 日志，并把占用落到批次上 */
  async function reserve(opts: {
    itemId: number
    userId: number
    status: string
    qty: number
    createdAt: Date
    expireAt: Date
    collectedAt?: Date
    cancelledAt?: Date
    cancelReason?: string
  }) {
    const r = await prisma.reservation.create({
      data: {
        code: makeCode(),
        itemId: opts.itemId,
        userId: opts.userId,
        qty: opts.qty,
        status: opts.status,
        createdAt: opts.createdAt,
        expireAt: opts.expireAt,
        collectedAt: opts.collectedAt ?? null,
        collectedBy: opts.collectedAt ? admin : null,
        cancelledAt: opts.cancelledAt ?? null,
        cancelReason: opts.cancelReason ?? null,
      },
    })
    await prisma.itemLog.create({
      data: {
        itemId: opts.itemId,
        reservationId: r.id,
        scope: 'RESERVATION',
        action: 'RESERVE',
        qty: opts.qty,
        fromStatus: 'ON_SHELF',
        toStatus: 'ON_SHELF',
        operatorId: opts.userId,
        createdAt: opts.createdAt,
      },
    })
    return r
  }

  // 已完结批次：一条完整链路，collectedQty === totalQty
  for (const c of closedItems) {
    const userId = studentIds[closedItems.indexOf(c) % studentIds.length]
    const closedAt = new Date(c.shelfAt.getTime() + 3 * DAY)
    const collectedAt = new Date(closedAt.getTime() - DAY)
    const reservedAt = new Date(closedAt.getTime() - 2 * DAY)
    const r = await reserve({
      itemId: c.id,
      userId,
      status: 'COLLECTED',
      qty: c.totalQty,
      createdAt: reservedAt,
      expireAt: new Date(reservedAt.getTime() + 3 * DAY),
      collectedAt,
    })
    await prisma.item.update({ where: { id: c.id }, data: { collectedQty: c.totalQty, closedAt } })
    await prisma.itemLog.create({
      data: {
        itemId: c.id,
        reservationId: r.id,
        scope: 'RESERVATION',
        action: 'COLLECT',
        qty: c.totalQty,
        fromStatus: 'PENDING',
        toStatus: 'COLLECTED',
        operatorId: admin,
        createdAt: collectedAt,
      },
    })
    await prisma.itemLog.create({
      data: {
        itemId: c.id,
        scope: 'BATCH',
        action: 'CLOSE',
        qty: c.totalQty,
        fromStatus: 'ON_SHELF',
        toStatus: 'CLOSED',
        operatorId: admin,
        createdAt: closedAt,
      },
    })
  }

  // 18 条待领取：每个在册学生 2 条；含 3 条已超时、2 条 24 小时内到期
  for (let i = 0; i < 18; i++) {
    const c = shelfItems[shelfCursor++]
    const userId = studentIds[i % studentIds.length]
    const kind = i < 3 ? 'expired' : i < 5 ? 'soon' : 'normal'
    const createdAt = kind === 'expired' ? at(-5) : kind === 'soon' ? at(-2, 12) : at(-1, -i)
    const expireAt =
      kind === 'expired' ? at(-2) : kind === 'soon' ? at(0, 12 + i) : at(int(1, 2), i)

    await reserve({ itemId: c.id, userId, status: 'PENDING', qty: 1, createdAt, expireAt })
    await prisma.item.update({ where: { id: c.id }, data: { reservedQty: 1 } })
  }

  // 2 条在架批次上的已核销
  for (let i = 0; i < 2; i++) {
    const c = shelfItems[shelfCursor++]
    const userId = studentIds[(i + 5) % studentIds.length]
    const r = await reserve({
      itemId: c.id,
      userId,
      status: 'COLLECTED',
      qty: 1,
      createdAt: at(-6),
      expireAt: at(-3),
      collectedAt: at(-4),
    })
    await prisma.item.update({ where: { id: c.id }, data: { collectedQty: 1 } })
    await prisma.itemLog.create({
      data: {
        itemId: c.id,
        reservationId: r.id,
        scope: 'RESERVATION',
        action: 'COLLECT',
        qty: 1,
        fromStatus: 'PENDING',
        toStatus: 'COLLECTED',
        operatorId: admin,
        createdAt: at(-4),
      },
    })
  }

  // 7 条已取消（不占余量，用于状态覆盖）
  for (let i = 0; i < 7; i++) {
    const c = shelfItems[shelfCursor++]
    const userId = studentIds[i % studentIds.length]
    const r = await reserve({
      itemId: c.id,
      userId,
      status: 'CANCELLED',
      qty: 1,
      createdAt: at(-6, i),
      expireAt: at(-3, i),
      cancelledAt: at(-5, i),
      cancelReason: '学生取消',
    })
    await prisma.itemLog.create({
      data: {
        itemId: c.id,
        reservationId: r.id,
        scope: 'RESERVATION',
        action: 'CANCEL',
        qty: 1,
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        operatorId: userId,
        createdAt: at(-5, i),
      },
    })
  }

  console.log(
    `种子完成：${created.length} 个批次 / ${await prisma.reservation.count()} 条预约 / ${await prisma.itemLog.count()} 条日志`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
