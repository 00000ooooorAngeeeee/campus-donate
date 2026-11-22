// PrismaClient 单例：全进程共享一个连接，避免每个路由文件各建实例
import { PrismaClient } from '@prisma/client'
import { loadEnv } from './env'

// 必须在实例化前把 .env 里的 DATABASE_URL 装载进 process.env，
// 否则以 workspace 根目录启动时可能读不到配置
loadEnv()

export const prisma = new PrismaClient()
