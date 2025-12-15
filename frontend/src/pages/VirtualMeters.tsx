import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, Plus, Settings, Zap, Code, Layers } from 'lucide-react'

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
  const [showCreateModal, setShowCreateModal] = useState(false)
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
          <h2 className="card-title">Virtual Meters</h2>
        </div>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading...</div>
        ) : (virtualMeters?.length || 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <Calculator size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No virtual meters created yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Create virtual meters to calculate derived values</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ marginTop: '1rem' }}
            >
              Create Your First Virtual Meter
            </button>
          </div>
        ) : (
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
                {virtualMeters?.map((vm) => (
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
                      <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
              <button className="btn btn-primary">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
