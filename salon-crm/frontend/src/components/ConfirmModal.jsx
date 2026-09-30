import { useEffect } from 'react'

/**
 * Reusable on-theme confirmation dialog.
 * Replaces native browser window.confirm with Priya's Art Beauty & Makeup Academy styled modal.
 */
export default function ConfirmModal({
  title = 'Please Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'primary' | 'dark'
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose])

  const confirmBtnClass =
    confirmVariant === 'danger'
      ? 'btn btn-danger'
      : confirmVariant === 'dark'
      ? 'btn btn-dark'
      : 'btn btn-primary'

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="modal confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ padding: '24px 24px 20px 24px' }}>
          <div className="confirm-dialog-content">
            <div className={`confirm-dialog-icon ${confirmVariant === 'danger' ? 'danger' : 'warning'}`}>
              {confirmVariant === 'danger' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="confirm-dialog-title">{title}</h3>
              <div className="confirm-dialog-desc">{message}</div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ background: 'var(--bg-subtle)', padding: '14px 24px' }}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmBtnClass}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
