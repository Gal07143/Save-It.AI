import { useState } from 'react'
import { Copy, Check, RefreshCw, Key, Server, Link2, Shield, Eye, EyeOff } from 'lucide-react'

interface MQTTConfig {
  host: string
  port: number
  tls_port: number
  username: string
  password: string
  client_id: string
  publish_topic: string
  heartbeat_topic: string
  subscribe_topic: string
}

interface WebhookConfig {
  url: string
  api_key: string
  secret_key: string
  method: string
  content_type: string
}

interface GatewayCredentials {
  gateway_id: number
  gateway_name: string
  status: string
  mqtt: MQTTConfig
  webhook: WebhookConfig
  registered_at: string
}

export interface GatewayCredentialsCardProps {
  credentials: GatewayCredentials | null
  isLoading?: boolean
  onRegister?: () => void
  onRotate?: () => void
  protocol?: 'mqtt' | 'webhook' | 'both'
}

function CopyableRow({ 
  label, 
  value, 
  isSecret = false 
}: { 
  label: string
  value: string
  isSecret?: boolean 
}) {
  const [copied, setCopied] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const displayValue = isSecret && !showSecret ? '********' : value

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1rem',
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '0.5rem',
      marginBottom: '0.5rem',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
          {label}
        </div>
        <code style={{ 
          fontSize: '0.875rem', 
          color: '#e2e8f0',
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          {displayValue}
        </code>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem' }}>
        {isSecret && (
          <button
            onClick={() => setShowSecret(!showSecret)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#64748b',
            }}
            title={showSecret ? 'Hide' : 'Show'}
          >
            {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            border: 'none',
            cursor: 'pointer',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            color: copied ? '#10b981' : '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            transition: 'all 0.2s',
          }}
          title="Copy to clipboard"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function GatewayCredentialsCard({
  credentials,
  isLoading = false,
  onRegister,
  onRotate,
  protocol = 'both',
}: GatewayCredentialsCardProps) {
  const [copiedAll, setCopiedAll] = useState(false)

  const handleCopyAll = async () => {
    if (!credentials) return

    let text = ''
    
    if (protocol === 'mqtt' || protocol === 'both') {
      text += `# MQTT Configuration\n`
      text += `Host: ${credentials.mqtt.host}\n`
      text += `Port: ${credentials.mqtt.port}\n`
      text += `TLS Port: ${credentials.mqtt.tls_port}\n`
      text += `Username: ${credentials.mqtt.username}\n`
      text += `Password: ${credentials.mqtt.password}\n`
      text += `Client ID: ${credentials.mqtt.client_id}\n`
      text += `Publish Topic: ${credentials.mqtt.publish_topic}\n`
      text += `Heartbeat Topic: ${credentials.mqtt.heartbeat_topic}\n`
      text += `\n`
    }

    if (protocol === 'webhook' || protocol === 'both') {
      text += `# Webhook Configuration\n`
      text += `URL: ${credentials.webhook.url}\n`
      text += `API Key: ${credentials.webhook.api_key}\n`
      text += `Secret Key: ${credentials.webhook.secret_key}\n`
      text += `Method: ${credentials.webhook.method}\n`
      text += `Content-Type: ${credentials.webhook.content_type}\n`
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (isLoading) {
    return (
      <div style={{
        background: 'rgba(30, 41, 59, 0.3)',
        borderRadius: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '1rem' }} />
        <p style={{ color: '#94a3b8' }}>Generating credentials...</p>
      </div>
    )
  }

  if (!credentials) {
    return (
      <div style={{
        background: 'rgba(30, 41, 59, 0.3)',
        borderRadius: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
        border: '2px dashed rgba(100, 116, 139, 0.3)',
      }}>
        <Key size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
        <h3 style={{ color: '#e2e8f0', marginBottom: '0.5rem' }}>No Credentials Generated</h3>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Register this gateway to generate connection credentials
        </p>
        {onRegister && (
          <button
            onClick={onRegister}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Key size={16} />
            Register Gateway
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.3)',
      borderRadius: '0.75rem',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
        background: 'rgba(16, 185, 129, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={20} style={{ color: '#10b981' }} />
          <div>
            <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '1rem' }}>
              Connection Credentials
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
              Gateway registered successfully
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopyAll}
            style={{
              background: copiedAll ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              color: copiedAll ? '#10b981' : '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            {copiedAll ? <Check size={16} /> : <Copy size={16} />}
            {copiedAll ? 'Copied All!' : 'Copy All'}
          </button>
          {onRotate && (
            <button
              onClick={onRotate}
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.875rem',
              }}
              title="Generate new credentials (invalidates old ones)"
            >
              <RefreshCw size={16} />
              Rotate
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {(protocol === 'mqtt' || protocol === 'both') && (
          <div style={{ marginBottom: protocol === 'both' ? '1.5rem' : 0 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              marginBottom: '0.75rem',
              color: '#94a3b8',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <Server size={14} />
              MQTT Configuration
            </div>
            <CopyableRow label="Host" value={credentials.mqtt.host} />
            <CopyableRow label="Port" value={String(credentials.mqtt.port)} />
            <CopyableRow label="TLS Port" value={String(credentials.mqtt.tls_port)} />
            <CopyableRow label="Username" value={credentials.mqtt.username} />
            <CopyableRow label="Password" value={credentials.mqtt.password} isSecret />
            <CopyableRow label="Client ID" value={credentials.mqtt.client_id} />
            <CopyableRow label="Publish Topic" value={credentials.mqtt.publish_topic} />
            <CopyableRow label="Heartbeat Topic" value={credentials.mqtt.heartbeat_topic} />
          </div>
        )}

        {(protocol === 'webhook' || protocol === 'both') && (
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              marginBottom: '0.75rem',
              color: '#94a3b8',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <Link2 size={14} />
              Webhook Configuration
            </div>
            <CopyableRow label="URL" value={credentials.webhook.url} />
            <CopyableRow label="API Key" value={credentials.webhook.api_key} />
            <CopyableRow label="Secret Key" value={credentials.webhook.secret_key} isSecret />
            <CopyableRow label="Method" value={credentials.webhook.method} />
            <CopyableRow label="Content-Type" value={credentials.webhook.content_type} />
          </div>
        )}
      </div>

      <div style={{
        padding: '1rem 1.25rem',
        borderTop: '1px solid rgba(100, 116, 139, 0.2)',
        background: 'rgba(30, 41, 59, 0.3)',
        fontSize: '0.75rem',
        color: '#64748b',
      }}>
        Registered at: {new Date(credentials.registered_at).toLocaleString()}
      </div>
    </div>
  )
}
