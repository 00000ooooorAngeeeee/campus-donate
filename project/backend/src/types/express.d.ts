// Express Request 类型扩展：auth 中间件把解析后的用户挂到 req.user
import type { JwtPayload } from '../lib/jwt'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export {}
