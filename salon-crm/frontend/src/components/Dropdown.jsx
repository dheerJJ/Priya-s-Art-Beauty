import { useState, useRef, useEffect, Children } from 'react'

/**
 * Custom Luxury Dropdown Component
 * Replaces native HTML <select> with a branded, accessible, keyboard-friendly dropdown.
 *
 * Props:
 * - options: Array of { value, label, dot, badge, icon, description } OR strings
 * - value: current selected value
 * - onChange: (e, value) => void
 * - placeholder: string (fallback when no value is selected)
 * - disabled: boolean
 * - className: extra CSS classes
 * - style: inline styles (e.g. { width: 130 })
 * - id: element id
 * - name: element name
 * - children: optional <option> tags as alternative to options prop
 */
export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  style = {},
  id,
  name,
  children,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  // Normalize options from props or children
  let normalizedOptions = []
  if (options && options.length > 0) {
    normalizedOptions = options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value ?? '',
          label: opt.label ?? String(opt.value ?? ''),
          dot: opt.dot ?? null,
          badge: opt.badge ?? null,
          icon: opt.icon ?? null,
          description: opt.description ?? null,
        }
      }
      return {
        value: opt,
        label: String(opt),
        dot: null,
        badge: null,
        icon: null,
        description: null,
      }
    })
  } else if (children) {
    Children.forEach(children, child => {
      if (child && child.props) {
        normalizedOptions.push({
          value: child.props.value ?? '',
          label: child.props.children ? String(child.props.children) : String(child.props.value ?? ''),
          dot: child.props['data-dot'] ?? null,
          badge: child.props['data-badge'] ?? null,
          icon: null,
          description: null,
        })
      }
    })
  }

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value))

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll('.custom-dropdown-item')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isOpen, highlightedIndex])

  function handleSelect(opt) {
    if (disabled) return
    setIsOpen(false)
    if (onChange) {
      const syntheticEvent = {
        target: { name, value: opt.value },
        currentTarget: { name, value: opt.value },
        preventDefault: () => {},
        stopPropagation: () => {},
      }
      onChange(syntheticEvent, opt.value)
    }
  }

  function handleKeyDown(e) {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        const curIdx = normalizedOptions.findIndex(opt => String(opt.value) === String(value))
        setHighlightedIndex(curIdx >= 0 ? curIdx : 0)
      }
      return
    }

    if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false)
      if (e.key === 'Escape') {
        e.preventDefault()
        triggerRef.current?.focus()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < normalizedOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : normalizedOptions.length - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        handleSelect(normalizedOptions[highlightedIndex])
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown-container ${className}`}
      style={{
        position: 'relative',
        display: style.display || (style.width ? 'inline-block' : 'block'),
        width: style.width || (style.minWidth ? 'auto' : '100%'),
        ...style,
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        className={`form-control custom-dropdown-trigger${isOpen ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            const curIdx = normalizedOptions.findIndex(opt => String(opt.value) === String(value))
            setHighlightedIndex(curIdx >= 0 ? curIdx : 0)
          }
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          gap: 8,
          userSelect: 'none',
          paddingRight: 10,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 500,
          }}
        >
          {selectedOption?.dot && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: selectedOption.dot,
                flexShrink: 0,
              }}
            />
          )}
          {selectedOption?.icon && (
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>{selectedOption.icon}</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        {/* Custom luxury chevron arrow */}
        <span
          className="custom-dropdown-chevron"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isOpen ? 'var(--color-accent)' : '#8f897f',
            transition: 'transform 0.2s ease, color 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Hidden native input for standard form submission compatibility */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          className="custom-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: '100%',
            background: '#ffffff',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            padding: '4px',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value)
              const isHighlighted = idx === highlightedIndex

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-dropdown-item${isSelected ? ' selected' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13.5,
                    gap: 8,
                    background: isSelected
                      ? 'rgba(197, 160, 89, 0.12)'
                      : isHighlighted
                      ? '#FDFBF7'
                      : 'transparent',
                    color: isSelected ? '#87671f' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.dot && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: opt.dot,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {opt.icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{opt.icon}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                  </div>

                  {isSelected && (
                    <span style={{ color: 'var(--color-accent)', display: 'inline-flex', flexShrink: 0, marginLeft: 6 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
