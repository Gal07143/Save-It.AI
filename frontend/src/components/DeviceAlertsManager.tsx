import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, X, Power, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { api, DeviceAlertItem, DataSource } from '../services/api'

interface DeviceAlertsManagerProps {
  siteId?: number | null
  dataSources: DataSource[]
}

const alertTypes = [
  { value: 'offline', label: 'Device Offline' },
  { value: 'communication_error', label: 'Communication Error' },
  { value: 'value_threshold', label: 'Value Threshold' },
  { value: 'rate_of_change', label: 'Rate of Change' },
  { value: 'stale_data', label: 'Stale Data' }
]

const conditions = [
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '!=' },
  { value: 'duration_exceeded', label: 'Duration Exceeded' }
]

export default function DeviceAlertsManager({ siteId, dataSources }: DeviceAlertsManagerProps) {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAlert, setNewAlert] = useState({
    data_source_id: '',
    name: '',
    alert_type: 'offline',
    condition: 'duration_exceeded',
    threshold_value: '',
    threshold_duration_seconds: '300',
    severity: 'warning'
  })

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['device-alerts', siteId],
    queryFn: () => api.deviceAlerts.list(siteId || undefined)
  })

  const createMutation = useMutation({
    mutationFn: api.deviceAlerts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-alerts', siteId] })
      setShowAddModal(false)
      setNewAlert({
        data_source_id: '',
        name: '',
        alert_type: 'offline',
        condition: 'duration_exceeded',
        threshold_value: '',
        threshold_duration_seconds: '300',
        severity: 'warning'
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { is_active?: number } }) => 
      api.deviceAlerts.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['device-alerts', siteId] })
  })

  const deleteMutation = useMutation({
    mutationFn: api.deviceAlerts.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['device-alerts', siteId] })
  })

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={16} style={{ color: '#ef4444' }} />
      case 'warning':
        return <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
      default:
        return <Info size={16} style={{ color: '#3b82f6' }} />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="badge badge-error">Critical</span>
      case 'warning':
        return <span className="badge badge-warning">Warning</span>
      default:
        return <span className="badge">Info</span>
    }
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <Bell size={20} style={{ marginRight: '0.5rem' }} />
          Device Alerts
        </h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Alert Rule
        </button>
      </div>

      {isLoading ? (
        <p>Loading alerts...</p>
      ) : alerts && alerts.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Alert Name</th>
              <th>Type</th>
              <th>Condition</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Triggered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert: DeviceAlertItem) => (
              <tr key={alert.id}>
                <td style={{ fontWeight: 500 }}>{alert.device_name}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getSeverityIcon(alert.severity)}
                    {alert.name}
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{alert.alert_type.replace('_', ' ')}</td>
                <td>
                  {alert.condition.replace('_', ' ')}
                  {alert.threshold_value !== null && ` ${alert.threshold_value}`}
                </td>
                <td>{getSeverityBadge(alert.severity)}</td>
                <td>
                  {alert.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge">Disabled</span>
                  )}
                </td>
                <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  {alert.trigger_count > 0 ? `${alert.trigger_count}x` : 'Never'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => updateMutation.mutate({ 
                        id: alert.id, 
                        data: { is_active: alert.is_active ? 0 : 1 } 
                      })}
                      title={alert.is_active ? 'Disable' : 'Enable'}
                    >
                      <Power size={14} style={{ color: alert.is_active ? '#10b981' : '#64748b' }} />
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        if (confirm('Delete this alert rule?')) {
                          deleteMutation.mutate(alert.id)
                        }
                      }}
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Bell size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Alert Rules</h3>
          <p style={{ color: '#64748b' }}>Configure alerts to monitor your devices</p>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Alert Rule</h3>
              <button className="btn btn-sm" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Device</label>
                <select
                  className="form-input"
                  value={newAlert.data_source_id}
                  onChange={e => setNewAlert({ ...newAlert, data_source_id: e.target.value })}
                >
                  <option value="">Select device...</option>
                  {dataSources.map((ds: DataSource) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Alert Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAlert.name}
                  onChange={e => setNewAlert({ ...newAlert, name: e.target.value })}
                  placeholder="e.g., Meter offline alert"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Alert Type</label>
                  <select
                    className="form-input"
                    value={newAlert.alert_type}
                    onChange={e => setNewAlert({ ...newAlert, alert_type: e.target.value })}
                  >
                    {alertTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select
                    className="form-input"
                    value={newAlert.severity}
                    onChange={e => setNewAlert({ ...newAlert, severity: e.target.value })}
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select
                    className="form-input"
                    value={newAlert.condition}
                    onChange={e => setNewAlert({ ...newAlert, condition: e.target.value })}
                  >
                    {conditions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Threshold Value</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newAlert.threshold_value}
                    onChange={e => setNewAlert({ ...newAlert, threshold_value: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (seconds)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newAlert.threshold_duration_seconds}
                  onChange={e => setNewAlert({ ...newAlert, threshold_duration_seconds: e.target.value })}
                />
                <small style={{ color: '#64748b' }}>
                  Condition must persist for this duration before alerting
                </small>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => createMutation.mutate({
                  data_source_id: Number(newAlert.data_source_id),
                  name: newAlert.name,
                  alert_type: newAlert.alert_type,
                  condition: newAlert.condition,
                  threshold_value: newAlert.threshold_value ? Number(newAlert.threshold_value) : undefined,
                  threshold_duration_seconds: Number(newAlert.threshold_duration_seconds),
                  severity: newAlert.severity
                })}
                disabled={!newAlert.data_source_id || !newAlert.name}
              >
                Create Alert Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
