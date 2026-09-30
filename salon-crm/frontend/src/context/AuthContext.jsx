import { useState, useEffect } from 'react'
import api, { setAccessToken } from '../api/client'
import { AuthContext } from './auth-context'

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

    async function restoreSession() {
      try {
        const res = await api.post('/auth/refresh')
        if (isMounted && res.data?.data) {
          const { token, user: userData } = res.data.data
          setAccessToken(token)
          setUser(userData)
        }
      } catch (_) {
        // No active refresh session or invalid token
        if (isMounted) {
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    restoreSession()

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
    return userData
  }

  async function register(registrationData) {
    const res = await api.post('/auth/register', registrationData)
    const { token, user: userData } = res.data.data
    // Access token kept in memory only (never localStorage)
    setAccessToken(token)
    setUser(userData)
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
