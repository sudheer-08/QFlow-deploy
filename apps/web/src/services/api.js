import axios from 'axios'

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const apiBaseURL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000
})

let isRefreshing = false
let pendingQueue = []

function resolvePendingQueue(newToken) {
  pendingQueue.forEach(({ resolve }) => resolve(newToken))
  pendingQueue = []
}

function rejectPendingQueue(error) {
  pendingQueue.forEach(({ reject }) => reject(error))
  pendingQueue = []
}

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qflow_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh token if expired
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (err.response?.status === 401 && !original?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              if (!token) {
                reject(err)
                return
              }
              original.headers.Authorization = `Bearer ${token}`
              resolve(api(original))
            },
            reject
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const refresh = localStorage.getItem('qflow_refresh')
        if (!refresh) {
          throw new Error('Missing refresh token')
        }

        const { data } = await axios.post(
          `${apiBaseURL}/auth/refresh`,
          { refreshToken: refresh }
        )

        localStorage.setItem('qflow_token', data.accessToken)
        localStorage.setItem('qflow_refresh', data.refreshToken)
        resolvePendingQueue(data.accessToken)

        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (refreshError) {
        rejectPendingQueue(refreshError)
        localStorage.clear()
        // ✅ Redirect to correct login based on stored user role
const user = JSON.parse(localStorage.getItem('qflow_user') || 'null')
localStorage.clear()
window.location.href = user?.role === 'patient' ? '/patient/login' : '/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default api
