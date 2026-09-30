import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_MAP = {
  queued:    { cls: 'badge-warning', label: 'Queued' },
  sent:      { cls: 'badge-info',    label: 'Sent' },
  delivered: { cls: 'badge-success', label: 'Delivered' },
  read:      { cls: 'badge-success', label: 'Read' },
  failed:    { cls: 'badge-danger',  label: 'Failed' },
}

export default function WhatsAppLogs() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [stats, setStats] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (filter) params.set('status', filter)
      const res = await api.get(`/reports/whatsapp-logs?${params}`)
      setMessages(res.data.data)
      setPagination(res.data.pagination)
      setStats(res.data.stats)
    } catch {
      toast.error('Failed to load WhatsApp logs')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleResend(billId) {
    try {
      await api.post(`/bills/${billId}/resend-whatsapp`)
      toast.success('Resent successfully')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Logs</h1>
          <p className="page-subtitle">Track invoice delivery status</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {Object.entries(STATUS_MAP).map(([status, cfg]) => (
            <div key={status} className="stat-card" style={{ cursor: 'pointer', '--accent-color': status === 'delivered' ? '#10b981' : status === 'failed' ? '#ef4444' : 'var(--color-accent)' }}
              onClick={() => setFilter(filter === status ? '' : status)}>
              <div className="stat-label">{cfg.label}</div>
              <div className="stat-value">{stats[status] || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn btn-sm ${!filter ? 'btn-dark' : 'btn-outline'}`} onClick={() => setFilter('')}>All</button>
            {Object.entries(STATUS_MAP).map(([s, cfg]) => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-dark' : 'btn-outline'}`} onClick={() => setFilter(s)}>
                {cfg.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {pagination?.total || 0} messages
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="loading-spinner" style={{ width: 28, height: 28, color: 'var(--color-accent)', borderWidth: 3 }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No WhatsApp messages</h3>
            <p className="empty-state-text">WhatsApp invoice messages will appear here</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Sent At</th>
                  <th>Delivered</th>
                  <th>Error</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(msg => {
                  const sc = STATUS_MAP[msg.status] || { cls: 'badge-neutral', label: msg.status }
                  return (
                    <tr key={msg.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{msg.customer_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>+{msg.recipient_phone}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-accent-hover)', fontWeight: 600 }}>{msg.invoice_no}</td>
                      <td><span className={`badge ${sc.cls}`}>{sc.label}</span></td>
                      <td style={{ textAlign: 'center', fontSize: 13 }}>{msg.attempt_count}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {msg.sent_at ? format(new Date(msg.sent_at), 'dd MMM, h:mm a') : '-'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {msg.delivered_at ? format(new Date(msg.delivered_at), 'dd MMM, h:mm a') : '-'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-danger)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.error_message || '-'}
                      </td>
                      <td>
                        {msg.status === 'failed' && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleResend(msg.bill_id)} style={{ fontSize: 11 }}>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div style={{ padding: '0 16px' }}>
            <div className="pagination">
              <span className="pagination-info">Page {pagination.page} of {pagination.pages}</span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button className="page-btn" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
