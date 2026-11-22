// 用户态：token + 基本信息。按架构文档 §4.5，Pinia 只存登录态这类全局只读数据，
// 业务数据一律由页面组件持有
import { defineStore } from 'pinia'
import { TOKEN_KEY, http } from '@/api/http'
import type { LoginResult, UserInfo } from '@/types'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    userInfo: null as UserInfo | null,
  }),
  getters: {
    isAdmin: (s) => s.userInfo?.role === 'ADMIN',
    isLogin: (s) => !!s.token,
  },
  actions: {
    async login(studentNo: string, password: string): Promise<UserInfo> {
      const data = await http.post<never, LoginResult>('/auth/login', { studentNo, password })
      this.token = data.token
      this.userInfo = data.user
      localStorage.setItem(TOKEN_KEY, data.token)
      return data.user
    },
    /** 应用启动/路由守卫时恢复会话；失败即清 token（不抛错，由守卫决定去向） */
    async fetchMe(): Promise<UserInfo | null> {
      if (!this.token) return null
      try {
        this.userInfo = await http.get<never, UserInfo>('/auth/me')
      } catch {
        this.clearLocal()
      }
      return this.userInfo
    },
    async logout(): Promise<void> {
      try {
        await http.post<never, null>('/auth/logout')
      } catch {
        // 登出接口失败不阻塞本地清理
      }
      this.clearLocal()
    },
    clearLocal(): void {
      this.token = ''
      this.userInfo = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
