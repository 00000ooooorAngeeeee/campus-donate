// 一条命令同时起前后端（架构文档 §8.2：npm run dev → 前端 5173 · 后端 3001）。
// 不引入 concurrently（上下文未提到），直接用 child_process 造两个子进程。
import { spawn } from 'node:child_process'

// Windows 下 npm 是 .cmd，必须走 shell
const procs = [
  spawn('npm', ['run', 'dev', '-w', 'project/backend'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev', '-w', 'project/front'], { stdio: 'inherit', shell: true }),
]

function shutdown() {
  for (const p of procs) {
    try {
      p.kill('SIGTERM')
    } catch {
      /* 已退出则忽略 */
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

for (const p of procs) {
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[dev] 子进程退出（code=${code}），联动停止另一个进程`)
      shutdown()
    }
  })
}
