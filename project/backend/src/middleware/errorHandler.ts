// 全局错误兜底：必须最后注册且为 4 参数函数。
// BizError 按其 code 返回；未知异常统一 5000 并在服务端打印完整堆栈，
// 绝不把堆栈泄露给前端
import type { NextFunction, Request, Response } from 'express'
import { BizError } from '../lib/errors'
import { fail, httpStatusOf } from '../lib/response'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint 不在依赖里，第四个参数是 Express 错误中间件的识别标志，不能省
  _next: NextFunction,
): void {
  if (err instanceof BizError) {
    res.status(httpStatusOf(err.code)).json(fail(err.code, err.message))
    return
  }
  console.error('[未处理异常]', err)
  res.status(500).json(fail(5000, '服务开小差了，请稍后重试'))
}
