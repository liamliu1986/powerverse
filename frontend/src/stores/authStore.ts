import { create } from 'zustand'
import api from '../services/api'

interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'operator' | 'user'
  subsidiary?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    const response = await api.post('/v1/auth/login', { username, password })
    const { access_token } = response.data
    localStorage.setItem('token', access_token)
    set({ token: access_token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchUser: async () => {
    const response = await api.get('/v1/auth/me')
    set({ user: response.data })
  },
}))