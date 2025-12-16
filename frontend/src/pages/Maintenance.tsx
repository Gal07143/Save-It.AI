import { useQuery } from '@tanstack/react-query'
import { Wrench, AlertTriangle, CheckCircle, Clock, ThermometerSun, Zap, Activity, Shield } from 'lucide-react'

const API_BASE = '/api/v1'

interface MaintenanceAlert {
  id: number
  title: string
  description: string
  severity: string
  status: string
}

export default function Maintenance() {
  const { data: alerts, isLoading: alertsLoading } = useQuery<MaintenanceAlert[]>({
    queryKey: ['maintenance-alerts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/maintenance/alerts`)
      return response.json()
    },
  })

  const { data: _conditions } = useQuery({
    queryKey: ['asset-conditions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/maintenance/asset-conditions`)
      return response.json()
    },
  })

  const openAlerts = alerts?.filter((a) => a.status === 'open').length || 0

  const maintenanceRules = [
    { name: 'Overload Detection', type: 'overload', threshold: '>85% rated capacity', active: true },
    { name: 'Power Factor Degradation', type: 'pf_degradation', threshold: '<0.85 PF trend', active: true },
    { name: 'Temperature Anomaly', type: 'temperature', threshold: '>45°C sustained', active: true },
    { name: 'Power Quality Issues', type: 'power_quality', threshold: 'THD >5%', active: false },
    { name: 'Lifecycle Alert', type: 'lifecycle', threshold: '<20% remaining life', active: true },
  ]

  const healthCategories = [
    { condition: 'Excellent', count: Math.floor(Math.random() * 10 + 5), color: '#10b981' },
    { condition: 'Good', count: Math.floor(Math.random() * 8 + 3), color: '#3b82f6' },
    { condition: 'Fair', count: Math.floor(Math.random() * 5 + 1), color: '#f59e0b' },
    { condition: 'Poor', count: Math.floor(Math.random() * 3), color: '#f97316' },
    { condition: 'Critical', count: Math.floor(Math.random() * 2), color: '#ef4444' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={24} color="#f97316" />
          Predictive Maintenance
        </h1>
        <p style={{ color: '#64748b' }}>Monitor asset health, detect anomalies, and plan maintenance</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#10b98120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CheckCircle size={24} color="#10b981" />
          </div>
          <div>
            <div className="stat-value">85%</div>
            <div className="stat-label">Healthy Assets</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#f59e0b20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertTriangle size={24} color="#f59e0b" />
          </div>
          <div>
            <div className="stat-value">{openAlerts}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#3b82f620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Clock size={24} color="#3b82f6" />
          </div>
          <div>
            <div className="stat-value">3</div>
            <div className="stat-label">Scheduled Maintenance</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#8b5cf620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ThermometerSun size={24} color="#8b5cf6" />
          </div>
          <div>
            <div className="stat-value">92.5</div>
            <div className="stat-label">Avg Health Score</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="#f59e0b" />
              Active Alerts
            </h2>
          </div>
          
          {alertsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading...</div>
          ) : (alerts?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={48} style={{ margin: '0 auto 0.75rem', color: '#10b981' }} />
              <p style={{ fontWeight: 500 }}>No active maintenance alerts</p>
              <p style={{ fontSize: '0.875rem' }}>All systems operating normally</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts?.slice(0, 5).map((alert) => (
                <div key={alert.id} style={{ 
                  padding: '1rem',
                  background: '#1e293b',
                  borderRadius: '0.5rem',
                  borderLeft: `3px solid ${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500 }}>{alert.title}</span>
                    <span className={`badge badge-${alert.severity === 'critical' ? 'danger' : 'warning'}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.75rem' }}>{alert.description}</p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                      Acknowledge
                    </button>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} />
              Maintenance Rules
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {maintenanceRules.map((rule, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '0.75rem',
                background: '#1e293b',
                borderRadius: '0.5rem'
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{rule.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{rule.threshold}</div>
                </div>
                <span className={`badge badge-${rule.active ? 'success' : 'secondary'}`}>
                  {rule.active ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} />
            Asset Health Overview
          </h2>
        </div>
        <div className="grid grid-5" style={{ gap: '1rem' }}>
          {healthCategories.map((cat) => (
            <div key={cat.condition} style={{ 
              textAlign: 'center', 
              padding: '1.5rem',
              background: '#1e293b',
              borderRadius: '0.5rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 0.75rem',
                borderRadius: '50%',
                background: cat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Zap size={24} color="white" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{cat.count}</div>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{cat.condition}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .grid-5 {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
        }
        @media (max-width: 1024px) {
          .grid-5 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 640px) {
          .grid-5 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}
