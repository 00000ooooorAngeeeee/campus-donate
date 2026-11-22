// JWT 签发与校验：单 token 方案，payload 只放 { id, role }，
// 姓名/学号等展示信息由 /auth/me 查库获取，避免 token 膨胀与信息过期
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  id: number
  role: string
}

const secret = (): string => process.env.JWT_SECRET || 'shiguang-dev-secret'

/** 有效期 7 天：课程演示场景下避免频繁过期打断答辩 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' })
}

/** 校验失败直接抛错，由 auth 中间件统一转成 1002 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret()) as JwtPayload
}
