import { LucideIcon } from 'lucide-react'

interface CardHeaderProps {
  title: string
  icon?: LucideIcon
  action?: {
    label: string
    icon?: LucideIcon
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'danger'
  }
  children?: React.ReactNode
}

const variantStyles = {
  primary: {
    background: '#10b981',
    color: 'white',
  },
  secondary: {
    background: 'rgba(100, 116, 139, 0.2)',
    color: '#94a3b8',
  },
  danger: {
    background: '#ef4444',
    color: 'white',
  },
}

export default function CardHeader({ title, icon: Icon, action, children }: CardHeaderProps) {
  const ActionIcon = action?.icon
  const styles = action?.variant ? variantStyles[action.variant] : variantStyles.primary

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{
        margin: 0,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '1.125rem',
        fontWeight: 600,
      }}>
        {Icon && <Icon size={20} style={{ color: '#10b981' }} />}
        {title}
      </h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {children}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: styles.background,
              color: styles.color,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {ActionIcon && <ActionIcon size={16} />}
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
