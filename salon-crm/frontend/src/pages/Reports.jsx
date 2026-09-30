import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function formatCurrency(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-IN')}`
}

function formatYAxis(v) {
  if (v === 0) return '0'
  if (v >= 100000) return `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`
  if (v >= 1000) {
    const k = v / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return `${v}`
}

export default function Reports() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [period, setPeriod] = useState('month')

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom && dateTo) {
        params.set('from', dateFrom)
        params.set('to', dateTo)
      } else if (period) {
        params.set('period', period)
      }
      const res = await api.get(`/reports/sales?${params}`)
      setStats(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [period, dateFrom, dateTo])

  useEffect(() => {
    const t = setTimeout(loadReport, 0)
    return () => clearTimeout(t)
  }, [loadReport])

  const { summary, chart_data, top_services, payment_breakdown } = stats || {}

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-subtitle">Revenue analytics and performance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
              ].map(p => (
                <button
                  key={p.id}
                  className={`btn btn-sm ${period === p.id && !dateFrom && !dateTo ? 'btn-dark' : 'btn-outline'}`}
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    setPeriod(p.id)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>From:</label>
              <input
                type="date"
                className="form-control"
                style={{ width: 140 }}
                value={dateFrom}
                onChange={e => {
                  setDateFrom(e.target.value)
                  setPeriod('custom')
                }}
              />
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>To:</label>
              <input
                type="date"
                className="form-control"
                style={{ width: 140 }}
                value={dateTo}
                onChange={e => {
                  setDateTo(e.target.value)
                  setPeriod('custom')
                }}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  setPeriod('month')
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, color: 'var(--color-accent)', borderWidth: 3 }} />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ '--accent-color': 'var(--color-accent)' }}>
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">{formatCurrency(summary?.total_revenue)}</div>
              <div className="stat-sub">{summary?.total_bills} bills</div>
            </div>
            <div className="stat-card" style={{ '--accent-color': '#3b82f6' }}>
              <div className="stat-label">Average Bill</div>
              <div className="stat-value">{formatCurrency(summary?.avg_bill)}</div>
            </div>
            <div className="stat-card" style={{ '--accent-color': '#10b981' }}>
              <div className="stat-label">Unique Customers</div>
              <div className="stat-value">{summary?.unique_customers || 0}</div>
            </div>
            <div className="stat-card" style={{ '--accent-color': '#8b5cf6' }}>
              <div className="stat-label">WA Delivery Rate</div>
              <div className="stat-value">{summary?.wa_delivery_rate || '0'}%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Revenue Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Revenue Trend</span>
              </div>
              <div className="card-body">
                {chart_data?.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart_data} margin={{ top: 12, right: 12, left: -6, bottom: 4 }}>
                        <defs>
                          <linearGradient id="goldRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C5A059" stopOpacity={1} />
                            <stop offset="100%" stopColor="#9A7A38" stopOpacity={0.88} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatYAxis}
                          width={44}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(197, 160, 89, 0.08)' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload
                              return (
                                <div style={{
                                  background: '#141312',
                                  border: '1px solid rgba(197, 160, 89, 0.4)',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                  boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                                  color: '#ffffff',
                                  fontSize: 12,
                                }}>
                                  <div style={{ color: '#D4AF37', fontWeight: 600, marginBottom: 4 }}>
                                    {label}
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                                    Rs. {Number(d.revenue || 0).toLocaleString('en-IN')}
                                  </div>
                                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
                                    {d.bill_count || 0} bill{(d.bill_count || 0) !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar
                          dataKey="revenue"
                          fill="url(#goldRevenueGrad)"
                          maxBarSize={38}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <p className="empty-state-text">No data in selected range</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Payment Methods</span>
              </div>
              <div className="card-body">
                {payment_breakdown?.length > 0 ? (
                  <div>
                    {payment_breakdown.map(p => {
                      const total = payment_breakdown.reduce((s, i) => s + Number(i.total), 0)
                      const pct = total > 0 ? (Number(p.total) / total * 100).toFixed(1) : 0
                      return (
                        <div key={p.payment_method} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{p.payment_method}</span>
                            <span>{formatCurrency(p.total)} ({pct}%)</span>
                          </div>
                          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)', borderRadius: 4 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.count} transactions</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <p className="empty-state-text">No payment data</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Services */}
          {top_services?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top Services by Revenue</span>
              </div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_services.map((svc, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{svc.service_name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{svc.category || '-'}</td>
                        <td>{svc.order_count}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(svc.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
