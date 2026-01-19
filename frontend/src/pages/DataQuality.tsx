import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Activity, TrendingUp, Wrench, BookOpen, Clock, FileText } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

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
  const { success, info } = useToast()
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

  const tabs: Tab[] = [
    { id: 'dashboard', label: 'Quality Dashboard', icon: ShieldCheck },
    { id: 'issues', label: 'Issues', icon: AlertTriangle, badge: dashboard?.open_issues_count || 0 },
    { id: 'resolution', label: 'Resolution', icon: Wrench },
    { id: 'rules', label: 'Rules', icon: BookOpen },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'audit', label: 'Audit Log', icon: FileText },
  ]

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
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

            <div className="grid grid-2">
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
          </>
        )

      case 'issues':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="#f59e0b" />
                Active Data Quality Issues
              </h2>
            </div>
            {(issues?.length || 0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <CheckCircle size={64} style={{ margin: '0 auto 1rem', color: '#10b981' }} />
                <p style={{ fontWeight: 500, fontSize: '1.125rem' }}>No active issues</p>
                <p style={{ fontSize: '0.875rem' }}>All data streams are operating normally</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Issue ID</th>
                      <th>Type</th>
                      <th>Meter ID</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues?.map((issue: { id: number; issue_type: string; severity: string; meter_id: number }) => (
                      <tr key={issue.id}>
                        <td style={{ fontWeight: 500 }}>#{issue.id}</td>
                        <td>{issue.issue_type}</td>
                        <td style={{ color: '#94a3b8' }}>Meter {issue.meter_id}</td>
                        <td>
                          <span className={`badge badge-${issue.severity === 'critical' ? 'danger' : 'warning'}`}>
                            {issue.severity}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-warning">Open</span>
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => info(`Viewing details for issue #${issue.id}`, `Type: ${issue.issue_type}`)}>
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'resolution':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wrench size={18} color="#10b981" />
                Issue Resolution Tracking
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Wrench size={64} style={{ margin: '0 auto 1rem', color: '#64748b' }} />
              <p style={{ fontWeight: 500, fontSize: '1.125rem' }}>Resolution Tracking</p>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Track and manage issue resolution workflows</p>
              <div className="grid grid-3" style={{ maxWidth: '600px', margin: '0 auto', gap: '1rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>0</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>In Progress</div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>0</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pending Review</div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>0</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Resolved Today</div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'rules':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="#3b82f6" />
                Data Quality Rules
              </h2>
              <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => info('Add Rule', 'Rule configuration dialog coming soon')}>
                + Add Rule
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }} onClick={() => info(`Edit Rule: ${rule.name}`, 'Rule editor coming soon')}>
                          Edit
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => success(`Rule ${rule.active ? 'disabled' : 'enabled'}`, `${rule.name} has been ${rule.active ? 'disabled' : 'enabled'}`)}>
                          {rule.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'trends':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="#8b5cf6" />
                Quality Trends Over Time
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <TrendingUp size={64} style={{ margin: '0 auto 1rem', color: '#8b5cf6' }} />
              <p style={{ fontWeight: 500, fontSize: '1.125rem' }}>Quality Trends Analysis</p>
              <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>Monitor data quality metrics over time</p>
              <div className="grid grid-4" style={{ maxWidth: '800px', margin: '0 auto', gap: '1rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>+2.3%</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Coverage (7d)</div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>+1.8%</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Quality Score (7d)</div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>-15%</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Issues (7d)</div>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6' }}>4.2h</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Avg Resolution Time</div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'audit':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="#f59e0b" />
                Audit Log
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { action: 'Rule Updated', description: 'Missing Data Detection threshold changed', user: 'System', time: '2 hours ago', type: 'config' },
                { action: 'Issue Resolved', description: 'Duplicate readings issue #142 resolved', user: 'Admin', time: '5 hours ago', type: 'resolution' },
                { action: 'Rule Created', description: 'New spike detection rule added', user: 'Admin', time: '1 day ago', type: 'config' },
                { action: 'Issue Detected', description: 'Stale data detected on Meter #87', user: 'System', time: '1 day ago', type: 'issue' },
                { action: 'Quality Report', description: 'Weekly quality report generated', user: 'System', time: '2 days ago', type: 'report' },
              ].map((log, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#1e293b',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Clock size={16} color="#64748b" />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{log.action}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.description}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.user}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={24} color="#3b82f6" />
          Data Quality Engine
        </h1>
        <p style={{ color: '#64748b' }}>Monitor data coverage, detect anomalies, and ensure data integrity</p>
      </div>

      <TabPanel tabs={tabs} variant="underline">
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
