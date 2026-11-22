// 取值约定：SQLite 不支持 enum，五个枚举字段以 String 落库，
// 合法取值由本文件常量 + zod schema 双重约束（见架构文档 §2.3）

export const ROLES = ['STUDENT', 'ADMIN'] as const
export const ITEM_STATUSES = [
  'PENDING',
  'REJECTED',
  'RECEIVING',
  'ON_SHELF',
  'OFFLINE',
  'CLOSED',
] as const
export const RESERVATION_STATUSES = ['PENDING', 'COLLECTED', 'CANCELLED', 'EXPIRED'] as const
export const LOG_SCOPES = ['BATCH', 'RESERVATION'] as const
export const CONDITIONS = ['NEW', 'GOOD', 'USABLE'] as const

export type Role = (typeof ROLES)[number]
export type ItemStatus = (typeof ITEM_STATUSES)[number]
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
export type LogScope = (typeof LOG_SCOPES)[number]
export type Condition = (typeof CONDITIONS)[number]

/** 领取码字符集：大写字母 + 数字，剔除易混字符 O/0/I/1（架构文档 §2.2） */
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
