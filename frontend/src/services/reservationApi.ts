import api from './api'

export interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name?: string
  memory_total_mb?: number
  server?: {
    hostname: string
    ip_address: string
  }
}

export interface Reservation {
  id: number
  user_id: number
  gpu_id: number
  start_time: string
  end_time: string
  purpose?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by?: number
  created_at: string
  user?: {
    username: string
    email: string
  }
  gpu?: GPU
}

export interface ReservationCreate {
  gpu_id: number
  start_time: string
  end_time: string
  purpose?: string
}

export const reservationApi = {
  list: () => api.get<Reservation[]>('/v1/reservations'),

  create: (data: ReservationCreate) =>
    api.post('/v1/reservations', {
      ...data,
      start_time: new Date(data.start_time).toISOString(),
      end_time: new Date(data.end_time).toISOString(),
    }),

  approve: (id: number) => api.post(`/v1/reservations/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.post(`/v1/reservations/${id}/reject`, { approved: false, reason }),
}