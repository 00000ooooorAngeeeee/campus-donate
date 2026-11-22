// SystemConfig 读取：3 天有效期 / 2 个未领取上限等业务参数不写死在代码里，
// 缺失或值非法时用兜底默认值，保证行为永远可预期
import { prisma } from './prisma'

export const CONFIG_KEYS = {
  /** 预约有效期（天） */
  ttlDays: 'reservation.ttlDays',
  /** 单个学生同时持有的未领取预约上限（按单计数） */
  maxPending: 'reservation.maxPending',
} as const

export async function getConfigInt(key: string, fallback: number): Promise<number> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } })
    if (!row) return fallback
    const n = Number.parseInt(row.value, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    // 配置表异常不应拖垮业务，直接走默认值
    return fallback
  }
}
