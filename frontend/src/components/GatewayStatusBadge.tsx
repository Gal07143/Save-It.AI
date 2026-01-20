import { Wifi, WifiOff, AlertTriangle, Settings } from 'lucide-react'

interface GatewayStatusBadgeProps {
  status: 'online' | 'offline' | 'error' | 'configuring' | string
  gatewayName?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  online: {
    icon: Wifi,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    label: 'Online',
  },
  offline: {
    icon: WifiOff,
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.15)',
    label: 'Offline',
  },
  error: {
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    label: 'Error',
  },
  configuring: {
    icon: Settings,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    label: 'Configuring',
  },
}

const sizeConfig = {
  sm: { icon: 12, padding: '0.125rem 0.375rem', fontSize: '0.625rem', gap: '0.25rem' },
  md: { icon: 14, padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.375rem' },
  lg: { icon: 16, padding: '0.375rem 0.75rem', fontSize: '0.875rem', gap: '0.5rem' },
}

export default function GatewayStatusBadge({ 
  status, 
  gatewayName, 
  showLabel = true,
  size = 'md' 
}: GatewayStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline
  const sizes = sizeConfig[size]
  const Icon = config.icon

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizes.gap,
        padding: sizes.padding,
        borderRadius: '0.375rem',
        backgroundColor: config.bg,
        color: config.color,
        fontSize: sizes.fontSize,
        fontWeight: 500,
      }}
      title={gatewayName ? `${gatewayName} - ${config.label}` : config.label}
    >
      <Icon size={sizes.icon} />
      {showLabel && (
        <span>
          {gatewayName ? `${gatewayName}` : config.label}
        </span>
      )}
    </div>
  )
}

export function GatewayStatusIndicator({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline
  
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: config.color,
        boxShadow: `0 0 6px ${config.color}40`,
      }}
      title={config.label}
    />
  )
}

interface GatewayCardProps {
  id: number
  name: string
  status: string
  manufacturer?: string
  model?: string
  lastSeenAt?: string
  deviceCount?: number
  onRegister?: () => void
  onViewDevices?: () => void
}

export function GatewayCard({
  id,
  name,
  status,
  manufacturer,
  model,
  lastSeenAt,
  deviceCount = 0,
  onRegister,
  onViewDevices,
}: GatewayCardProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        border: `1px solid ${config.color}33`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
            {name}
          </h3>
          {(manufacturer || model) && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              {[manufacturer, model].filter(Boolean).join(' ')}
            </p>
          )}
        </div>
        <GatewayStatusBadge status={status} size="sm" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Connected Devices
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9' }}>
            {deviceCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Last Seen
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {lastSeenAt ? new Date(lastSeenAt).toLocaleString() : 'Never'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        {onRegister && (
          <button
            onClick={onRegister}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #3b82f6',
              backgroundColor: 'transparent',
              color: '#3b82f6',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Get Credentials
          </button>
        )}
        {onViewDevices && (
          <button
            onClick={onViewDevices}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            View Devices
          </button>
        )}
      </div>
    </div>
  )
}
