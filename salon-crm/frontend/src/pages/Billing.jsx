import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import Dropdown from '../components/Dropdown'

const DISCOUNT_OPTIONS = [
  { value: 'fixed', label: 'Fixed Rs.' },
  { value: 'percent', label: 'Percent %' },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid', dot: '#10b981' },
  { value: 'pending', label: 'Pending', dot: '#d97706' },
  { value: 'partial', label: 'Partial', dot: '#3b82f6' },
]

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toFixed(2)}`
}

// Prevent floating point errors
function calcLine(qty, price) {
  return Math.round(qty * price * 100) / 100
}
function calcSubtotal(items) {
  return Math.round(items.reduce((s, i) => s + (i.line_total || 0), 0) * 100) / 100
}
function calcDiscount(subtotal, discVal, discType) {
  if (discType === 'percent') return Math.round(Math.min(subtotal * discVal / 100, subtotal) * 100) / 100
  return Math.round(Math.min(discVal, subtotal) * 100) / 100
}
function calcTotal(subtotal, discAmount) {
  return Math.round(Math.max(subtotal - discAmount, 0) * 100) / 100
}

export default function Billing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const submitRef = useRef(false) // prevent double-submit

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' })
  const [customerMode, setCustomerMode] = useState('search') // 'search' | 'new'

  // Services
  const [services, setServices] = useState([])
  const [serviceCategories, setServiceCategories] = useState([])
  const [filterCat, setFilterCat] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')

  // Cart
  const [cartItems, setCartItems] = useState([])

  // Billing
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('fixed')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [notes, setNotes] = useState('')
  const [sendWhatsApp, setSendWhatsApp] = useState(true)

  // UI
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // bill creation result

  // Load services
  useEffect(() => {
    api.get('/services?active=true').then(res => {
      setServices(res.data.data)
      setServiceCategories(res.data.categories || [])
    })
  }, [])

  // Pre-select customer from URL param
  useEffect(() => {
    const cid = searchParams.get('customer')
    if (cid) {
      api.get(`/customers/${cid}`).then(res => {
        setSelectedCustomer(res.data.data)
        setCustomerMode('search')
      }).catch(() => {})
    }
  }, [searchParams])

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) {
      const t = setTimeout(() => setCustomerSuggestions([]), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(customerSearch)}&limit=6`)
        setCustomerSuggestions(res.data.data)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  function selectCustomer(c) {
    setSelectedCustomer(c)
    setCustomerSearch('')
    setCustomerSuggestions([])
  }

  function addToCart(service) {
    const existing = cartItems.find(i => i.service_id === service.id)
    if (existing) {
      setCartItems(items => items.map(i =>
        i.service_id === service.id
          ? { ...i, qty: i.qty + 1, line_total: calcLine(i.qty + 1, i.unit_price) }
          : i
      ))
    } else {
      setCartItems(items => [...items, {
        service_id: service.id,
        service_name: service.name,
        category: service.category,
        unit_price: Number(service.price),
        qty: 1,
        line_total: Number(service.price),
      }])
    }
  }

  function updateQty(serviceId, newQty) {
    if (newQty <= 0) {
      setCartItems(items => items.filter(i => i.service_id !== serviceId))
      return
    }
    setCartItems(items => items.map(i =>
      i.service_id === serviceId
        ? { ...i, qty: newQty, line_total: calcLine(newQty, i.unit_price) }
        : i
    ))
  }

  function removeItem(serviceId) {
    setCartItems(items => items.filter(i => i.service_id !== serviceId))
  }

  // Calculated totals (for display only - backend recalculates authoritatively)
  const subtotal = calcSubtotal(cartItems)
  const discountAmount = calcDiscount(subtotal, Number(discount) || 0, discountType)
  const total = calcTotal(subtotal, discountAmount)

  // Filtered services for display
  const filteredServices = services.filter(s => {
    const matchCat = !filterCat || s.category === filterCat
    const matchSearch = !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())
    return matchCat && matchSearch
  })

  async function handleSubmit() {
    if (submitRef.current) return // idempotency guard
    if (cartItems.length === 0) { toast.error('Add at least one service to the bill'); return }

    if (!selectedCustomer && customerMode === 'new' && !newCustomer.name.trim()) {
      toast.error('Please enter customer name or select an existing customer')
      return
    }

    submitRef.current = true
    setLoading(true)

    try {
      const payload = {
        customer_id: selectedCustomer?.id || null,
        customer: !selectedCustomer && customerMode === 'new' ? newCustomer : undefined,
        items: cartItems.map(i => ({
          service_id: i.service_id,
          service_name: i.service_name,
          unit_price: i.unit_price,
          qty: i.qty,
        })),
        discount: Number(discount) || 0,
        discount_type: discountType,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes.trim() || undefined,
        send_whatsapp: sendWhatsApp,
      }

      const res = await api.post('/bills', payload)
      setResult(res.data.data)
      toast.success(`Bill created: ${res.data.data.invoice_no}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create bill'
      toast.error(msg)
      submitRef.current = false
    } finally {
      setLoading(false)
    }
  }

  // Bill created success screen
  if (result) {
    const wa = result.whatsapp
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card">
          <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-success-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Bill Created!</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Invoice has been generated successfully</p>
          </div>

          <div style={{ padding: '0 24px 24px' }}>
            <div className="card" style={{ background: '#f8fafc' }}>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Invoice No</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-accent-hover)' }}>{result.invoice_no}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total Amount</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>Rs. {Number(result.total).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Customer</div>
                    <div style={{ fontWeight: 600 }}>{result.customer?.name || 'Walk-in'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Payment</div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{result.payment_method}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Status */}
            {sendWhatsApp && (
              <div className={`alert ${wa?.success ? 'alert-success' : 'alert-warning'}`} style={{ marginTop: 12 }}>
                {wa?.success ? (
                  <>WhatsApp invoice sent successfully to {result.customer?.phone}</>
                ) : (
                  <>WhatsApp: {wa?.error || 'Not configured'}. Bill is saved - you can retry from Bill History.</>
                )}
              </div>
            )}

            {result.pdf_error && (
              <div className="alert alert-warning" style={{ marginTop: 8 }}>
                PDF generation issue: {result.pdf_error}. You can retry from bill details.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <a
                href={`/api/bills/${result.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-dark"
                style={{ flex: 1 }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Download PDF
              </a>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate(`/bills/${result.id}`)}>
                View Bill
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                setResult(null)
                setCartItems([])
                setSelectedCustomer(null)
                setNewCustomer({ name: '', phone: '', email: '' })
                setDiscount(0)
                setNotes('')
                submitRef.current = false
              }}>
                New Bill
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Bill</h1>
          <p className="page-subtitle">Create a bill and send WhatsApp invoice</p>
        </div>
      </div>

      <div className="billing-layout">
        {/* LEFT: Customer + Services */}
        <div>
          {/* Customer Section */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Customer</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`btn btn-sm ${customerMode === 'search' ? 'btn-dark' : 'btn-outline'}`} onClick={() => setCustomerMode('search')}>Existing</button>
                <button className={`btn btn-sm ${customerMode === 'new' ? 'btn-dark' : 'btn-outline'}`} onClick={() => { setCustomerMode('new'); setSelectedCustomer(null) }}>New</button>
              </div>
            </div>
            <div className="card-body">
              {customerMode === 'search' ? (
                selectedCustomer ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f0fdf4', border: '1.5px solid var(--color-success)', borderRadius: 'var(--radius)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {selectedCustomer.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>+{selectedCustomer.phone}</div>
                    </div>
                    <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(null)}>Change</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div className="search-bar">
                      <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input
                        className="form-control"
                        placeholder="Search customer by name or phone..."
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    {customerSuggestions.length > 0 && (
                      <div className="custom-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 100, padding: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                        {customerSuggestions.map(c => (
                          <div
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, borderRadius: 'var(--radius-sm)', transition: 'background 0.12s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FDFBF7'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(197, 160, 89, 0.15)', color: '#87671f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                              {c.name[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>+{c.phone}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      Or leave blank for walk-in customer (no WhatsApp)
                    </p>
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Name <span className="required">*</span></label>
                    <input className="form-control" placeholder="Customer name" value={newCustomer.name} onChange={e => setNewCustomer(n => ({...n, name: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp Phone</label>
                    <input className="form-control" placeholder="919876543210" value={newCustomer.phone} onChange={e => setNewCustomer(n => ({...n, phone: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" placeholder="optional" value={newCustomer.email} onChange={e => setNewCustomer(n => ({...n, email: e.target.value}))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Selector */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Select Services</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cartItems.length} selected</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 160 }}>
                  <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input className="form-control" placeholder="Search services..." value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                </div>
                <div className="tag-group">
                  <span className={`tag${!filterCat ? ' active' : ''}`} onClick={() => setFilterCat('')}>All</span>
                  {serviceCategories.map(c => (
                    <span key={c} className={`tag${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(filterCat === c ? '' : c)}>{c}</span>
                  ))}
                </div>
              </div>

              {filteredServices.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <p className="empty-state-text">No services found</p>
                </div>
              ) : (
                <div className="service-grid">
                  {filteredServices.map(svc => {
                    const inCart = cartItems.find(i => i.service_id === svc.id)
                    return (
                      <div
                        key={svc.id}
                        className={`service-card${inCart ? ' selected' : ''}`}
                        onClick={() => addToCart(svc)}
                      >
                        {inCart && (
                          <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path d="M5 13l4 4L19 7"/></svg>
                          </div>
                        )}
                        <div className="service-card-name">{svc.name}</div>
                        {svc.category && <div className="service-card-cat">{svc.category}</div>}
                        <div className="service-card-price">Rs. {Number(svc.price).toLocaleString('en-IN')}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Bill Summary */}
        <div className="bill-summary">
          <div className="card-header">
            <span className="card-title">Bill Summary</span>
          </div>
          <div className="card-body">
            {/* Cart Items */}
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Select services to add to the bill
              </div>
            ) : (
              <div className="billing-items-list" style={{ marginBottom: 16 }}>
                {cartItems.map(item => (
                  <div key={item.service_id} className="billing-item">
                    <div style={{ flex: 1 }}>
                      <div className="billing-item-name">{item.service_name}</div>
                      {item.category && <div className="billing-item-category">{item.category}</div>}
                    </div>
                    <div className="qty-control">
                      <button className="qty-btn" onClick={() => updateQty(item.service_id, item.qty - 1)}>-</button>
                      <span className="qty-value">{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.service_id, item.qty + 1)}>+</button>
                    </div>
                    <div style={{ width: 80, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                      {formatCurrency(item.line_total)}
                    </div>
                    <button onClick={() => removeItem(item.service_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Discount */}
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Discount</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Dropdown
                  options={DISCOUNT_OPTIONS}
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value)}
                  style={{ width: 125, flexShrink: 0 }}
                />
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max={discountType === 'percent' ? 100 : subtotal}
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Totals */}
            <div style={{ background: '#f8fafc', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 14 }}>
              <div className="bill-summary-row">
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="bill-summary-row">
                  <span style={{ color: 'var(--color-success)' }}>Discount</span>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="bill-summary-row divider total">
                <span>Total</span>
                <span style={{ color: 'var(--color-accent-hover)' }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Payment Method</label>
              <div className="payment-methods">
                {[['cash','Cash'],['upi','UPI'],['card','Card'],['other','Other']].map(([v, l]) => (
                  <button key={v} type="button" className={`payment-method-btn${paymentMethod === v ? ' selected' : ''}`} onClick={() => setPaymentMethod(v)}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Payment Status</label>
              <Dropdown
                options={PAYMENT_STATUS_OPTIONS}
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} placeholder="Any notes for this bill..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {/* Send WhatsApp toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 12px', background: '#f0f9ff', borderRadius: 'var(--radius)', border: '1px solid #bae6fd' }}>
              <input type="checkbox" id="send-wa" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="send-wa" style={{ fontSize: 13.5, fontWeight: 500, cursor: 'pointer', flex: 1 }}>
                Send WhatsApp invoice after billing
              </label>
              <svg width="18" height="18" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>

            <button
              className="btn btn-primary w-full btn-lg"
              onClick={handleSubmit}
              disabled={loading || cartItems.length === 0}
            >
              {loading ? <><span className="loading-spinner" /> Creating Bill...</> : `Generate Bill - ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
