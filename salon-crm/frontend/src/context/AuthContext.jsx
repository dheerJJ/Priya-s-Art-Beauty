import { useState } from 'react'
import api from '../api/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      const token = localStorage.getItem('token')
      return (stored && token) ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, _setLoading] = useState(false)

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password })
    const { token, user: userData } = res.data.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value = { user, loading, login, logout, isAdmin: user?.role === 'admin' }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
