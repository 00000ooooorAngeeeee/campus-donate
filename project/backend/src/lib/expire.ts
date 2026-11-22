// 惰性超时回收：不跑定时任务（进程重启会漏跑、答辩现场不可复现），
// 只在「读我的预约 / 读物品详情 / 核销前」三个入口各扫一次。
// 扫描范围限定在当前用户或当前批次，代价是一次小查询。
import { prisma } from './prisma'

export type SweepScope = 'user' | 'item' | 'all'

/**
 * 把 now > expireAt 且 status = PENDING 的预约置为 EXPIRED，
 * 归还 reservedQty，并逐条写 ItemLog(EXPIRE)。
 * 幂等：已是 EXPIRED 的不会再次命中。
 */
export async function sweepExpired(scope: SweepScope, ref?: number): Promise<number> {
  const where: {
    status: string
    expireAt: { lt: Date }
    userId?: number
    itemId?: number
  } = { status: 'PENDING', expireAt: { lt: new Date() } }
  if (scope === 'user' && ref) where.userId = ref
  if (scope === 'item' && ref) where.itemId = ref

  const expired = await prisma.reservation.findMany({ where })
  for (const r of expired) {
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: r.id },
        data: {
          status: 'EXPIRED',
          cancelReason: '超时回收',
          // 用过期时刻而非回收时刻，履历时间轴上更符合直觉
          cancelledAt: r.expireAt,
        },
      }),
      prisma.item.update({
        where: { id: r.itemId },
        data: { reservedQty: { decrement: r.qty } },
      }),
      prisma.itemLog.create({
        data: {
          itemId: r.itemId,
          reservationId: r.id,
          scope: 'RESERVATION',
          action: 'EXPIRE',
          qty: r.qty,
          fromStatus: 'PENDING',
          toStatus: 'EXPIRED',
          operatorId: r.userId,
          note: `超时回收，归还 ${r.qty} 件`,
          createdAt: r.expireAt,
        },
      }),
    ])
  }
  return expired.length
}
