// JWT 解析中间件：解析 Bearer token 并挂载 req.user。
// 未带 token / token 失效一律 1002（HTTP 401），与"角色不够"的 1003 严格区分
import type { NextFunction, Request, Response } from 'express'
import { BizError, ERR } from '../lib/errors'
import { verifyToken } from '../lib/jwt'

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    next(new BizError(ERR.UNAUTHORIZED, '未登录或登录已失效'))
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    next(new BizError(ERR.UNAUTHORIZED, '未登录或登录已失效'))
  }
}
