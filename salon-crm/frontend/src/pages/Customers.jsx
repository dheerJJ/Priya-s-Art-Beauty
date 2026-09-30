import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'

function formatPhone(phone) {
  if (!phone) return ''
  if (phone.startsWith('91') && phone.length === 12) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`
  }
  return `+${phone}`
}

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    notes: customer?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, form)
        toast.success('Customer updated')
      } else {
        await api.post('/customers', form)
        toast.success('Customer added')
      }
      onSave()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save customer'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{customer ? 'Edit Customer' : 'Add Customer'}</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name <span className="required">*</span></label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Enter customer name" />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Phone <span className="required">*</span></label>
              <input className="form-control" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="919876543210 or 9876543210" />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
              <span className="form-hint">Include country code (e.g., 91 for India)</span>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="optional@email.com" />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any special notes..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="loading-spinner" /> Saving...</> : (customer ? 'Update' : 'Add Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [modalCustomer, setModalCustomer] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [deactivatingCustomer, setDeactivatingCustomer] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (search) params.set('search', search)
      const res = await api.get(`/customers?${params}`)
      setCustomers(res.data.data)
      setPagination(res.data.pagination)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(loadCustomers, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadCustomers, search])

  async function confirmDeactivate() {
    if (!deactivatingCustomer) return
    setDeactivating(true)
    try {
      await api.delete(`/customers/${deactivatingCustomer.id}`)
      toast.success('Customer deactivated')
      setDeactivatingCustomer(null)
      loadCustomers()
    } catch {
      toast.error('Failed to deactivate customer')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage your customer database</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalCustomer(null)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
          Add Customer
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar" style={{ width: 280 }}>
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              className="form-control"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {pagination?.total || 0} customers
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="loading-spinner" style={{ width: 28, height: 28, color: 'var(--color-accent)', borderWidth: 3 }} />
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <h3 className="empty-state-title">{search ? 'No customers found' : 'No customers yet'}</h3>
            <p className="empty-state-text">{search ? 'Try a different search term' : 'Add your first customer to get started'}</p>
            {!search && <button className="btn btn-primary" onClick={() => setModalCustomer(null)}>Add Customer</button>}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Bills</th>
                  <th>Total Spent</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/customers/${c.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.name}
                      </Link>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatPhone(c.phone)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                    <td>{c.bill_count}</td>
                    <td style={{ fontWeight: 600 }}>
                      {Number(c.total_spent) > 0 ? `Rs. ${Number(c.total_spent).toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/billing?customer=${c.id}`} className="btn btn-sm btn-primary" title="New Bill">
                          Bill
                        </Link>
                        <button className="btn btn-sm btn-outline" onClick={() => setModalCustomer(c)}>
                          Edit
                        </button>
                        {c.is_active && (
                          <button className="btn btn-sm btn-outline" onClick={() => setDeactivatingCustomer(c)} style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div style={{ padding: '0 16px' }}>
            <div className="pagination">
              <span className="pagination-info">
                Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
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

      {modalCustomer !== undefined && (
        <CustomerModal customer={modalCustomer} onClose={() => setModalCustomer(undefined)} onSave={loadCustomers} />
      )}

      {deactivatingCustomer && (
        <ConfirmModal
          title="Deactivate Customer"
          message={
            <span>
              Are you sure you want to deactivate <strong>{deactivatingCustomer.name}</strong>? Their past invoices and billing records will remain intact, but they will be marked as inactive.
            </span>
          }
          confirmLabel="Deactivate"
          confirmVariant="danger"
          loading={deactivating}
          onConfirm={confirmDeactivate}
          onClose={() => !deactivating && setDeactivatingCustomer(null)}
        />
      )}
    </div>
  )
}
