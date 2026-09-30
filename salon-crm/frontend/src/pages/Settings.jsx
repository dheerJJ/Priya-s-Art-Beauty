import { useState, useEffect } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/useAuth'
import SUPPORT_CONFIG from '../config/support'

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('salon')

  // Salon settings
  const [salonForm, setSalonForm] = useState({})
  const [savingSalon, setSavingSalon] = useState(false)

  // Staff
  const [staff, setStaff] = useState([])
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [addingStaff, setAddingStaff] = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)

  // WhatsApp
  const [waStatus, setWaStatus] = useState(null)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    loadSalon()
    if (isAdmin) {
      loadStaff()
      loadWaStatus()
    }
  }, [isAdmin])

  async function loadSalon() {
    try {
      const res = await api.get('/settings/salon')
      setSalonForm(res.data.data)
    } catch {
      toast.error('Failed to load salon settings')
    }
  }

  async function loadStaff() {
    try {
      const res = await api.get('/settings/staff')
      setStaff(res.data.data)
    } catch {}
  }

  async function loadWaStatus() {
    try {
      const res = await api.get('/settings/whatsapp-status')
      setWaStatus(res.data.data)
    } catch {}
  }

  async function handleSendTestMessage(e) {
    if (e) e.preventDefault()
    setSendingTest(true)
    try {
      const res = await api.post('/settings/whatsapp-test', { phone: testPhone || undefined })
      toast.success(res.data.message || 'Test message sent successfully')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send test message'
      toast.error(msg)
    } finally {
      setSendingTest(false)
    }
  }

  async function saveSalon(e) {
    e.preventDefault()
    setSavingSalon(true)
    try {
      await api.put('/settings/salon', salonForm)
      toast.success('Settings saved')
      loadSalon()
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingSalon(false)
    }
  }

  async function addStaff(e) {
    e.preventDefault()
    if (!staffForm.name || !staffForm.email || staffForm.password.length < 8) {
      toast.error('Please fill all fields. Password must be at least 8 characters.')
      return
    }
    setAddingStaff(true)
    try {
      await api.post('/settings/staff', staffForm)
      toast.success('Staff member added')
      setStaffForm({ name: '', email: '', password: '', role: 'staff' })
      setShowStaffForm(false)
      loadStaff()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add staff')
    } finally {
      setAddingStaff(false)
    }
  }

  async function toggleStaff(id, is_active) {
    try {
      await api.put(`/settings/staff/${id}`, { is_active: !is_active })
      toast.success(is_active ? 'Staff deactivated' : 'Staff activated')
      loadStaff()
    } catch {
      toast.error('Failed to update staff')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your salon configuration</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'salon' ? ' active' : ''}`} onClick={() => setTab('salon')}>Salon Info</button>
        {isAdmin && <button className={`tab${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>Staff</button>}
        {isAdmin && <button className={`tab${tab === 'whatsapp' ? ' active' : ''}`} onClick={() => setTab('whatsapp')}>WhatsApp</button>}
      </div>

      {/* Salon Settings */}
      {tab === 'salon' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Salon Information</span>
          </div>
          <form onSubmit={saveSalon}>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Salon Name</label>
                  <input className="form-control" value={salonForm.name || ''} onChange={e => setSalonForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={salonForm.phone || ''} onChange={e => setSalonForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={salonForm.email || ''} onChange={e => setSalonForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows={2} value={salonForm.address || ''} onChange={e => setSalonForm(f => ({...f, address: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Invoice Prefix</label>
                  <input className="form-control" value={salonForm.invoice_prefix || ''} onChange={e => setSalonForm(f => ({...f, invoice_prefix: e.target.value}))} placeholder="SALON" />
                  <span className="form-hint">e.g., GLAM generates GLAM-2024-000001</span>
                </div>
                <div className="form-group">
                  <label className="form-label">GST / Tax Number</label>
                  <input className="form-control" value={salonForm.tax_number || ''} onChange={e => setSalonForm(f => ({...f, tax_number: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <input className="form-control" type="number" min="0" max="100" step="0.01" value={salonForm.tax_rate || 0} onChange={e => setSalonForm(f => ({...f, tax_rate: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-control" value={salonForm.currency || 'INR'} onChange={e => setSalonForm(f => ({...f, currency: e.target.value}))}>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Invoice Footer</label>
                  <textarea className="form-control" rows={2} value={salonForm.invoice_footer || ''} onChange={e => setSalonForm(f => ({...f, invoice_footer: e.target.value}))} placeholder="Thank you for your visit!" />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={salonForm.whatsapp_enabled || false} onChange={e => setSalonForm(f => ({...f, whatsapp_enabled: e.target.checked}))} />
                    <span className="form-label" style={{ margin: 0 }}>Enable WhatsApp invoicing</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="btn btn-primary" disabled={savingSalon}>
                {savingSalon ? <><span className="loading-spinner" /> Saving...</> : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Management */}
      {tab === 'staff' && isAdmin && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Staff Members</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowStaffForm(!showStaffForm)}>
                {showStaffForm ? 'Cancel' : 'Add Staff'}
              </button>
            </div>
            {showStaffForm && (
              <form onSubmit={addStaff}>
                <div className="card-body" style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input className="form-control" value={staffForm.name} onChange={e => setStaffForm(f => ({...f, name: e.target.value}))} placeholder="Full name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({...f, email: e.target.value}))} placeholder="email@salon.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input className="form-control" type="password" value={staffForm.password} onChange={e => setStaffForm(f => ({...f, password: e.target.value}))} placeholder="Min 8 characters" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select className="form-control" value={staffForm.role} onChange={e => setStaffForm(f => ({...f, role: e.target.value}))}>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={addingStaff}>
                    {addingStaff ? <><span className="loading-spinner" /> Adding...</> : 'Add Staff Member'}
                  </button>
                </div>
              </form>
            )}
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.email}</td>
                      <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{s.role}</span></td>
                      <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => toggleStaff(s.id, s.is_active)}>
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Config (Admin Only) */}
      {tab === 'whatsapp' && isAdmin && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">WhatsApp Integration</span>
            <span className={`badge ${waStatus?.connected ? 'badge-success' : 'badge-neutral'}`}>
              {waStatus?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div className="card-body">
            {waStatus?.connected ? (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 20 }}>
                  WhatsApp Business API is connected and active for automated billing messages.
                </div>
                <div style={{ marginBottom: 24, padding: '20px', background: 'var(--bg-page, #FBF9F5)', borderRadius: 'var(--radius, 10px)', border: '1px solid var(--border, #eae5db)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #5f5a52)', marginBottom: 6, fontWeight: 500 }}>
                    Linked Business WhatsApp Number
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #181614)', fontFamily: 'monospace' }}>
                    {waStatus.phone_number || '+91 98XXX XX123'}
                  </div>
                </div>

                <div style={{ maxWidth: 480 }}>
                  <label className="form-label" htmlFor="test-phone-input">Send Test Message</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      id="test-phone-input"
                      type="tel"
                      className="form-control"
                      placeholder="Recipient phone number (e.g. 9876543210)"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSendTestMessage}
                      disabled={sendingTest}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {sendingTest ? 'Sending...' : 'Send test message'}
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Sends a test notification to verify outbound WhatsApp delivery.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ padding: '24px', background: 'var(--color-accent-light, #FDFBF7)', borderRadius: 'var(--radius, 10px)', border: '1px solid rgba(197, 160, 89, 0.3)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #181614)', marginBottom: 12 }}>
                    {SUPPORT_CONFIG.notConnectedNotice}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.8 }}>
                    <div><strong>Email:</strong> <a href={`mailto:${SUPPORT_CONFIG.email}`} style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none' }}>{SUPPORT_CONFIG.email}</a></div>
                    <div><strong>Phone:</strong> {SUPPORT_CONFIG.phone}</div>
                    <div><strong>WhatsApp Support:</strong> {SUPPORT_CONFIG.whatsapp}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Support hours: {SUPPORT_CONFIG.hours}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
