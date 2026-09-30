import BRANDING_CONFIG from '../config/branding'

/**
 * Reusable CreditLine component.
 * - Reads attribution settings from branding config (never hardcoded)
 * - Renders small, muted, low-contrast 12px text
 * - Renders as an external link with rel="noopener noreferrer" target="_blank" if creditUrl is configured
 * - Renders as plain text if creditUrl is empty
 * - Returns null when showCredit is false
 */
export default function CreditLine({ className = '', style = {}, mutedColor = null }) {
  if (!BRANDING_CONFIG.showCredit) {
    return null
  }

  const { creditText, creditUrl } = BRANDING_CONFIG
  const textColor = mutedColor || 'var(--text-muted, rgba(250, 246, 237, 0.45))'

  const baseStyle = {
    fontSize: '12px',
    lineHeight: '1.4',
    letterSpacing: '0.01em',
    color: textColor,
    textAlign: 'center',
    display: 'inline-block',
    transition: 'color 0.2s ease',
    ...style,
  }

  if (creditUrl && typeof creditUrl === 'string' && creditUrl.trim().length > 0) {
    return (
      <a
        href={creditUrl.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className={`credit-line credit-line-link ${className}`}
        style={{
          ...baseStyle,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#C5A059'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = textColor
        }}
      >
        {creditText}
      </a>
    )
  }

  return (
    <span className={`credit-line ${className}`} style={baseStyle}>
      {creditText}
    </span>
  )
}
