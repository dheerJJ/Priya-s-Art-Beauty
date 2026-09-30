import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page, #FBF9F5)',
        color: 'var(--text-primary, #181614)',
        padding: '48px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 820, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src="/logo.png"
          alt="Priya's Art Beauty & Makeup Academy"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1.5px solid rgba(197, 160, 89, 0.6)',
            background: '#141312',
          }}
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #181614)' }}>
            Priya's Art Beauty & Makeup Academy
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #5f5a52)' }}>
            Official Salon CRM & Billing Portal
          </div>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 820,
          background: 'var(--bg-card, #ffffff)',
          borderRadius: 'var(--radius-lg, 16px)',
          border: '1px solid var(--border, #eae5db)',
          boxShadow: 'var(--shadow-md, 0 4px 6px rgba(20, 19, 18, 0.07))',
          padding: '44px 48px',
        }}
      >
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary, #181614)' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--text-secondary, #5f5a52)', fontSize: 13, margin: 0 }}>
              Last updated: October 2026
            </p>
          </div>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-accent, #C5A059)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid rgba(197, 160, 89, 0.3)',
              background: 'var(--color-accent-light, #FDFBF7)',
            }}
          >
            Back to Sign In
          </Link>
        </div>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            1. Information We Collect
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            We collect information provided directly by salon staff and administrators, including customer names, phone numbers, service transaction histories, payment methods, and billing records required to process appointments and send digital invoices.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            2. How We Use Collected Information
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            The information collected is used exclusively for generating tax invoices, maintaining salon transaction records, managing service catalogs, and dispatching billing notifications and PDF receipts via official WhatsApp Business API integrations.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            3. WhatsApp Messaging & Communications
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            Customer telephone numbers are utilized solely for sending transactional invoice notifications and PDF bill downloads requested at checkout. We do not sell, rent, or distribute customer contact details to third-party marketing networks.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            4. Data Security & Storage
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            All user credentials, authentication tokens, and billing databases are safeguarded using industry standard bcrypt password hashing, JSON Web Tokens (JWT), and role-based access control. PDF bills are securely archived with restricted system access.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            5. Data Retention & Access Rights
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            Salon operators maintain full administrative authority over their customer catalogs and transaction archives. Requests for customer record corrections or data removal can be executed by salon administrators in compliance with regional privacy laws.
          </p>
        </section>

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px solid var(--border, #eae5db)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/terms" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              Terms & Conditions
            </Link>
            <Link to="/login" style={{ color: 'var(--text-secondary, #5f5a52)', textDecoration: 'none', fontSize: 13 }}>
              Sign In
            </Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #8f897f)' }}>
            Priya's Art Beauty & Makeup Academy
          </div>
        </div>
      </div>
    </div>
  )
}
