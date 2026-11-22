// 统一响应包装：所有接口都经 ok/fail 出口，避免裸 res.json 造成格式漂移
import type { Response } from 'express'

export interface Envelope<T> {
  code: number
  message: string
  data: T
}

/** 成功响应（HTTP 恒为 200） */
export const ok = <T>(data: T): Envelope<T> => ({ code: 0, message: 'ok', data })

/** 失败响应体（HTTP 状态码由 httpStatusOf 映射，见架构文档 §7） */
export const fail = (code: number, message: string): Envelope<null> => ({
  code,
  message,
  data: null,
})

/**
 * 业务码 → HTTP 状态码。前端 axios 只认 envelope，这一层保证
 * 语义化状态码可供网络层（如 401 触发前端登出）识别。
 */
export function httpStatusOf(code: number): number {
  if (code === 0) return 200
  if (code === 1001 || code === 4001) return 400
  if (code === 1002) return 401
  if (code === 1003) return 403
  if (code === 2001 || code === 404) return 404
  if (code >= 3001 && code <= 3006) return 409
  return 500
}
