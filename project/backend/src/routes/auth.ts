// 认证路由：POST /api/auth/login · GET /api/auth/me · POST /api/auth/logout
// 说明：按分工该文件归成员 C（S3-04）。A 分支为使管理端页面可登录联调，
// 严格按 S3-04 的接口契约先行实现；C 合并时以此为基准校对或替换。
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { BizError, ERR } from '../lib/errors'
import { ok } from '../lib/response'
import { loginSchema } from '../lib/schema'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { studentNo, password } = req.body
    const user = await prisma.user.findUnique({ where: { studentNo } })
    // 账号不存在与密码错误统一文案，避免账号枚举（原型 01 交互说明第 5 条）
    const passOk = user ? await bcrypt.compare(password, user.passwordHash) : false
    if (!user || !passOk) {
      throw new BizError(ERR.UNAUTHORIZED, '学号或密码错误')
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const token = signToken({ id: user.id, role: user.role })
    res.json(ok({ token, user: { id: user.id, name: user.name, role: user.role, studentNo: user.studentNo } }))
  } catch (e) {
    next(e)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    // token 只含 id/role，展示信息（姓名/学号）查库取
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) throw new BizError(ERR.UNAUTHORIZED, '登录已失效')
    res.json(ok({ id: user.id, name: user.name, role: user.role, studentNo: user.studentNo }))
  } catch (e) {
    next(e)
  }
})

router.post('/logout', requireAuth, (req, res) => {
  // 无状态 JWT：登出由前端清 token，服务端仅记一条日志便于排查
  console.log(`[logout] user#${req.user?.id} ${new Date().toISOString()}`)
  res.json(ok(null))
})

export default router
