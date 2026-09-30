import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-accent)' }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />

  return children
}
