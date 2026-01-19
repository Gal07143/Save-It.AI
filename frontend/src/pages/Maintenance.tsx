import { useQuery } from '@tanstack/react-query'
import { Wrench, AlertTriangle, CheckCircle, Clock, ThermometerSun, Zap, Activity, Shield, Calendar, ClipboardList, Heart, History, DollarSign } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'

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

  const tabs: Tab[] = [
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: openAlerts > 0 ? openAlerts : undefined },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'asset-condition', label: 'Asset Condition', icon: Heart },
    { id: 'history', label: 'History', icon: History },
    { id: 'costs', label: 'Costs', icon: DollarSign },
  ]

  const scheduledMaintenance = [
    { id: 1, asset: 'Transformer T-001', type: 'Preventive', date: '2026-01-25', technician: 'John Smith', priority: 'medium' },
    { id: 2, asset: 'HVAC Unit AC-003', type: 'Inspection', date: '2026-01-22', technician: 'Sarah Johnson', priority: 'low' },
    { id: 3, asset: 'Generator GEN-002', type: 'Oil Change', date: '2026-01-28', technician: 'Mike Davis', priority: 'high' },
  ]

  const workOrders = [
    { id: 'WO-2026-001', asset: 'Compressor CP-005', issue: 'Unusual vibration detected', status: 'in_progress', assignee: 'Tech Team A', created: '2026-01-18' },
    { id: 'WO-2026-002', asset: 'Pump P-012', issue: 'Seal replacement required', status: 'pending', assignee: 'Unassigned', created: '2026-01-17' },
    { id: 'WO-2026-003', asset: 'Motor M-008', issue: 'Bearing noise investigation', status: 'completed', assignee: 'Tech Team B', created: '2026-01-15' },
  ]

  const maintenanceHistory = [
    { id: 1, asset: 'Transformer T-001', type: 'Corrective', date: '2026-01-10', duration: '4h', cost: '$1,250', outcome: 'success' },
    { id: 2, asset: 'HVAC Unit AC-002', type: 'Preventive', date: '2026-01-08', duration: '2h', cost: '$450', outcome: 'success' },
    { id: 3, asset: 'Generator GEN-001', type: 'Emergency', date: '2026-01-05', duration: '8h', cost: '$3,200', outcome: 'success' },
    { id: 4, asset: 'Pump P-007', type: 'Preventive', date: '2026-01-02', duration: '1.5h', cost: '$320', outcome: 'success' },
  ]

  const costData = {
    monthly: { labor: 12500, parts: 8750, external: 4200, total: 25450 },
    ytd: { labor: 12500, parts: 8750, external: 4200, total: 25450 },
    budget: { allocated: 300000, spent: 25450, remaining: 274550 },
  }

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'alerts':
        return (
          <>
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
          </>
        )

      case 'schedule':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="#3b82f6" />
                Planned Maintenance Calendar
              </h2>
              <button className="btn btn-primary">Schedule New</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Scheduled Date</th>
                    <th>Technician</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledMaintenance.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.asset}</td>
                      <td>{item.type}</td>
                      <td>{item.date}</td>
                      <td>{item.technician}</td>
                      <td>
                        <span className={`badge badge-${item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'success'}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Edit</button>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'work-orders':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={18} color="#8b5cf6" />
                Work Orders
              </h2>
              <button className="btn btn-primary">Create Work Order</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Work Order ID</th>
                    <th>Asset</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Assignee</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => (
                    <tr key={wo.id}>
                      <td style={{ fontWeight: 500, color: '#10b981' }}>{wo.id}</td>
                      <td>{wo.asset}</td>
                      <td>{wo.issue}</td>
                      <td>
                        <span className={`badge badge-${wo.status === 'completed' ? 'success' : wo.status === 'in_progress' ? 'warning' : 'secondary'}`}>
                          {wo.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{wo.assignee}</td>
                      <td>{wo.created}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>View</button>
                          <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Assign</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'asset-condition':
        return (
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
        )

      case 'history':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#64748b" />
                Past Maintenance Records
              </h2>
              <button className="btn btn-outline">Export History</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Cost</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceHistory.map((record) => (
                    <tr key={record.id}>
                      <td style={{ fontWeight: 500 }}>{record.asset}</td>
                      <td>
                        <span className={`badge badge-${record.type === 'Emergency' ? 'danger' : record.type === 'Corrective' ? 'warning' : 'success'}`}>
                          {record.type}
                        </span>
                      </td>
                      <td>{record.date}</td>
                      <td>{record.duration}</td>
                      <td>{record.cost}</td>
                      <td>
                        <span className="badge badge-success">{record.outcome}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'costs':
        return (
          <div>
            <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Monthly Costs</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: '#94a3b8' }}>Labor</span>
                    <span style={{ fontWeight: 500 }}>${costData.monthly.labor.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: '#94a3b8' }}>Parts & Materials</span>
                    <span style={{ fontWeight: 500 }}>${costData.monthly.parts.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: '#94a3b8' }}>External Services</span>
                    <span style={{ fontWeight: 500 }}>${costData.monthly.external.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', background: '#1e293b', borderRadius: '0.5rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Total</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>${costData.monthly.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Budget Status</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Annual Budget</span>
                      <span style={{ fontSize: '0.875rem' }}>${costData.budget.allocated.toLocaleString()}</span>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '0.5rem', height: '8px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${(costData.budget.spent / costData.budget.allocated) * 100}%`, 
                        background: '#10b981', 
                        height: '100%',
                        borderRadius: '0.5rem'
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Spent</div>
                      <div style={{ fontWeight: 600, color: '#f59e0b' }}>${costData.budget.spent.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Remaining</div>
                      <div style={{ fontWeight: 600, color: '#10b981' }}>${costData.budget.remaining.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Cost Insights</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Avg Cost per Work Order</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>$1,305</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Preventive vs Corrective</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>65% / 35%</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cost Trend</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#10b981' }}>-12% vs last month</div>
                  </div>
                </div>
              </div>
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

      <TabPanel tabs={tabs} variant="underline">
        {renderTabContent}
      </TabPanel>

      <style>{`
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        .grid-5 {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
        }
        @media (max-width: 1024px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
          .grid-5 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 640px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
          .grid-5 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}
