// zod 入参校验中间件：失败抛 1001，message 拼接第一个字段错误，
// 保证前端能直接把文案落到对应字段下方（S4-02 依赖这一点）
import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodType } from 'zod'
import { BizError, ERR } from '../lib/errors'

interface Schemas {
  body?: ZodType
  query?: ZodType
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {})
      }
      if (schemas.query) {
        // query 校验会产生 default 值，写回 req.query 供后续处理函数读取
        Object.assign(req.query, schemas.query.parse(req.query))
      }
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        const first = e.issues[0]?.message ?? '参数校验失败'
        next(new BizError(ERR.PARAM, first))
        return
      }
      next(e)
    }
  }
}
