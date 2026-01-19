import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Clock, Zap, RefreshCw } from 'lucide-react'

interface DeviceStatus {
  name: string
  status: string
  device_type: string | null
  last_seen: string | null
}

interface SiteStatus {
  name: string
  location: string | null
  total_devices: number
  online_devices: number
  offline_devices: number
  error_devices: number
  overall_status: string
  devices: DeviceStatus[]
}

interface StatusPage {
  organization_name: string
  generated_at: string
  sites: SiteStatus[]
  total_devices: number
  total_online: number
  total_offline: number
  overall_health_percent: number
}

export default function PublicStatus() {
  const [status, setStatus] = useState<StatusPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())

  const token = window.location.pathname.split('/').pop() || ''

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/public/status/${token}`)
      if (!response.ok) {
        throw new Error('Status page not found')
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [token])

  const toggleSite = (siteName: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev)
      if (next.has(siteName)) {
        next.delete(siteName)
      } else {
        next.add(siteName)
      }
      return next
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'operational':
        return <CheckCircle size={16} className="text-emerald-500" />
      case 'offline':
      case 'down':
        return <XCircle size={16} className="text-red-500" />
      case 'error':
      case 'degraded':
        return <AlertTriangle size={16} className="text-amber-500" />
      default:
        return <Clock size={16} className="text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'operational':
        return '#10b981'
      case 'offline':
      case 'down':
        return '#ef4444'
      case 'error':
      case 'degraded':
        return '#f59e0b'
      default:
        return '#64748b'
    }
  }

  if (loading && !status) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: '#10b981', margin: '0 auto 1rem' }} />
          <p style={{ color: '#94a3b8' }}>Loading status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <XCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
          <h1 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>Status Page Not Found</h1>
          <p style={{ color: '#94a3b8' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!status) return null

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Zap size={32} style={{ color: '#10b981' }} />
            <h1 style={{ color: '#f1f5f9', fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
              {status.organization_name}
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>System Status</p>
        </header>

        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
              {status.overall_health_percent}%
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Overall Health</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9' }}>
              {status.total_devices}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Devices</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
              {status.total_online}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Online</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
              {status.total_offline}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Offline</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {status.sites.map(site => (
            <div
              key={site.name}
              style={{
                backgroundColor: '#1e293b',
                borderRadius: '0.75rem',
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => toggleSite(site.name)}
                style={{
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${getStatusColor(site.overall_status)}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {getStatusIcon(site.overall_status)}
                  <div>
                    <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{site.name}</div>
                    {site.location && (
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{site.location}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: '#10b981', fontSize: '0.875rem' }}>
                    {site.online_devices} online
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {site.total_devices} total
                  </span>
                </div>
              </div>

              {expandedSites.has(site.name) && (
                <div style={{ 
                  borderTop: '1px solid #334155',
                  padding: '1rem 1.5rem'
                }}>
                  {site.devices.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                      No devices configured
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {site.devices.map((device, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0',
                            borderBottom: idx < site.devices.length - 1 ? '1px solid #334155' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {getStatusIcon(device.status)}
                            <span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>{device.name}</span>
                            {device.device_type && (
                              <span style={{
                                backgroundColor: '#334155',
                                color: '#94a3b8',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem'
                              }}>
                                {device.device_type}
                              </span>
                            )}
                          </div>
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {device.last_seen
                              ? `Last seen: ${new Date(device.last_seen).toLocaleString()}`
                              : 'Never seen'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <footer style={{ 
          marginTop: '2rem', 
          textAlign: 'center', 
          color: '#64748b', 
          fontSize: '0.75rem' 
        }}>
          <p>Last updated: {new Date(status.generated_at).toLocaleString()}</p>
          <p style={{ marginTop: '0.25rem' }}>Powered by SAVE-IT.AI</p>
        </footer>
      </div>
    </div>
  )
}
