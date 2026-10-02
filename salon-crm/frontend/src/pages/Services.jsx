import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/useAuth'
import Dropdown from '../components/Dropdown'

const ACTIVE_STATUS_OPTIONS = [
  { value: 'true', label: 'Active', dot: '#10b981' },
  { value: 'false', label: 'Inactive', dot: '#94a3b8' },
  { value: '', label: 'All Status' },
]

function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    category: service?.category || '',
    price: service?.price || '',
    duration_minutes: service?.duration_minutes || '',
    description: service?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Service name is required'
    if (!form.price || Number(form.price) < 0) e.price = 'Valid price is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const data = { ...form, price: Number(form.price), duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null }
      if (service) {
        await api.put(`/services/${service.id}`, data)
        toast.success('Service updated')
      } else {
        await api.post('/services', data)
        toast.success('Service added')
      }
      onSave()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{service ? 'Edit Service' : 'Add Service'}</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Service Name <span className="required">*</span></label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g., Haircut (Men)" />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-control" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} placeholder="e.g., Hair, Beard, Skin" />
              </div>
              <div className="form-group">
                <label className="form-label">Price (Rs.) <span className="required">*</span></label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="500" />
                {errors.price && <span className="form-error">{errors.price}</span>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input className="form-control" type="number" min="0" value={form.duration_minutes} onChange={e => setForm(f => ({...f, duration_minutes: e.target.value}))} placeholder="30" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Optional description" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="loading-spinner" /> Saving...</> : (service ? 'Update' : 'Add Service')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Services() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [modalService, setModalService] = useState(undefined)
  const { isAdmin } = useAuth()

  const loadServices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterCategory) params.set('category', filterCategory)
      if (filterActive) params.set('active', filterActive)
      const res = await api.get(`/services?${params}`)
      setServices(res.data.data)
      setCategories(res.data.categories || [])
    } catch {
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [search, filterCategory, filterActive])

  useEffect(() => {
    const t = setTimeout(loadServices, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadServices, search])

  async function toggleActive(svc) {
    try {
      await api.put(`/services/${svc.id}`, { is_active: !svc.is_active })
      toast.success(svc.is_active ? 'Service deactivated' : 'Service activated')
      loadServices()
    } catch {
      toast.error('Failed to update service')
    }
  }

  // Group services by category
  const grouped = services.reduce((acc, svc) => {
    const cat = svc.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">{services.length} services in catalog</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModalService(null)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
            Add Service
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input className="form-control" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="tag-group">
              <span className={`tag${!filterCategory ? ' active' : ''}`} onClick={() => setFilterCategory('')}>All</span>
              {categories.map(cat => (
                <span key={cat} className={`tag${filterCategory === cat ? ' active' : ''}`} onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}>{cat}</span>
              ))}
            </div>
            <Dropdown
              options={ACTIVE_STATUS_OPTIONS}
              value={filterActive}
              onChange={e => setFilterActive(e.target.value)}
              style={{ width: 130 }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="loading-spinner" style={{ width: 28, height: 28, color: 'var(--color-accent)', borderWidth: 3 }} />
        </div>
      ) : services.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <h3 className="empty-state-title">No services found</h3>
            <p className="empty-state-text">{isAdmin ? 'Add services to your catalog' : 'No services available'}</p>
            {isAdmin && <button className="btn btn-primary" onClick={() => setModalService(null)}>Add Service</button>}
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, svcs]) => (
          <div key={cat} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">{cat}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{svcs.length} services</span>
            </div>
            <div className="service-grid" style={{ padding: 16, gap: 10 }}>
              {svcs.map(svc => (
                <div key={svc.id} className={`service-card${!svc.is_active ? ' opacity-50' : ''}`} style={{ opacity: svc.is_active ? 1 : 0.5 }}>
                  <div className="service-card-name">{svc.name}</div>
                  {svc.duration_minutes && <div className="service-card-cat">{svc.duration_minutes} min</div>}
                  <div className="service-card-price">Rs. {Number(svc.price).toLocaleString('en-IN')}</div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setModalService(svc)}>Edit</button>
                      <button className={`btn btn-sm${svc.is_active ? ' btn-outline' : ' btn-success'}`} style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => toggleActive(svc)}>
                        {svc.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modalService !== undefined && isAdmin && (
        <ServiceModal service={modalService} onClose={() => setModalService(undefined)} onSave={loadServices} />
      )}
    </div>
  )
}
