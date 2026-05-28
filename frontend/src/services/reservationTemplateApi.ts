import api from './api'

export type RecurrenceType = 'daily' | 'specific_dates' | 'date_range'
export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface ReservationTemplateCreate {
  gpu_id: number
  name?: string
  purpose?: string
  recurrence_type: RecurrenceType
  start_time: string  // "09:30" format
  end_time: string    // "18:45" or "24:00"
  start_date?: string
  end_date?: string
  specific_dates?: string[]
}

export interface ReservationTemplate {
  id: number
  user_id: number
  gpu_id: number
  name?: string
  purpose?: string
  recurrence_type: RecurrenceType
  start_time: string
  end_time: string
  start_date?: string
  end_date?: string
  specific_dates?: string[]
  status: ReservationStatus
  approved_by?: number
  is_active: boolean
  created_at: string
  gpu_name?: string
  server_hostname?: string
}

export interface ReservationInstancePreview {
  date: string
  start_time: string
  end_time: string
}

export interface ReservationTemplatePreview {
  template_id: number
  instances: ReservationInstancePreview[]
  total_count: number
}

export const reservationTemplateApi = {
  list: async (): Promise<ReservationTemplate[]> => {
    const response = await api.get('/v1/reservation-templates')
    return response.data
  },

  get: async (templateId: number): Promise<ReservationTemplate> => {
    const response = await api.get(`/v1/reservation-templates/${templateId}`)
    return response.data
  },

  create: async (data: ReservationTemplateCreate): Promise<ReservationTemplate> => {
    const response = await api.post('/v1/reservation-templates', data)
    return response.data
  },

  update: async (templateId: number, data: Partial<ReservationTemplateCreate>): Promise<ReservationTemplate> => {
    const response = await api.put(`/v1/reservation-templates/${templateId}`, data)
    return response.data
  },

  delete: async (templateId: number): Promise<void> => {
    await api.delete(`/v1/reservation-templates/${templateId}`)
  },

  preview: async (templateId: number): Promise<ReservationTemplatePreview> => {
    const response = await api.get(`/v1/reservation-templates/${templateId}/preview`)
    return response.data
  },

  approve: async (templateId: number): Promise<ReservationTemplate> => {
    const response = await api.post(`/v1/reservation-templates/${templateId}/approve`)
    return response.data
  },

  reject: async (templateId: number): Promise<void> => {
    await api.post(`/v1/reservation-templates/${templateId}/reject`)
  },
}