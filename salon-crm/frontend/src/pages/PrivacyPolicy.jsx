import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-primary, #141312)', color: 'var(--text-primary, #f8fafc)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: 'var(--color-primary-700, #1d1b19)', padding: '40px', borderRadius: '8px', border: '1px solid rgba(197,160,89,0.2)' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#FAF6ED' }}>Privacy Policy</h1>
          <Link to="/login" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            Back to Sign In
          </Link>
        </div>
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13, marginBottom: 28 }}>
          Last updated: October 2026
        </p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. Information We Collect</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            We collect information provided directly by salon staff and administrators, including customer names, phone numbers, service transaction histories, payment methods, and billing records required to process appointments and send digital invoices.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. How We Use Collected Information</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            The information collected is used exclusively for generating tax invoices, maintaining salon transaction records, managing service catalogs, and dispatching billing notifications and PDF receipts via official WhatsApp Business API integrations.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. WhatsApp Messaging & Communications</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            Customer telephone numbers are utilized solely for sending transactional invoice notifications and PDF bill downloads requested at checkout. We do not sell, rent, or distribute customer contact details to third-party marketing networks.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. Data Security & Storage</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            All user credentials, authentication tokens, and billing databases are safeguarded using industry standard bcrypt password hashing, JSON Web Tokens (JWT), and role-based access control. PDF bills are securely archived with restricted system access.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. Data Retention & Access Rights</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, fontSize: 14 }}>
            Salon operators maintain full administrative authority over their customer catalogs and transaction archives. Requests for customer record corrections or data removal can be executed by salon administrators in compliance with regional privacy laws.
          </p>
        </section>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20 }}>
          <Link to="/terms" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 13 }}>
            Terms & Conditions
          </Link>
          <Link to="/" style={{ color: 'var(--text-secondary, #94a3b8)', textDecoration: 'none', fontSize: 13 }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
