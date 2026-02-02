import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, RefreshCw, Cpu, AlertTriangle, FileText, BarChart3,
  CheckCircle, XCircle, Clock, Wifi, WifiOff, TrendingUp
} from 'lucide-react'
import { api, DataSource, DeviceHealthDashboard as HealthDashboardData, DeviceHealthSummary } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import DeviceHealthDashboard from '../components/DeviceHealthDashboard'
import RetryManager from '../components/RetryManager'
import FirmwareTracker from '../components/FirmwareTracker'
import DeviceAlertsManager from '../components/DeviceAlertsManager'

interface ConnectionEvent {
  time: string
  device: string
  event: 'online' | 'offline' | 'error' | 'warning'
  message?: string
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

interface DeviceHealthProps {
  currentSite: number | null
}

export default function DeviceHealth({ currentSite }: DeviceHealthProps) {
  const [activeTab, setActiveTab] = useState('health-dashboard')

  const { data: dataSources } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const { data: healthData } = useQuery({
    queryKey: ['deviceHealth', currentSite],
    queryFn: () => api.dataSources.healthDashboard(currentSite || undefined)
  })

  const onlineCount = dataSources?.filter((d: DataSource) => d.is_active).length || 0
  const offlineCount = dataSources?.filter((d: DataSource) => !d.is_active).length || 0

  const tabs: Tab[] = [
    { id: 'health-dashboard', label: 'Health Dashboard', icon: Activity },
    { id: 'retry-queue', label: 'Retry Queue', icon: RefreshCw },
    { id: 'firmware', label: 'Firmware Tracker', icon: Cpu },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: healthData?.error_count || 0 },
    { id: 'connection-logs', label: 'Connection Logs', icon: FileText },
    { id: 'performance', label: 'Performance', icon: BarChart3 }
  ]

  // Derive connection events from device health data
  const connectionEvents = useMemo((): ConnectionEvent[] => {
    if (!healthData?.devices) return []

    const events: ConnectionEvent[] = []

    healthData.devices.forEach((device: DeviceHealthSummary) => {
      // Add current status event
      events.push({
        time: device.last_communication || new Date().toISOString(),
        device: device.name,
        event: device.status === 'online' ? 'online' : device.status === 'error' ? 'error' : 'offline',
        message: device.status === 'online' ? 'Device online' : device.last_error || `Device ${device.status}`
      })

      // Add error event if there's a recent error
      if (device.last_error && device.error_count_24h > 0) {
        events.push({
          time: device.last_communication || new Date().toISOString(),
          device: device.name,
          event: 'error',
          message: device.last_error
        })
      }
    })

    // Sort by time descending
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [healthData])

  const [eventFilter, setEventFilter] = useState<string>('')
  const [deviceFilter, setDeviceFilter] = useState<string>('')

  const filteredEvents = useMemo(() => {
    return connectionEvents.filter(event => {
      if (deviceFilter && event.device !== deviceFilter) return false
      if (eventFilter && event.event !== eventFilter) return false
      return true
    })
  }, [connectionEvents, deviceFilter, eventFilter])

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'online': return CheckCircle
      case 'offline': return XCircle
      case 'error': return AlertTriangle
      case 'warning': return Clock
      default: return Clock
    }
  }

  const getEventColor = (event: string) => {
    switch (event) {
      case 'online': return '#10b981'
      case 'offline': return '#ef4444'
      case 'error': return '#f59e0b'
      case 'warning': return '#f59e0b'
      default: return '#64748b'
    }
  }

  const renderConnectionLogs = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Connection Logs</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Recent connection events and status changes for all devices.
      </p>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              color: 'white'
            }}
          >
            <option value="">All Devices</option>
            {healthData?.devices.map((device: DeviceHealthSummary) => (
              <option key={device.data_source_id} value={device.name}>{device.name}</option>
            ))}
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              color: 'white'
            }}
          >
            <option value="">All Events</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {filteredEvents.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#64748b'
            }}>
              No connection events found
            </div>
          ) : (
            filteredEvents.slice(0, 20).map((log, i) => {
              const Icon = getEventIcon(log.event)
              const color = getEventColor(log.event)
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '6px'
                  }}
                >
                  <Icon size={16} color={color} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'white' }}>{log.device}</span>
                    {log.message && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {log.message}
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: `${color}20`,
                    color: color,
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    textTransform: 'capitalize'
                  }}>
                    {log.event}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.875rem', minWidth: '80px', textAlign: 'right' }}>
                    {formatTimeAgo(log.time)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  // Calculate performance metrics from health data
  const performanceMetrics = useMemo(() => {
    if (!healthData?.devices || healthData.devices.length === 0) {
      return { uptime: 0, avgResponse: 0, dataGaps: 0, dataQuality: 0 }
    }

    const devicesWithResponseTime = healthData.devices.filter((d: DeviceHealthSummary) => d.avg_response_time_ms != null)
    const avgResponse = devicesWithResponseTime.length > 0
      ? devicesWithResponseTime.reduce((sum: number, d: DeviceHealthSummary) => sum + (d.avg_response_time_ms || 0), 0) / devicesWithResponseTime.length
      : 0

    const totalErrors = healthData.devices.reduce((sum: number, d: DeviceHealthSummary) => sum + d.error_count_24h, 0)

    return {
      uptime: healthData.overall_success_rate || 0,
      avgResponse: Math.round(avgResponse),
      dataGaps: totalErrors,
      dataQuality: healthData.overall_success_rate || 0
    }
  }, [healthData])

  const renderPerformance = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Device Performance</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Response times, data gaps, and communication quality metrics.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: performanceMetrics.uptime >= 99 ? '#10b981' : performanceMetrics.uptime >= 95 ? '#f59e0b' : '#ef4444'
          }}>
            {performanceMetrics.uptime.toFixed(1)}%
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Uptime (24h)</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: performanceMetrics.avgResponse < 50 ? '#10b981' : performanceMetrics.avgResponse < 100 ? '#3b82f6' : '#f59e0b'
          }}>
            {performanceMetrics.avgResponse}ms
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Avg Response</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: performanceMetrics.dataGaps === 0 ? '#10b981' : performanceMetrics.dataGaps <= 10 ? '#f59e0b' : '#ef4444'
          }}>
            {performanceMetrics.dataGaps}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Errors (24h)</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: performanceMetrics.dataQuality >= 99 ? '#8b5cf6' : performanceMetrics.dataQuality >= 95 ? '#3b82f6' : '#f59e0b'
          }}>
            {performanceMetrics.dataQuality.toFixed(1)}%
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Data Quality</div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: 'white', marginBottom: '1rem' }}>Device Response Times</h4>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {!healthData?.devices || healthData.devices.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No devices found
            </div>
          ) : (
            healthData.devices.map((device: DeviceHealthSummary) => {
              const responseTime = device.avg_response_time_ms || 0
              const successRate = device.success_rate_24h || 0
              return (
                <div
                  key={device.data_source_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: device.status === 'online' ? '#10b981' : device.status === 'error' ? '#f59e0b' : '#ef4444'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 500 }}>{device.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{device.protocol.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: responseTime < 50 ? '#10b981' : responseTime < 100 ? '#f59e0b' : '#ef4444' }}>
                      {responseTime > 0 ? `${responseTime.toFixed(0)}ms` : '-'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {successRate.toFixed(1)}% success
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'health-dashboard':
        return <DeviceHealthDashboard siteId={currentSite} />
      case 'retry-queue':
        return <RetryManager siteId={currentSite || 0} />
      case 'firmware':
        return <FirmwareTracker siteId={currentSite || 0} />
      case 'alerts':
        return <DeviceAlertsManager siteId={currentSite} dataSources={dataSources || []} />
      case 'connection-logs':
        return renderConnectionLogs()
      case 'performance':
        return renderPerformance()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', margin: 0 }}>Device Health</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Monitor device status, retry queues, and firmware</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Wifi size={24} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>{onlineCount}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Online Devices</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <WifiOff size={24} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>{offlineCount}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Offline Devices</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp size={24} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
              {dataSources?.length ? ((onlineCount / dataSources.length) * 100).toFixed(0) : 0}%
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Overall Health</div>
          </div>
        </div>
      </div>

      <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
