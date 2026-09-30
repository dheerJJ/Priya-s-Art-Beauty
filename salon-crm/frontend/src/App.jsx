import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import BillHistory from './pages/BillHistory'
import BillDetail from './pages/BillDetail'
import Customers from './pages/Customers'
import Services from './pages/Services'
import Reports from './pages/Reports'
import WhatsAppLogs from './pages/WhatsAppLogs'
import Settings from './pages/Settings'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsAndConditions from './pages/TermsAndConditions'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#141312',
              color: '#FAF6ED',
              fontSize: '13.5px',
              borderRadius: '8px',
              border: '1px solid rgba(197, 160, 89, 0.35)',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="billing" element={<Billing />} />
            <Route path="bills" element={<BillHistory />} />
            <Route path="bills/:id" element={<BillDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="services" element={<Services />} />
            <Route path="reports" element={<Reports />} />
            <Route path="whatsapp-logs" element={<WhatsAppLogs />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute adminOnly>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
