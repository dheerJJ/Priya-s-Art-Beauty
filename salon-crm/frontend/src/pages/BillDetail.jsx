import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const WA_STATUS = {
  queued:    { cls: 'badge-warning', label: 'Queued' },
  sent:      { cls: 'badge-info',    label: 'Sent' },
  delivered: { cls: 'badge-success', label: 'Delivered' },
  read:      { cls: 'badge-success', label: 'Read' },
  failed:    { cls: 'badge-danger',  label: 'Failed' },
}

export default function BillDetail() {
  const { id } = useParams()
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)

  const loadBill = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/bills/${id}`)
      setBill(res.data.data)
    } catch {
      toast.error('Failed to load bill')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const t = setTimeout(loadBill, 0)
    return () => clearTimeout(t)
  }, [loadBill])

  async function handleResend() {
    setResending(true)
    try {
      await api.post(`/bills/${id}/resend-whatsapp`)
      toast.success('WhatsApp invoice resent')
      loadBill()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend')
    } finally {
      setResending(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, color: 'var(--color-accent)', borderWidth: 3 }} />
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="empty-state">
        <h3 className="empty-state-title">Bill not found</h3>
        <Link to="/bills" className="btn btn-primary">Back to Bills</Link>
      </div>
    )
  }

  const wa = WA_STATUS[bill.whatsapp_status]
  const discount = Number(bill.discount)
  const subtotal = Number(bill.subtotal)
  const tax = Number(bill.tax_amount)
  const total = Number(bill.total)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link to="/bills" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Bills</Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontWeight: 700, color: 'var(--color-accent-hover)' }}>{bill.invoice_no}</span>
          </div>
          <h1 className="page-title">Bill Details</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {bill.customer_phone && (
            <button className="btn btn-outline" onClick={handleResend} disabled={resending}>
              {resending ? <span className="loading-spinner" /> : (
                <svg width="16" height="16" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              )}
              Resend WhatsApp
            </button>
          )}
          <a href={`/api/bills/${id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Download PDF
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* Header info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Customer</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{bill.customer_name || 'Walk-in'}</div>
              {bill.customer_phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>+{bill.customer_phone}</div>}
              {bill.customer_email && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bill.customer_email}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Invoice No</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-accent-hover)' }}>{bill.invoice_no}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {format(new Date(bill.created_at), 'dd MMM yyyy, h:mm a')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`badge ${bill.payment_status === 'paid' ? 'badge-success' : bill.payment_status === 'pending' ? 'badge-warning' : 'badge-info'}`} style={{ textTransform: 'capitalize' }}>
                  {bill.payment_status}
                </span>
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{bill.payment_method}</span>
              </div>
              {bill.staff_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>by {bill.staff_name}</div>}
            </div>
          </div>

          {/* Items table */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.service_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.category || '-'}</td>
                    <td style={{ textAlign: 'right' }}>Rs. {Number(item.unit_price).toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>Rs. {Number(item.line_total).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13.5 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString('en-IN')}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--color-success)' }}>Discount ({bill.discount_type === 'percent' ? `${bill.discount}%` : 'Fixed'})</span>
                  <span style={{ color: 'var(--color-success)' }}>- Rs. {discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tax ({bill.tax_rate}%)</span>
                  <span>Rs. {tax.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--border)', marginTop: 4, fontWeight: 800, fontSize: 20 }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-accent-hover)' }}>Rs. {total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {bill.notes && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 'var(--radius)', fontSize: 13 }}>
              <strong>Notes: </strong>{bill.notes}
            </div>
          )}

          {/* WhatsApp status */}
          {bill.whatsapp_status && (
            <div style={{ marginTop: 20, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>WhatsApp Invoice</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sent to: +{bill.customer_phone}</div>
              </div>
              {wa && <span className={`badge ${wa.cls}`}>{wa.label}</span>}
              {bill.whatsapp_error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{bill.whatsapp_error}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
