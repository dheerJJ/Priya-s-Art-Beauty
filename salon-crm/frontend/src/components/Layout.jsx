import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../context/useAuth'

function MenuIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <header className="topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}
            className="mobile-menu-btn"
          >
            <MenuIcon />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(197, 160, 89, 0.5)', background: '#141312' }}
            />
            <div className="topbar-title" id="page-title">{user?.salon_name || "Priya's Art Beauty & Makeup Academy"}</div>
          </div>
          <div className="topbar-right">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {user?.salon_name}
            </span>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
