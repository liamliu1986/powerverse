import api from './api'

export interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name: string | null
  memory_total_mb: number | null
  created_at: string
}

export interface GPUMetric {
  time: string
  gpu_id: number
  utilization_pct: number | null
  memory_used_mb: number | null
  memory_free_mb: number | null
  temperature_c: number | null
  power_usage_w: number | null
}

export interface GPUMetricsHistoryResponse {
  gpu_id: number
  metrics: GPUMetric[]
}

export interface DiscoveredGPU {
  gpu_index: number
  model_name: string | null
  memory_total_mb: number | null
}

export interface DiscoverPreviewResponse {
  server_id: number
  server_hostname: string
  server_ip: string
  gpus: DiscoveredGPU[]
}

export interface DiscoverResponse {
  discovered: number
  already_exists: number
  failed: number
  gpus: DiscoveredGPU[]
}

export interface AvailableSlot {
  start_time: string
  end_time: string
  avg_utilization_pct: number
  avg_memory_used_mb: number
}

export interface AvailableSlotsResponse {
  gpu_id: number
  date: string
  slots: AvailableSlot[]
}

export const gpuApi = {
  list: async (serverId?: number): Promise<GPU[]> => {
    const params = serverId ? { server_id: serverId } : {}
    const response = await api.get('/v1/gpus', { params })
    return response.data
  },

  get: async (gpuId: number): Promise<GPU> => {
    const response = await api.get(`/v1/gpus/${gpuId}`)
    return response.data
  },

  getMetrics: async (gpuId: number): Promise<GPUMetric> => {
    const response = await api.get(`/v1/gpus/${gpuId}/metrics`)
    return response.data
  },

  getMetricsHistory: async (gpuId: number, hours: number = 24): Promise<GPUMetricsHistoryResponse> => {
    const response = await api.get(`/v1/gpus/${gpuId}/metrics/history`, { params: { hours } })
    return response.data
  },

  discoverPreview: async (serverId: number): Promise<DiscoverPreviewResponse> => {
    const response = await api.get('/v1/gpus/discover/preview', { params: { server_id: serverId } })
    return response.data
  },

  discover: async (serverId: number): Promise<DiscoverResponse> => {
    const response = await api.post('/v1/gpus/discover', null, { params: { server_id: serverId } })
    return response.data
  },

  getBatchMetrics: async (gpuIds: number[]): Promise<Record<number, GPUMetric>> => {
    const response = await api.get('/v1/gpus/metrics/batch', { params: { gpu_ids: gpuIds.join(',') } })
    return response.data
  },

  update: async (gpuId: number, data: Partial<GPU>): Promise<GPU> => {
    const response = await api.put(`/v1/gpus/${gpuId}`, data)
    return response.data
  },

  getAvailableSlots: async (gpuId: number, date: string): Promise<AvailableSlotsResponse> => {
    const response = await api.get(`/v1/gpus/${gpuId}/available-slots`, { params: { date } })
    return response.data
  },
}