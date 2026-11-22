// 业务错误：code 对应《02-数据结构与系统架构说明》§7 的错误码，
// message 必须是可直接展示给用户的中文文案（前端不做二次翻译）
export class BizError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

// ---- 常用错误码常量：避免魔法数字散落各路由 ----
export const ERR = {
  /** 参数校验失败 */
  PARAM: 1001,
  /** 未登录或 token 失效 */
  UNAUTHORIZED: 1002,
  /** 无权限 */
  FORBIDDEN: 1003,
  /** 资源不存在 */
  NOT_FOUND: 2001,
  /** 余量不足 */
  INSUFFICIENT: 3001,
  /** 当前状态不允许该操作 */
  BAD_STATE: 3002,
  /** 预约已超时 */
  RESERVATION_EXPIRED: 3003,
  /** 重复核销 */
  DUPLICATE_REDEEM: 3004,
  /** 超出未领取预约上限 */
  PENDING_OVERFLOW: 3005,
  /** 存在未核销预约，禁止下架 */
  OFFLINE_BLOCKED: 3006,
  /** 服务端异常 */
  INTERNAL: 5000,
} as const
