// axios 实例与双拦截器（架构文档 §6.2）：
// 请求拦截带 token；响应拦截解包 data、非 0 code 转 BizError、401 清 token 跳登录
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { BizError } from '@/types'

export const TOKEN_KEY = 'shiguang_token'

const http = axios.create({ baseURL: '/api', timeout: 10000 })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => {
    const { code, message, data } = res.data ?? {}
    if (code !== 0) {
      // 业务失败：HTTP 仍可能是 200（校验类错误走 4xx，由下面错误分支处理）
      return Promise.reject(new BizError(code, message || '操作失败'))
    }
    return data
  },
  (err) => {
    if (err.response?.status === 401) {
      // 会话失效：清 token 后整页回登录（硬跳转让所有页面状态归零，避免残留半登录态）
      localStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?redirect=${redirect}`)
      }
      return Promise.reject(new BizError(1002, err.response.data?.message || '登录已失效，请重新登录'))
    }
    if (err.response) {
      // 4xx/5xx：后端 envelope 仍在 err.response.data 里，透传其 code 与文案
      const d = err.response.data
      return Promise.reject(
        new BizError(d?.code ?? 5000, d?.message || `请求失败（HTTP ${err.response.status}）`),
      )
    }
    // 网络层失败（断网/超时）：给可理解的中文文案
    return Promise.reject(new BizError(-1, '网络异常，请检查连接后重试'))
  },
)

/**
 * 类型辅助：拦截器已把响应解包为 data，泛型第二个参数表示"实际 resolve 的类型"。
 * 用法：http.get<never, AdminItemsData>('/admin/items')
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => http.get<never, T>(url, config),
  post: <T>(url: string, body?: unknown) => http.post<never, T>(url, body),
  patch: <T>(url: string, body?: unknown) => http.patch<never, T>(url, body),
}

export { http }
