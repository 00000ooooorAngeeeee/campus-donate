// 管理端接口（A 维护）：页面组件不直接写 axios（架构文档 §6.1 分层职责）
import { api } from './http'
import type { AdminItemsData, RedeemResult, TodayData } from '@/types'

export interface AdminItemsParams {
  status?: string
  keyword?: string
  categoryId?: number
  page?: number
  size?: number
}

export function fetchAdminItems(params: AdminItemsParams) {
  return api.get<AdminItemsData>('/admin/items', { params })
}

export function approveItem(id: number) {
  return api.post<{ id: number; status: string }>(`/admin/items/${id}/approve`)
}

export function rejectItem(id: number, reason: string) {
  return api.post<{ id: number; status: string }>(`/admin/items/${id}/reject`, { reason })
}

export function receiveItem(id: number, actualQty: number) {
  return api.post<{ id: number; status: string; totalQty: number; code: string; adjusted: boolean }>(
    `/admin/items/${id}/receive`,
    { actualQty },
  )
}

export function offlineItem(id: number) {
  return api.post<{ id: number; status: string }>(`/admin/items/${id}/offline`)
}

export function redeemCode(code: string) {
  return api.post<RedeemResult>('/admin/reservations/redeem', { code })
}

export function fetchToday() {
  return api.get<TodayData>('/admin/reservations/today')
}
