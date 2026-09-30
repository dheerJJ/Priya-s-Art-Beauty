import { useState, useEffect } from 'react'
import api, { setAccessToken } from '../api/client'
import { AuthContext } from './auth-context'

// Module-level deduplication promise for restoring session on page load/refresh.
// Prevents race conditions from React 18 StrictMode double-mounting or concurrent re-renders
// which would otherwise trigger refresh token reuse detection and log the user out.
let activeRestorePromise = null

function restoreSessionOnce() {
  if (!activeRestorePromise) {
    activeRestorePromise = api
      .post('/auth/refresh')
      .then((res) => {
        return res.data?.data || null
      })
      .catch(() => {
        return null
      })
      .finally(() => {
        // Retain the promise for 2.5s to absorb StrictMode double-mount or rapid re-renders
        setTimeout(() => {
          activeRestorePromise = null
        }, 2500)
      })
  }
  return activeRestorePromise
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Silent session restore on app mount using HttpOnly refresh cookie
  useEffect(() => {
    let isMounted = true

    // Remove any stale tokens stored in localStorage by legacy versions
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    } catch (_) {}

    const publicRoutes = ['/login', '/signup', '/register', '/privacy', '/terms']
    const isPublicRoute = publicRoutes.some((p) => window.location.pathname.startsWith(p))
    const hasSessionIndicator = localStorage.getItem('has_session') === 'true'

    // If on a public route without a session indicator, don't ping /refresh
    if (isPublicRoute && !hasSessionIndicator) {
      setLoading(false)
      return
    }

    restoreSessionOnce()
      .then((sessionData) => {
        if (!isMounted) return

        if (sessionData?.token && sessionData?.user) {
          setAccessToken(sessionData.token)
          setUser(sessionData.user)
          try {
            localStorage.setItem('has_session', 'true')
          } catch (_) {}
        } else {
          setAccessToken(null)
          setUser(null)
          try {
            localStorage.removeItem('has_session')
          } catch (_) {}
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password })
    const { token, user: userData } = res.data.data
    // Access token kept in memory only (never localStorage)
    setAccessToken(token)
    setUser(userData)
    try {
      localStorage.setItem('has_session', 'true')
    } catch (_) {}
    return userData
  }

  async function register(registrationData) {
    const res = await api.post('/auth/register', registrationData)
    const { token, user: userData } = res.data.data
    // Access token kept in memory only (never localStorage)
    setAccessToken(token)
    setUser(userData)
    try {
      localStorage.setItem('has_session', 'true')
    } catch (_) {}
    return userData
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch (_) {
      // Best-effort logout
    } finally {
      setAccessToken(null)
      setUser(null)
      try {
        localStorage.removeItem('has_session')
      } catch (_) {}
    }
  }

  async function logoutAll() {
    try {
      await api.post('/auth/logout-all')
    } catch (_) {
      // Best-effort logout
    } finally {
      setAccessToken(null)
      setUser(null)
      try {
        localStorage.removeItem('has_session')
      } catch (_) {}
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    logoutAll,
    isAdmin: user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
