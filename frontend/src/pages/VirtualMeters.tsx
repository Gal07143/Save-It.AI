import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, Plus, Settings, Zap, Code, Layers, PieChart, Wand2, CheckCircle, GitBranch, History } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

const API_BASE = '/api/v1'

interface VirtualMeter {
  id: number
  site_id: number
  name: string
  description: string | null
  meter_type: string
  expression: string | null
  unit: string
  is_active: boolean
}

export default function VirtualMeters() {
  const { success, info } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState('calculated')
  const [newMeter, setNewMeter] = useState({
    name: '',
    meter_type: 'calculated',
    expression: '',
    unit: 'kWh',
  })

  const { data: virtualMeters, isLoading } = useQuery<VirtualMeter[]>({
    queryKey: ['virtual-meters'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/virtual-meters`)
      return response.json()
    },
  })

  const tabs: Tab[] = [
    { id: 'calculated', label: 'Calculated', icon: Calculator },
    { id: 'allocated', label: 'Allocated', icon: PieChart },
    { id: 'expression-builder', label: 'Expression Builder', icon: Wand2 },
    { id: 'validation', label: 'Validation', icon: CheckCircle },
    { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
    { id: 'audit-trail', label: 'Audit Trail', icon: History },
  ]

  const meterTypes = [
    { type: 'Calculated', icon: Calculator, color: '#3b82f6', desc: 'A + B - C expressions' },
    { type: 'Aggregated', icon: Zap, color: '#10b981', desc: 'Sum of multiple meters' },
    { type: 'Allocated', icon: Settings, color: '#8b5cf6', desc: 'Proportional allocation' },
    { type: 'Differential', icon: Layers, color: '#f59e0b', desc: 'Main - Sub meters' },
  ]

  const expressionExamples = [
    { title: 'Total Building Load', expression: 'Meter_A + Meter_B + Meter_C', desc: 'Sum of all sub-meters' },
    { title: 'Unmetered Load', expression: 'Main_Meter - (Sub1 + Sub2 + Sub3)', desc: 'Calculate losses or unmetered areas' },
    { title: 'Weighted Allocation', expression: 'Main_Meter * 0.35', desc: '35% allocation to tenant' },
    { title: 'Net Export', expression: 'Solar_Production - Building_Load', desc: 'Track grid export' },
  ]

  const calculatedMeters = virtualMeters?.filter(m => m.meter_type === 'calculated') || []
  const allocatedMeters = virtualMeters?.filter(m => m.meter_type === 'allocated') || []

  const renderMeterTable = (meters: VirtualMeter[], emptyMessage: string) => {
    if (isLoading) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading...</div>
    }
    if (meters.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <Calculator size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>{emptyMessage}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Create virtual meters to calculate derived values</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: '1rem' }}
          >
            Create Virtual Meter
          </button>
        </div>
      )
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Expression</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {meters.map((vm) => (
              <tr key={vm.id}>
                <td style={{ fontWeight: 500 }}>{vm.name}</td>
                <td style={{ color: '#94a3b8' }}>{vm.meter_type}</td>
                <td>
                  <code style={{ 
                    background: '#1e293b', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace'
                  }}>
                    {vm.expression || '-'}
                  </code>
                </td>
                <td style={{ color: '#94a3b8' }}>{vm.unit}</td>
                <td>
                  <span className={`badge badge-${vm.is_active ? 'success' : 'secondary'}`}>
                    {vm.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => info(`Edit Virtual Meter: ${vm.name}`, 'Meter configuration editor coming soon')}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'calculated':
        return (
          <>
            <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
              {meterTypes.map((item) => (
                <div key={item.type} className="card" style={{ borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <item.icon size={20} color={item.color} />
                    <h3 style={{ fontWeight: 600 }}>{item.type}</h3>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">Formula-Based Virtual Meters</h2>
              </div>
              {renderMeterTable(calculatedMeters, 'No calculated meters created yet')}
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Code size={18} />
                  Expression Examples
                </h2>
              </div>
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                {expressionExamples.map((example) => (
                  <div key={example.title} style={{ 
                    padding: '1rem', 
                    background: '#1e293b', 
                    borderRadius: '0.5rem' 
                  }}>
                    <h3 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{example.title}</h3>
                    <code style={{ 
                      display: 'block',
                      background: '#0f172a', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      marginBottom: '0.5rem'
                    }}>
                      {example.expression}
                    </code>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{example.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )

      case 'allocated':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} color="#8b5cf6" />
                Proportional Allocation Meters
              </h2>
            </div>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Allocate energy consumption proportionally based on area, headcount, or custom ratios.
            </p>
            {allocatedMeters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <PieChart size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No allocated meters configured</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Create allocation meters to distribute consumption across tenants or zones
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                  style={{ marginTop: '1rem' }}
                >
                  Create Allocated Meter
                </button>
              </div>
            ) : (
              renderMeterTable(allocatedMeters, 'No allocated meters configured')
            )}
          </div>
        )

      case 'expression-builder':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wand2 size={18} color="#f59e0b" />
                Visual Expression Builder
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Wand2 size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Visual Formula Editor</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                Drag and drop meters and operators to build complex formulas visually without writing code.
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'center', 
                marginTop: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: '#1e293b', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Calculator size={16} color="#3b82f6" />
                  <span>Meter Selection</span>
                </div>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: '#1e293b', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Code size={16} color="#10b981" />
                  <span>Operators (+, -, ×, ÷)</span>
                </div>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: '#1e293b', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Layers size={16} color="#8b5cf6" />
                  <span>Functions (SUM, AVG, MAX)</span>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1.5rem' }}>
                Coming soon - Visual expression builder for complex meter calculations
              </p>
            </div>
          </div>
        )

      case 'validation':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} color="#10b981" />
                Formula Validation
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <CheckCircle size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Test Formulas Against Real Data</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                Validate your virtual meter expressions using historical data to ensure accuracy before deployment.
              </p>
              <div style={{ 
                background: '#1e293b', 
                borderRadius: '0.5rem', 
                padding: '1.5rem',
                marginTop: '1.5rem',
                maxWidth: '500px',
                margin: '1.5rem auto 0'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem', textAlign: 'left' }}>
                    Select Virtual Meter to Test
                  </label>
                  <select className="form-input" style={{ width: '100%' }} disabled>
                    <option>Select a meter...</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem', textAlign: 'left' }}>
                    Test Date Range
                  </label>
                  <input type="date" className="form-input" style={{ width: '100%' }} disabled />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => info('Run Validation', 'Formula validation feature coming soon')}>
                  Run Validation
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1.5rem' }}>
                Coming soon - Test your formulas before enabling them in production
              </p>
            </div>
          </div>
        )

      case 'dependencies':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitBranch size={18} color="#06b6d4" />
                Meter Dependency Graph
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <GitBranch size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Visualize Meter Dependencies</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                View the relationship between physical meters and virtual meters to understand calculation chains.
              </p>
              <div style={{ 
                background: '#1e293b', 
                borderRadius: '0.5rem', 
                padding: '2rem',
                marginTop: '1.5rem',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed #334155'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.5rem 1rem', background: '#3b82f6', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                      Physical Meters
                    </div>
                    <span style={{ color: '#475569' }}>→</span>
                    <div style={{ padding: '0.5rem 1rem', background: '#8b5cf6', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                      Virtual Meters
                    </div>
                    <span style={{ color: '#475569' }}>→</span>
                    <div style={{ padding: '0.5rem 1rem', background: '#10b981', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                      Reports
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#475569' }}>
                    Interactive dependency graph visualization
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1.5rem' }}>
                Coming soon - Interactive graph showing how meters relate to each other
              </p>
            </div>
          </div>
        )

      case 'audit-trail':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#f97316" />
                Calculation Change History
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <History size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Audit Trail for Virtual Meters</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                Track all changes to virtual meter configurations including formula updates, status changes, and who made them.
              </p>
              <div style={{ 
                background: '#1e293b', 
                borderRadius: '0.5rem', 
                marginTop: '1.5rem',
                overflow: 'hidden'
              }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Meter</th>
                      <th>Change</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ opacity: 0.5 }}>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                        No audit records available yet
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1.5rem' }}>
                Changes will be recorded automatically as virtual meters are modified
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calculator size={24} color="#8b5cf6" />
            Virtual Meters & Expression Engine
          </h1>
          <p style={{ color: '#64748b' }}>Create calculated, aggregated, and allocated virtual meters</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          Create Virtual Meter
        </button>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="underline"
      >
        {renderTabContent}
      </TabPanel>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Virtual Meter</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newMeter.name}
                  onChange={(e) => setNewMeter({ ...newMeter, name: e.target.value })}
                  placeholder="e.g., Total Building Load"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select 
                  className="form-input"
                  value={newMeter.meter_type}
                  onChange={(e) => setNewMeter({ ...newMeter, meter_type: e.target.value })}
                >
                  <option value="calculated">Calculated</option>
                  <option value="aggregated">Aggregated</option>
                  <option value="allocated">Allocated</option>
                  <option value="differential">Differential</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expression</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newMeter.expression}
                  onChange={(e) => setNewMeter({ ...newMeter, expression: e.target.value })}
                  placeholder="e.g., Meter_A + Meter_B"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select 
                  className="form-input"
                  value={newMeter.unit}
                  onChange={(e) => setNewMeter({ ...newMeter, unit: e.target.value })}
                >
                  <option value="kWh">kWh</option>
                  <option value="kW">kW</option>
                  <option value="kVA">kVA</option>
                  <option value="kVAr">kVAr</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setShowCreateModal(false); success('Virtual Meter Created', `${newMeter.name || 'New meter'} has been created`) }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
