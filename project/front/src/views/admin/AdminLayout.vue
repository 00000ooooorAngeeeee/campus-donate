<template>
  <div class="admin">
    <aside class="side">
      <div class="side-brand"><span>拾</span>拾光 管理后台</div>
      <nav aria-label="管理后台导航">
        <RouterLink to="/admin/items" class="side-link" :class="{ on: isActive('/admin/items') }">物品管理</RouterLink>
        <RouterLink to="/admin/redeem" class="side-link" :class="{ on: isActive('/admin/redeem') }">核销台</RouterLink>
        <RouterLink to="/admin/dashboard" class="side-link" :class="{ on: isActive('/admin/dashboard') }">统计看板</RouterLink>
      </nav>
      <div class="side-foot">
        管理员 {{ userStore.userInfo?.studentNo || '-' }}<br />学生资助中心
      </div>
    </aside>

    <div class="main">
      <header class="admin-top">
        <h2>{{ pageTitle }}</h2>
        <div class="right">
          <slot name="topbar">
            <span>{{ uiStore.topbarText || `今天是 ${today}` }}</span>
          </slot>
          <a role="button" tabindex="0" @click="onLogout" @keydown.enter="onLogout">退出登录</a>
        </div>
      </header>
      <main class="body">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// Element Plus 样式只在后台布局引入一次：随 /admin 懒加载分包，
// 用户端首屏 bundle 不含 EP（技术约束：EP 仅 /admin 路由下使用）
import 'element-plus/dist/index.css'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const uiStore = useUiStore()

const TITLES: Record<string, string> = {
  'admin-items': '物品管理',
  'admin-redeem': '核销台',
  'admin-dashboard': '统计看板',
}

const pageTitle = computed(() => TITLES[String(route.name)] ?? '管理后台')
const today = dayjs().format('YYYY-MM-DD')

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

async function onLogout(): Promise<void> {
  await userStore.logout()
  router.push('/login')
}
</script>

<style>
/* 后台布局 + 后台设计 token：结构照原型 proto.css 的 .admin/.side/.main。
   Element Plus 主题变量映射到同一套色板，保证 EP 组件与原型视觉一致。
   （B 的 tokens.css 归用户端，后台自成一套局部变量，避免跨端耦合） */
.admin {
  --c-primary: #2f7d4f;
  --c-primary-d: #26663f;
  --c-primary-s: #edf5ef;
  --c-accent: #e8833a;
  --c-accent-s: #fbeee4;
  --c-danger: #c0392b;
  --c-danger-s: #fbedeb;
  --c-warn: #c98a1b;
  --c-warn-s: #fdf4e4;
  --c-info: #2a6ea8;
  --c-ink: #2e2e2c;
  --c-ink2: #6b6b66;
  --c-ink3: #9c9c95;
  --c-line: #dbdbd4;
  --c-line2: #edede8;
  --c-bg: #f7f7f3;

  /* Element Plus 主题映射 */
  --el-color-primary: #2f7d4f;
  --el-color-primary-light-3: #5e9b7a;
  --el-color-primary-light-5: #8ab9a0;
  --el-color-primary-light-7: #bcd8ca;
  --el-color-primary-light-8: #d6e8de;
  --el-color-primary-light-9: #edf5ef;
  --el-color-primary-dark-2: #26663f;
  --el-color-danger: #c0392b;
  --el-color-danger-light-8: #fbedeb;
  --el-color-warning: #c98a1b;
  --el-color-success: #2f7d4f;
  --el-color-error: #c0392b;
  --el-border-radius-base: 6px;
  --el-font-size-base: 13px;

  display: flex;
  min-height: 100vh;
}
.side {
  width: 200px;
  background: #2e2e2b;
  color: #fff;
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 0 0 18px;
}
.side-brand {
  height: 58px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.side-brand span {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: var(--c-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  margin-right: 8px;
}
.side nav {
  padding: 14px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.side-link {
  padding: 10px 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
  border-left: 2px solid transparent;
}
.side-link.on {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  border-left-color: var(--c-primary);
  font-weight: 500;
}
.side-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.04);
}
.side-foot {
  padding: 14px 20px 0;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.9;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.main {
  flex: 1;
  background: var(--c-bg);
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.admin-top {
  height: 58px;
  background: #fff;
  border-bottom: 1px solid var(--c-line2);
  display: flex;
  align-items: center;
  padding: 0 26px;
  gap: 16px;
  flex: none;
}
.admin-top h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.admin-top .right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12.5px;
  color: var(--c-ink2);
}
.admin-top .right a {
  cursor: pointer;
}
.admin-top .right a:hover {
  text-decoration: underline;
}
.body {
  padding: 22px 26px 30px;
  flex: 1;
}
</style>
