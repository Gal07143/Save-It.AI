import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Activity, RefreshCw, Cpu, AlertTriangle, FileText, BarChart3,
  CheckCircle, XCircle, Clock, Wifi, WifiOff, TrendingUp
} from 'lucide-react'
import { api } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import DeviceHealthDashboard from '../components/DeviceHealthDashboard'
import RetryManager from '../components/RetryManager'
import FirmwareTracker from '../components/FirmwareTracker'
import DeviceAlertsManager from '../components/DeviceAlertsManager'

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

  const onlineCount = dataSources?.filter((d: any) => d.is_active).length || 0
  const offlineCount = dataSources?.filter((d: any) => !d.is_active).length || 0

  const tabs: Tab[] = [
    { id: 'health-dashboard', label: 'Health Dashboard', icon: Activity },
    { id: 'retry-queue', label: 'Retry Queue', icon: RefreshCw },
    { id: 'firmware', label: 'Firmware Tracker', icon: Cpu },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: healthData?.error_count || 0 },
    { id: 'connection-logs', label: 'Connection Logs', icon: FileText },
    { id: 'performance', label: 'Performance', icon: BarChart3 }
  ]

  const renderConnectionLogs = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Connection Logs</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Historical connection events and status changes for all devices.
      </p>
      
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              color: 'white'
            }}
          >
            <option value="">All Devices</option>
            {dataSources?.map((ds: any) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          <select
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              color: 'white'
            }}
          >
            <option value="">All Events</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="timeout">Timeout</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {[
            { time: '2 min ago', device: 'Main Meter', event: 'connected', icon: CheckCircle, color: '#10b981' },
            { time: '15 min ago', device: 'PV Inverter 1', event: 'timeout', icon: Clock, color: '#f59e0b' },
            { time: '1 hour ago', device: 'Battery BMS', event: 'disconnected', icon: XCircle, color: '#ef4444' },
            { time: '2 hours ago', device: 'Sub Panel A', event: 'connected', icon: CheckCircle, color: '#10b981' },
            { time: '3 hours ago', device: 'Main Meter', event: 'connected', icon: CheckCircle, color: '#10b981' },
          ].map((log, i) => (
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
              <log.icon size={16} color={log.color} />
              <span style={{ color: 'white', flex: 1 }}>{log.device}</span>
              <span style={{ 
                padding: '0.25rem 0.5rem', 
                background: `${log.color}20`, 
                color: log.color,
                borderRadius: '4px',
                fontSize: '0.75rem',
                textTransform: 'capitalize'
              }}>
                {log.event}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderPerformance = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Device Performance</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Response times, data gaps, and communication quality metrics.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#10b981' }}>98.5%</div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Uptime</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#3b82f6' }}>45ms</div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Avg Response</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f59e0b' }}>12</div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Data Gaps (24h)</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#8b5cf6' }}>99.2%</div>
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Data Quality</div>
        </div>
      </div>
      
      <div className="card" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: 'white', marginBottom: '1rem' }}>Device Response Times</h4>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {dataSources?.slice(0, 5).map((device: any) => {
            const responseTime = 20 + Math.random() * 100
            const quality = 90 + Math.random() * 10
            return (
              <div
                key={device.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '6px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 500 }}>{device.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{device.host}:{device.port}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: responseTime < 50 ? '#10b981' : responseTime < 100 ? '#f59e0b' : '#ef4444' }}>
                    {responseTime.toFixed(0)}ms
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {quality.toFixed(1)}% quality
                  </div>
                </div>
              </div>
            )
          })}
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
