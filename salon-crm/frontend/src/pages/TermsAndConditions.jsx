import { Link } from 'react-router-dom'

export default function TermsAndConditions() {
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
              Terms & Conditions
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
            1. Acceptance of Terms
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            By logging in and using this Salon CRM and billing platform, authorized staff and administrators agree to be bound by these terms, operational guidelines, and all applicable laws regarding digital billing and communications.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            2. User Responsibilities & Account Security
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            Staff members and managers are accountable for preserving credential confidentiality. Actions executed using staff logins are attributed directly to the registered account holder. Sharing login credentials outside authorized personnel is prohibited.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            3. Billing Accuracy & Tax Compliance
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            Salon management is responsible for specifying accurate service pricing, tax rates (GST/VAT), discount thresholds, and billing identifiers. Generated invoices represent official records between the salon establishment and the consumer.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            4. WhatsApp Messaging Policies
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            The WhatsApp dispatch mechanism is intended solely for transactional bill notifications and invoice deliveries requested by clients. Automated messaging must conform to Meta business platform policies and anti-spam regulations.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #181614)' }}>
            5. Service Availability & Maintenance
          </h2>
          <p style={{ color: 'var(--text-secondary, #5f5a52)', lineHeight: 1.65, fontSize: 14, margin: 0 }}>
            We strive to maintain continuous platform availability. Occasional scheduled downtime may occur for database optimization, infrastructure updates, or security patches.
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
            <Link to="/privacy" style={{ color: 'var(--color-accent, #C5A059)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              Privacy Policy
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
