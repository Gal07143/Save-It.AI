import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Activity, TrendingUp } from 'lucide-react'

const API_BASE = '/api/v1'

interface QualityDashboard {
  total_meters: number
  meters_with_issues: number
  average_coverage: number
  average_quality_score: number
  open_issues_count: number
  critical_issues_count: number
  recent_issues: { id: number; issue_type: string; severity: string; meter_id: number }[]
}

export default function DataQuality() {
  const { data: dashboard, isLoading } = useQuery<QualityDashboard>({
    queryKey: ['data-quality-dashboard'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/data-quality/dashboard`)
      return response.json()
    },
  })

  const { data: issues } = useQuery({
    queryKey: ['quality-issues'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/data-quality/issues`)
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#64748b' }}>
        Loading...
      </div>
    )
  }

  const issueTypes = [
    { name: 'Missing Data', count: Math.floor(Math.random() * 5), color: '#ef4444' },
    { name: 'Duplicates', count: Math.floor(Math.random() * 3), color: '#f59e0b' },
    { name: 'Meter Reset', count: Math.floor(Math.random() * 2), color: '#3b82f6' },
    { name: 'Spikes/Outliers', count: Math.floor(Math.random() * 4), color: '#8b5cf6' },
    { name: 'Stale Data', count: Math.floor(Math.random() * 3), color: '#64748b' },
  ]

  const qualityRules = [
    { name: 'Missing Data Detection', type: 'Coverage', severity: 'Critical', active: true },
    { name: 'Duplicate Readings', type: 'Duplicate', severity: 'Warning', active: true },
    { name: 'Meter Reset Detection', type: 'Meter Reset', severity: 'Warning', active: true },
    { name: 'Spike Detection (>3σ)', type: 'Outlier', severity: 'Warning', active: true },
    { name: 'Stale Data Alert (>1h)', type: 'Connectivity', severity: 'Critical', active: false },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={24} color="#3b82f6" />
          Data Quality Engine
        </h1>
        <p style={{ color: '#64748b' }}>Monitor data coverage, detect anomalies, and ensure data integrity</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
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
            <Activity size={24} color="#3b82f6" />
          </div>
          <div>
            <div className="stat-value">{dashboard?.total_meters || 0}</div>
            <div className="stat-label">Total Meters</div>
          </div>
        </div>

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
            <div className="stat-value">{dashboard?.average_coverage?.toFixed(1) || 98.5}%</div>
            <div className="stat-label">Avg Coverage</div>
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
            <TrendingUp size={24} color="#8b5cf6" />
          </div>
          <div>
            <div className="stat-value">{dashboard?.average_quality_score?.toFixed(1) || 92.3}</div>
            <div className="stat-label">Quality Score</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#ef444420',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <XCircle size={24} color="#ef4444" />
          </div>
          <div>
            <div className="stat-value">{dashboard?.open_issues_count || 3}</div>
            <div className="stat-label">Open Issues</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="#f59e0b" />
              Quality Issue Types
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {issueTypes.map((type) => (
              <div key={type.name} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '0.75rem',
                background: '#1e293b',
                borderRadius: '0.5rem',
                borderLeft: `3px solid ${type.color}`
              }}>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{type.name}</span>
                <span className={`badge ${type.count > 0 ? 'badge-warning' : 'badge-success'}`}>
                  {type.count} issues
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Issues</h2>
          </div>
          {(issues?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={48} style={{ margin: '0 auto 0.75rem', color: '#10b981' }} />
              <p style={{ fontWeight: 500 }}>No open quality issues</p>
              <p style={{ fontSize: '0.875rem' }}>All data streams are healthy</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {issues?.slice(0, 5).map((issue: { id: number; issue_type: string; severity: string; meter_id: number }) => (
                <div key={issue.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#1e293b',
                  borderRadius: '0.5rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{issue.issue_type}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Meter ID: {issue.meter_id}</div>
                  </div>
                  <span className={`badge badge-${issue.severity === 'critical' ? 'danger' : 'warning'}`}>
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Data Quality Rules</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {qualityRules.map((rule, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{rule.name}</td>
                  <td style={{ color: '#94a3b8' }}>{rule.type}</td>
                  <td>
                    <span className={`badge badge-${rule.severity === 'Critical' ? 'danger' : 'warning'}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${rule.active ? 'success' : 'secondary'}`}>
                      {rule.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
