import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后台（/admin）与用户端共用这一个壳；Element Plus 只在 A/C 的
// 后台视图内按需 import，落在 /admin 的懒加载分包里，用户端首屏不背这份体积
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
