import { RefreshCw } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullPage?: boolean
}

const sizeMap = {
  sm: { icon: 16, text: '0.875rem' },
  md: { icon: 24, text: '1rem' },
  lg: { icon: 48, text: '1.125rem' },
}

export default function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  fullPage = false
}: LoadingSpinnerProps) {
  const { icon, text } = sizeMap[size]

  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      padding: fullPage ? '0' : '2rem',
      color: '#94a3b8',
    }}>
      <RefreshCw size={icon} className="spin" />
      {message && (
        <p style={{ fontSize: text, margin: 0 }}>{message}</p>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.8)',
        zIndex: 9999,
      }}>
        {content}
      </div>
    )
  }

  return content
}
