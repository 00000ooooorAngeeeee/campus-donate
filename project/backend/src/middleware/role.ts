// 角色校验中间件：已登录但角色不符 → 1003（HTTP 403）。
// 只有两个角色，硬编码即可，不做 RBAC 表（S4-03 明确不做）
import type { NextFunction, Request, Response } from 'express'
import { BizError, ERR } from '../lib/errors'
import type { Role } from '../lib/constants'

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // 正常流程下 requireAuth 已在前；这里兜底，避免漏挂中间件时静默放行
      next(new BizError(ERR.UNAUTHORIZED, '未登录或登录已失效'))
      return
    }
    if (req.user.role !== role) {
      next(new BizError(ERR.FORBIDDEN, '无权限执行该操作'))
      return
    }
    next()
  }
}
