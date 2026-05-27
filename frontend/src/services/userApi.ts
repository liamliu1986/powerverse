import api from './api'

export type UserRole = 'admin' | 'operator' | 'user'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  subsidiary?: string
  created_at: string
}

export interface UserCreate {
  username: string
  email: string
  password: string
  role: UserRole
  subsidiary?: string
}

export interface UserUpdate {
  username?: string
  email?: string
  password?: string
  role?: UserRole
  subsidiary?: string
}

export const userApi = {
  list: async (): Promise<User[]> => {
    const response = await api.get('/v1/users')
    return response.data
  },

  get: async (userId: number): Promise<User> => {
    const response = await api.get(`/v1/users/${userId}`)
    return response.data
  },

  create: async (data: UserCreate): Promise<User> => {
    const response = await api.post('/v1/users', data)
    return response.data
  },

  update: async (userId: number, data: UserUpdate): Promise<User> => {
    const response = await api.put(`/v1/users/${userId}`, data)
    return response.data
  },

  updateRole: async (userId: number, role: UserRole): Promise<User> => {
    const response = await api.put(`/v1/users/${userId}/role`, null, { params: { role } })
    return response.data
  },

  delete: async (userId: number): Promise<void> => {
    await api.delete(`/v1/users/${userId}`)
  },
}