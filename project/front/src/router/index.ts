import { createRouter, createWebHistory } from 'vue-router'
import { setupRouterGuards } from './guards'

// 全部路由懒加载；后台路由挂在 /admin 布局下单独分包（N4 性能要求）
// 说明：discover / item-detail / donate / my-records / dashboard / 403 / 404
// 当前为占位壳，分别由成员 B（S3-05/07/08/11）、C（S3-04/12）在各自分支实现后合并替换
const routes = [
  { path: '/', redirect: '/discover' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
  },
  {
    path: '/discover',
    name: 'discover',
    component: () => import('@/views/discover/DiscoverView.vue'),
    // 权限矩阵：发现页未登录可浏览，预约才需要登录
    meta: { public: true },
  },
  {
    path: '/items/:id',
    name: 'item-detail',
    component: () => import('@/views/item-detail/DetailView.vue'),
    meta: { public: true },
  },
  {
    path: '/donate',
    name: 'donate',
    component: () => import('@/views/donate/DonateView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/my/records',
    name: 'my-records',
    component: () => import('@/views/my-records/RecordsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresRole: 'ADMIN' },
    redirect: '/admin/items',
    children: [
      {
        path: 'items',
        name: 'admin-items',
        component: () => import('@/views/admin/items/ItemListView.vue'),
      },
      {
        path: 'redeem',
        name: 'admin-redeem',
        component: () => import('@/views/admin/redeem/RedeemView.vue'),
      },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/dashboard/DashboardView.vue'),
      },
    ],
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: { public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

setupRouterGuards(router)

export default router
