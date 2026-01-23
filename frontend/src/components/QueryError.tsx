import { AlertTriangle, RefreshCw } from 'lucide-react'

interface QueryErrorProps {
  message?: string
  onRetry?: () => void
}

export function QueryError({ message = 'Failed to load data', onRetry }: QueryErrorProps) {
  return (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      background: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '12px',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    }}>
      <AlertTriangle size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
      <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Error Loading Data</h4>
      <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}

export default QueryError
