// 全局前置守卫（BR-10：页面级拦截只是第一道，接口中间件才是权限依据）：
// 未登录访问受限页 → /login?redirect=；角色不符 → /403（对应 E-08/E-09）
import type { Router } from 'vue-router'
import { useUserStore } from '@/stores/user'

export function setupRouterGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const user = useUserStore()
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth || r.meta.requiresRole)
    const requiredRole = to.matched
      .map((r) => r.meta.requiresRole as string | undefined)
      .find((v) => !!v)

    // 刷新后内存态丢失：有 token 但无 userInfo 时先恢复会话
    if (user.token && !user.userInfo) {
      await user.fetchMe()
    }

    if (needsAuth && !user.token) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (requiredRole && user.userInfo?.role !== requiredRole) {
      // 已登录但角色不够 → 403；未登录会被上一条规则先行送往登录
      return { path: '/403' }
    }

    // 已登录者访问登录页：按角色回到各自首页（原型 01 交互说明第 3 条）
    if (to.path === '/login' && user.token && user.userInfo) {
      return user.userInfo.role === 'ADMIN' ? '/admin/items' : '/discover'
    }

    return true
  })
}
