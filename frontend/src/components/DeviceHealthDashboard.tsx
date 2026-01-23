import { useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, AlertTriangle, HelpCircle, RefreshCw, LucideIcon } from 'lucide-react'
import { api, DeviceHealthDashboard as HealthDashboard, DeviceHealthSummary } from '../services/api'
import { formatNumber } from '../utils/formatNumber'

interface DeviceHealthDashboardProps {
  siteId: number | null
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; icon: LucideIcon }> = {
    online: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: Wifi },
    offline: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: WifiOff },
    error: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
    unknown: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: HelpCircle },
  }
  
  const { color, bg, icon: Icon } = config[status] || config.unknown
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.25rem 0.5rem', borderRadius: '4px',
      backgroundColor: bg, color, fontSize: '0.75rem', fontWeight: 500
    }}>
      <Icon size={12} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function DeviceHealthDashboard({ siteId }: DeviceHealthDashboardProps) {
  const { data: health, isLoading, refetch, isFetching } = useQuery<HealthDashboard>({
    queryKey: ['device-health', siteId],
    queryFn: () => api.dataSources.healthDashboard(siteId || undefined),
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading device health...
      </div>
    )
  }

  if (!health) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        No health data available
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.125rem' }}>
          Device Health Overview
        </h3>
        <button onClick={() => refetch()} disabled={isFetching} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', backgroundColor: '#0f172a',
          border: '1px solid #334155', borderRadius: '6px',
          color: '#94a3b8', cursor: isFetching ? 'wait' : 'pointer',
          fontSize: '0.875rem'
        }}>
          <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          padding: '1rem', backgroundColor: '#0f172a',
          borderRadius: '8px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9' }}>
            {health.total_devices}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Devices</div>
        </div>
        <div style={{
          padding: '1rem', backgroundColor: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '8px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
            {health.online_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Online</div>
        </div>
        <div style={{
          padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '8px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444' }}>
            {health.offline_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Offline</div>
        </div>
        <div style={{
          padding: '1rem', backgroundColor: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '8px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b' }}>
            {health.error_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Errors</div>
        </div>
        <div style={{
          padding: '1rem', backgroundColor: '#0f172a',
          borderRadius: '8px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3b82f6' }}>
            {formatNumber(health.overall_success_rate)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Success Rate</div>
        </div>
      </div>

      <div style={{
        backgroundColor: '#0f172a', borderRadius: '8px',
        border: '1px solid #334155', overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Device Name
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Protocol
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Status
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Success Rate
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Response Time
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                Errors (24h)
              </th>
            </tr>
          </thead>
          <tbody>
            {health.devices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No devices found
                </td>
              </tr>
            ) : (
              health.devices.map((device: DeviceHealthSummary) => (
                <tr key={device.data_source_id} style={{ borderTop: '1px solid #334155' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{device.name}</div>
                    {device.last_error && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                        {device.last_error}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                    {device.protocol.replace('_', ' ').toUpperCase()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <StatusBadge status={device.status} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ 
                      color: device.success_rate_24h >= 99 ? '#10b981' : 
                             device.success_rate_24h >= 95 ? '#f59e0b' : '#ef4444',
                      fontWeight: 500
                    }}>
                      {formatNumber(device.success_rate_24h)}%
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#cbd5e1' }}>
                    {device.avg_response_time_ms != null ? `${formatNumber(device.avg_response_time_ms)} ms` : '-'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ 
                      color: device.error_count_24h === 0 ? '#10b981' : 
                             device.error_count_24h <= 5 ? '#f59e0b' : '#ef4444',
                      fontWeight: 500
                    }}>
                      {device.error_count_24h}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
