import axios from 'axios'

// In-memory token storage (never localStorage)
let inMemoryAccessToken = null

export function setAccessToken(token) {
  inMemoryAccessToken = token || null
}

export function getAccessToken() {
  return inMemoryAccessToken
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send HttpOnly refresh cookies with cross-site / API requests
})

// Request interceptor: attach in-memory access token
api.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`
  }
  return config
})

// Queue for concurrent 401 requests during token refresh
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response interceptor: handle 401 with automatic token refresh and queueing
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (!originalRequest) {
      return Promise.reject(error)
    }

    // Do not attempt refresh on auth endpoints themselves (login, register, refresh)
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Another refresh is already underway; queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Call refresh endpoint with withCredentials (cookie automatically sent)
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        const newToken = res.data?.data?.token

        setAccessToken(newToken)
        processQueue(null, newToken)

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        setAccessToken(null)

        // Clear legacy items if any existed
        try {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        } catch (_) {}

        // Redirect to login only if not already on public/auth pages
        const publicPaths = ['/login', '/signup', '/register', '/privacy', '/terms']
        const currentPath = window.location.pathname
        const isPublicPage = publicPaths.some((p) => currentPath.startsWith(p))

        if (!isPublicPage) {
          window.location.href = '/login'
        }

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
