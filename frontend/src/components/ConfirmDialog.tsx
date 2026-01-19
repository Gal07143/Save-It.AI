import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantStyles = {
    danger: {
      bg: 'rgba(239, 68, 68, 0.15)',
      icon: '#ef4444',
      button: '#ef4444',
      buttonHover: '#dc2626',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.15)',
      icon: '#f59e0b',
      button: '#f59e0b',
      buttonHover: '#d97706',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.15)',
      icon: '#3b82f6',
      button: '#3b82f6',
      buttonHover: '#2563eb',
    },
  }

  const styles = variantStyles[variant]
  const Icon = variant === 'danger' ? Trash2 : AlertTriangle

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          padding: '1.5rem',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: styles.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={24} color={styles.icon} />
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.125rem', 
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '0.5rem',
            }}>
              {title}
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}>
              {message}
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#64748b',
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '1rem 1.5rem',
          borderTop: '1px solid #334155',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              background: styles.button,
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: isLoading ? 'wait' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isLoading && (
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
