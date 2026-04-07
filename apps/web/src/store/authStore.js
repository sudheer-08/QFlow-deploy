import { create } from 'zustand'
import { registerPushToken, unregisterPushToken } from '../services/push'

// Global auth state — persisted in localStorage
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('qflow_user') || 'null'),
  accessToken: localStorage.getItem('qflow_token') || null,

  login: async (user, accessToken, refreshToken = null) => {
    localStorage.setItem('qflow_user', JSON.stringify(user))
    localStorage.setItem('qflow_token', accessToken)
    if (refreshToken) {
      localStorage.setItem('qflow_refresh', refreshToken)
    } else {
      localStorage.removeItem('qflow_refresh')
    }
    set({ user, accessToken })

    return registerPushToken().catch(() => {
      // Token registration can fail on unsupported browsers or denied permissions.
    })
  },

  setUser: (user, accessToken = null, refreshToken = null) => {
    localStorage.setItem('qflow_user', JSON.stringify(user))

    if (accessToken) {
      localStorage.setItem('qflow_token', accessToken)
    } else {
      localStorage.removeItem('qflow_token')
    }

    if (refreshToken) {
      localStorage.setItem('qflow_refresh', refreshToken)
    } else {
      localStorage.removeItem('qflow_refresh')
    }

    set({ user, accessToken })
  },

  logout: () => {
    unregisterPushToken()
    localStorage.removeItem('qflow_user')
    localStorage.removeItem('qflow_token')
    localStorage.removeItem('qflow_refresh')
    set({ user: null, accessToken: null })
  }
}))
