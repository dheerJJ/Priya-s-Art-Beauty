import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { format } from 'date-fns'

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function WAStatusBadge({ status }) {
  const cfg = {
    queued:    { cls: 'badge-warning', label: 'Queued' },
    sent:      { cls: 'badge-info',    label: 'Sent' },
    delivered: { cls: 'badge-success', label: 'Delivered' },
    read:      { cls: 'badge-success', label: 'Read' },
    failed:    { cls: 'badge-danger',  label: 'Failed' },
  }
  const { cls, label } = cfg[status] || { cls: 'badge-neutral', label: status || 'N/A' }
  return <span className={`badge ${cls}`}>{label}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/reports/dashboard')
      setStats(res.data.data)
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="skeleton" style={{ width: 180, height: 24, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 16 }} />
          </div>
        </div>
        <div className="stats-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 100, height: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 80, height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Failed to load dashboard</div>
        <div className="empty-state-text">{error}</div>
        <button className="btn btn-primary" onClick={loadDashboard}>Retry</button>
      </div>
    )
  }

  const { today, month, total_customers, recent_bills, recent_whatsapp } = stats || {}

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link to="/billing" className="btn btn-primary">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
          New Bill
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--accent-color': 'var(--color-accent)' }}>
          <div className="stat-label">Today's Revenue</div>
          <div className="stat-value">{formatCurrency(today?.revenue)}</div>
          <div className="stat-sub">{today?.bills || 0} bills today</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#3b82f6' }}>
          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-value">{formatCurrency(month?.revenue)}</div>
          <div className="stat-sub">{month?.bills || 0} bills this month</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#10b981' }}>
          <div className="stat-label">Total Customers</div>
          <div className="stat-value">{(total_customers || 0).toLocaleString()}</div>
          <div className="stat-sub">Active customers</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#0284c7' }}>
          <div className="stat-label">Avg Bill (Today)</div>
          <div className="stat-value">
            {today?.bills > 0 ? formatCurrency(today.revenue / today.bills) : 'Rs. 0'}
          </div>
          <div className="stat-sub">Per transaction</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Recent Bills */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Bills</span>
            <Link to="/bills" className="btn btn-sm btn-outline">View All</Link>
          </div>
          {recent_bills?.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-title">No bills yet</div>
              <div className="empty-state-text">Create your first bill to get started</div>
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>WA</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent_bills || []).slice(0, 8).map(bill => (
                    <tr key={bill.id}>
                      <td>
                        <Link to={`/bills/${bill.id}`} style={{ color: 'var(--color-accent-hover)', fontWeight: 600, fontSize: 13 }}>
                          {bill.invoice_no}
                        </Link>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {format(new Date(bill.created_at), 'dd MMM, h:mm a')}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{bill.customer_name || 'Walk-in'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(bill.total)}</td>
                      <td><WAStatusBadge status={bill.whatsapp_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* WhatsApp Logs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">WhatsApp Activity</span>
            <Link to="/whatsapp-logs" className="btn btn-sm btn-outline">View All</Link>
          </div>
          {recent_whatsapp?.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-title">No WhatsApp activity</div>
              <div className="empty-state-text">WhatsApp invoices will appear here</div>
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent_whatsapp || []).slice(0, 8).map(wa => (
                    <tr key={wa.id}>
                      <td style={{ fontSize: 13 }}>{wa.customer_name || wa.recipient_phone}</td>
                      <td style={{ fontSize: 13 }}>{wa.invoice_no}</td>
                      <td><WAStatusBadge status={wa.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {format(new Date(wa.created_at), 'dd MMM, h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
