import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

import Dropdown from '../components/Dropdown'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'paid', label: 'Paid', dot: '#10b981' },
  { value: 'pending', label: 'Pending', dot: '#d97706' },
  { value: 'partial', label: 'Partial', dot: '#3b82f6' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

const WA_STATUS_MAP = {
  queued:    { cls: 'badge-warning', label: 'Queued' },
  sent:      { cls: 'badge-info',    label: 'Sent' },
  delivered: { cls: 'badge-success', label: 'Delivered' },
  read:      { cls: 'badge-success', label: 'Read' },
  failed:    { cls: 'badge-danger',  label: 'Failed' },
}

const PAYMENT_STATUS = {
  paid:    { cls: 'badge-success', label: 'Paid' },
  pending: { cls: 'badge-warning', label: 'Pending' },
  partial: { cls: 'badge-info',    label: 'Partial' },
}

export default function BillHistory() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadBills = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (search) params.set('search', search)
      if (filterStatus) params.set('payment_status', filterStatus)
      if (filterPayment) params.set('payment_method', filterPayment)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await api.get(`/bills?${params}`)
      setBills(res.data.data)
      setPagination(res.data.pagination)
    } catch {
      toast.error('Failed to load bills')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterPayment, dateFrom, dateTo])

  useEffect(() => {
    const t = setTimeout(loadBills, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadBills, search])

  async function handleResend(billId) {
    try {
      await api.post(`/bills/${billId}/resend-whatsapp`)
      toast.success('WhatsApp resent')
      loadBills()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend WhatsApp')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bill History</h1>
          <p className="page-subtitle">{pagination?.total || 0} bills total</p>
        </div>
        <Link to="/billing" className="btn btn-primary">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
          New Bill
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input className="form-control" placeholder="Search by invoice or customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Dropdown
              options={STATUS_OPTIONS}
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              style={{ width: 135 }}
            />
            <Dropdown
              options={PAYMENT_OPTIONS}
              value={filterPayment}
              onChange={e => { setFilterPayment(e.target.value); setPage(1) }}
              style={{ width: 135 }}
            />
            <input type="date" className="form-control" style={{ width: 140 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
            <input type="date" className="form-control" style={{ width: 140 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="loading-spinner" style={{ width: 28, height: 28, color: 'var(--color-accent)', borderWidth: 3 }} />
          </div>
        ) : bills.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <h3 className="empty-state-title">No bills found</h3>
            <p className="empty-state-text">Create a new bill to get started</p>
            <Link to="/billing" className="btn btn-primary">New Bill</Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>WhatsApp</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => {
                  const wa = WA_STATUS_MAP[bill.whatsapp_status]
                  const ps = PAYMENT_STATUS[bill.payment_status] || { cls: 'badge-neutral', label: bill.payment_status }
                  return (
                    <tr key={bill.id}>
                      <td>
                        <Link to={`/bills/${bill.id}`} style={{ fontWeight: 700, color: 'var(--color-accent-hover)', fontSize: 13 }}>
                          {bill.invoice_no}
                        </Link>
                      </td>
                      <td style={{ fontSize: 13 }}>{bill.customer_name || <em style={{ color: 'var(--text-muted)' }}>Walk-in</em>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bill.item_count} item{bill.item_count !== 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Rs. {Number(bill.total).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{bill.payment_method}</span></td>
                      <td><span className={`badge ${ps.cls}`}>{ps.label}</span></td>
                      <td>
                        {wa ? <span className={`badge ${wa.cls}`}>{wa.label}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>N/A</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {format(new Date(bill.created_at), 'dd MMM, h:mm a')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <Link to={`/bills/${bill.id}`} className="btn btn-sm btn-outline">View</Link>
                          <a href={`/api/bills/${bill.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" title="Download PDF">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                          </a>
                          {bill.customer_phone && (
                            <button className="btn btn-sm btn-outline" onClick={() => handleResend(bill.id)} title="Resend WhatsApp">
                              <svg width="12" height="12" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </button>
                          )}
                        </div>
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
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                </button>
                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
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
