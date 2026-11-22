// 与后端共享的 DTO 与错误类型（后端侧定义见 project/backend/src/lib/schema.ts，
// 两份保持同步——前后端共享同一套 zod 规则的落地方式）

/** 业务错误：code 为后端错误码，message 为可直接展示的中文文案 */
export class BizError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

export type Role = 'STUDENT' | 'ADMIN'
export type ItemStatus =
  | 'PENDING'
  | 'REJECTED'
  | 'RECEIVING'
  | 'ON_SHELF'
  | 'OFFLINE'
  | 'CLOSED'

export interface UserInfo {
  id: number
  name: string
  role: Role
  studentNo: string
}

export interface LoginResult {
  token: string
  user: UserInfo
}

/** 物品管理列表行（GET /admin/items 返回的 list 元素） */
export interface AdminItemRow {
  id: number
  title: string
  description: string
  code: string | null
  condition: string
  status: ItemStatus
  totalQty: number
  available: number
  rejectReason: string | null
  images: string[]
  submittedAt: string
  receivedAt: string | null
  shelfAt: string | null
  approvedAt: string | null
  categoryName: string
  stationName: string
  donorName: string
  donorStudentNo: string
}

export interface AdminItemsData {
  list: AdminItemRow[]
  total: number
  page: number
  size: number
  counts: Record<string, number>
  categories: { id: number; name: string }[]
}

/** 核销结果（POST /admin/reservations/redeem） */
export interface RedeemResult {
  itemTitle: string
  qty: number
  collectedAt: string
  itemClosed: boolean
  remaining: number
  receiverName: string
  receiverStudentNo: string
}

export interface PendingReservation {
  code: string
  itemTitle: string
  qty: number
  expireAt: string
  receiverName: string
  receiverStudentNo: string
}

export interface RedeemedRecord {
  code: string
  itemTitle: string
  qty: number
  collectedAt: string
  operatorNo: string
}

/** 核销台右侧聚合数据（GET /admin/reservations/today） */
export interface TodayData {
  pending: PendingReservation[]
  redeemedToday: RedeemedRecord[]
  stats: { orders: number; pieces: number }
  station: { name: string; openHours: string } | null
}

/** 创建预约结果（POST /items/:id/reservations，B 的详情页消费） */
export interface ReservationCreated {
  reservationId: number
  code: string
  qty: number
  expireAt: string
  available: number
}

// ---- 展示映射：状态/成色的中文与语义色（与原型 06 的标签体系一致）----

export const ITEM_STATUS_TEXT: Record<string, string> = {
  PENDING: '待审核',
  REJECTED: '已驳回',
  RECEIVING: '待收货',
  ON_SHELF: '在架',
  OFFLINE: '已下架',
  CLOSED: '已完结',
}

export const CONDITION_TEXT: Record<string, string> = {
  NEW: '全新',
  GOOD: '良好',
  USABLE: '可用',
}
