// 服务入口：中间件装配 + 路由挂载 + 静态托管 + 兜底 404 / 全局错误处理
import { existsSync } from 'node:fs'
import path from 'node:path'
import express from 'express'
import { loadEnv } from './lib/env'
import { fail, httpStatusOf } from './lib/response'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import reservationsRouter from './routes/reservations'
import adminRouter from './routes/admin'

loadEnv()

const app = express()
app.use(express.json({ limit: '1mb' }))

// 上传图片静态目录（B 的上传接口写入这里）
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

// 业务路由
app.use('/api/auth', authRouter)
app.use('/api', reservationsRouter)
app.use('/api/admin', adminRouter)

// API 404：JSON 而非 HTML，且不落入 SPA fallback
app.use('/api', (req, res) => {
  res.status(httpStatusOf(404)).json(fail(404, '接口不存在'))
})

// 生产构建后由后端单端口托管前端静态资源（架构文档 §8.2）
const distDir = path.resolve(__dirname, '../../front/dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// 必须最后注册：兜底所有未处理异常
app.use(errorHandler)

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`[拾光·后端] http://localhost:${PORT} · env=${process.env.NODE_ENV ?? 'dev'}`)
})
