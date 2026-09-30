import { Link } from 'react-router-dom'

export default function TermsAndConditions() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-primary, #141312)', color: 'var(--text-primary, #f8fafc)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'var(--color-primary-700, #1d1b19)', padding: '40px', borderRadius: '8px', border: '1px solid rgba(197,160,89,0.2)' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#FAF6ED' }}>Terms & Conditions</h1>
          <Link to="/login" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            Back to Sign In
          </Link>
        </div>
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13, marginBottom: 28 }}>
          Last updated: October 2026
        </p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. Acceptance of Terms</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            By logging in and using this Salon CRM and billing platform, authorized staff and administrators agree to be bound by these terms, operational guidelines, and all applicable laws regarding digital billing and communications.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. User Responsibilities & Account Security</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            Staff members and managers are accountable for preserving credential confidentiality. Actions executed using staff logins are attributed directly to the registered account holder. Sharing login credentials outside authorized personnel is prohibited.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. Billing Accuracy & Tax Compliance</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            Salon management is responsible for specifying accurate service pricing, tax rates (GST/VAT), discount thresholds, and billing identifiers. Generated invoices represent official records between the salon establishment and the consumer.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. WhatsApp Messaging Policies</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            The WhatsApp dispatch mechanism is intended solely for transactional bill notifications and invoice deliveries requested by clients. Automated messaging must conform to Meta business platform policies and anti-spam regulations.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. Service Availability & Maintenance</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            We strive to maintain continuous platform availability. Occasional scheduled downtime may occur for database optimization, infrastructure updates, or security patches.
          </p>
        </section>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20 }}>
          <Link to="/privacy" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 13 }}>
            Privacy Policy
          </Link>
          <Link to="/" style={{ color: 'var(--text-secondary, #94a3b8)', textDecoration: 'none', fontSize: 13 }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
