import api from './api'

export interface DashboardOverview {
  total_servers: number
  online_servers: number
  total_gpus: number
  busy_gpus: number
  idle_gpus: number
  total_users: number
  pending_reservations: number
}

export interface UtilizationByGPU {
  gpu_id: number
  gpu_name: string
  server_hostname: string
  utilization_pct: number
  memory_used_mb: number
  memory_total_mb: number
}

export interface UtilizationStats {
  timestamp: string
  gpus: UtilizationByGPU[]
  average_utilization: number
  total_memory_used_gb: number
  total_memory_total_gb: number
}

export interface ScheduleItem {
  reservation_id: number
  gpu_id: number
  gpu_name: string
  server_hostname: string
  username: string
  start_time: string
  end_time: string
  purpose?: string
}

export interface ScheduleResponse {
  items: ScheduleItem[]
  date: string
}

export interface UsageTrendItem {
  timestamp: string
  avg_utilization: number
  total_memory_used_gb: number
  memory_utilization_pct: number
}

export interface UsageTrendResponse {
  items: UsageTrendItem[]
  period_days: number
}

export const dashboardApi = {
  getOverview: () => api.get<DashboardOverview>('/v1/dashboard/overview'),

  getUtilization: () => api.get<UtilizationStats>('/v1/dashboard/utilization'),

  getSchedule: (date: string) => api.get<ScheduleResponse>('/v1/dashboard/schedule', { params: { date } }),

  getUsageTrend: (days: number = 7) => api.get<UsageTrendResponse>('/v1/dashboard/usage-trend', { params: { days } }),
}