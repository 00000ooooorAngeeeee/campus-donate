// .env 加载器：刻意不引入 dotenv（上下文未提到该依赖），
// 用十几行解析替代。真实环境变量优先于文件值。
import { readFileSync } from 'node:fs'
import path from 'node:path'

let loaded = false

export function loadEnv(): void {
  if (loaded) return
  loaded = true
  // 相对 lib 目录定位 project/backend/.env，与运行时 cwd 无关
  const file = path.resolve(__dirname, '../../.env')
  try {
    const text = readFileSync(file, 'utf-8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      const [, key, raw] = m
      let value = raw
      // 去掉成对引号
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // .env 缺失时按纯环境变量运行，不阻断启动
  }
}
