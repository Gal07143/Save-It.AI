import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calculator, Plus, Settings, Zap, Code, Layers, PieChart, Wand2, GitBranch, History, Trash2, Edit2 } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import { api, VirtualMeter, Meter } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

export default function VirtualMeters() {
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedVM, setSelectedVM] = useState<VirtualMeter | null>(null)
  const [activeTab, setActiveTab] = useState('calculated')
  const [newMeter, setNewMeter] = useState({
    name: '',
    site_id: 1,
    meter_type: 'formula',
    expression: '',
    unit: 'kWh',
    description: '',
  })
  const [editData, setEditData] = useState({
    name: '',
    meter_type: 'formula',
    expression: '',
    unit: 'kWh',
    description: '',
    is_active: true,
  })

  const { data: virtualMeters, isLoading } = useQuery<VirtualMeter[]>({
    queryKey: ['virtual-meters'],
    queryFn: () => api.virtualMeters.list(),
  })

  const { data: meters } = useQuery<Meter[]>({
    queryKey: ['meters'],
    queryFn: () => api.meters.list(),
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: api.sites.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newMeter) =>
      api.virtualMeters.create({
        name: data.name,
        site_id: data.site_id,
        meter_type: data.meter_type,
        expression: data.expression || undefined,
        unit: data.unit,
        description: data.description || undefined,
        components: [],
      } as Partial<VirtualMeter>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-meters'] })
      setShowCreateModal(false)
      setNewMeter({ name: '', site_id: 1, meter_type: 'formula', expression: '', unit: 'kWh', description: '' })
      success('Virtual Meter Created')
    },
    onError: (err: Error) => showError(err.message || 'Failed to create virtual meter'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editData }) =>
      api.virtualMeters.update(id, {
        name: data.name,
        meter_type: data.meter_type,
        expression: data.expression || undefined,
        unit: data.unit,
        description: data.description || undefined,
        is_active: data.is_active,
      } as Partial<VirtualMeter>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-meters'] })
      setShowEditModal(false)
      setSelectedVM(null)
      success('Virtual Meter Updated')
    },
    onError: (err: Error) => showError(err.message || 'Failed to update virtual meter'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.virtualMeters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-meters'] })
      setShowDeleteConfirm(false)
      setSelectedVM(null)
      success('Virtual Meter Deleted')
    },
    onError: (err: Error) => showError(err.message || 'Failed to delete virtual meter'),
  })

  const handleEdit = (vm: VirtualMeter) => {
    setSelectedVM(vm)
    setEditData({
      name: vm.name,
      meter_type: vm.meter_type,
      expression: vm.expression || '',
      unit: vm.unit,
      description: vm.description || '',
      is_active: vm.is_active,
    })
    setShowEditModal(true)
  }

  const handleDelete = (vm: VirtualMeter) => {
    setSelectedVM(vm)
    setShowDeleteConfirm(true)
  }

  const tabs: Tab[] = [
    { id: 'calculated', label: 'Calculated', icon: Calculator },
    { id: 'allocated', label: 'Allocated', icon: PieChart },
    { id: 'expression-builder', label: 'Expression Builder', icon: Wand2 },
    { id: 'source-meters', label: 'Source Meters', icon: Layers },
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

  const calculatedMeters = virtualMeters?.filter(m => m.meter_type !== 'allocation') || []
  const allocatedMeters = virtualMeters?.filter(m => m.meter_type === 'allocation') || []

  const renderMeterTable = (vms: VirtualMeter[], emptyMessage: string) => {
    if (isLoading) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading...</div>
    }
    if (vms.length === 0) {
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
            {vms.map((vm) => (
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
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleEdit(vm)}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(vm)}
                      title="Delete"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderSourceMetersTab = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#3b82f6" />
          Source Meters
        </h2>
      </div>
      <div style={{ padding: '1rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
          Physical meters that feed data into virtual meter calculations.
        </p>
        {meters && meters.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Meter</th>
                <th>Meter ID</th>
                <th>Active</th>
                <th>Used By</th>
              </tr>
            </thead>
            <tbody>
              {meters.map(m => {
                const usedBy = virtualMeters?.filter(vm =>
                  vm.expression?.includes(m.meter_id) || vm.expression?.includes(m.name)
                ) || []
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td><code style={{ background: '#1e293b', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.75rem' }}>{m.meter_id}</code></td>
                    <td>
                      <span className={`badge badge-${m.is_active ? 'success' : 'secondary'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      {usedBy.length > 0 ? usedBy.map(v => v.name).join(', ') : 'Not referenced'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p>No physical meters found. Create meters first to use them as sources.</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderDependenciesTab = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GitBranch size={18} color="#06b6d4" />
          Meter Dependency Graph
        </h2>
      </div>
      <div style={{ padding: '1rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
          Relationships between physical meters and virtual meters.
        </p>
        {virtualMeters && virtualMeters.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {virtualMeters.map(vm => (
              <div key={vm.id} style={{
                padding: '1rem',
                background: '#1e293b',
                borderRadius: '0.5rem',
                border: '1px solid #334155'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: vm.is_active ? '#10b981' : '#64748b'
                  }} />
                  <strong style={{ color: '#f8fafc' }}>{vm.name}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({vm.meter_type})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '1rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Expression:</span>
                  <code style={{
                    background: '#0f172a',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                  }}>
                    {vm.expression || 'No expression'}
                  </code>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <GitBranch size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p>No virtual meters created yet. Dependencies will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderAuditTrailTab = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} color="#f97316" />
          Change History
        </h2>
      </div>
      <div style={{ padding: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Virtual Meter</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {virtualMeters && virtualMeters.length > 0 ? (
              virtualMeters.map(vm => (
                <tr key={vm.id}>
                  <td style={{ fontWeight: 500 }}>{vm.name}</td>
                  <td style={{ color: '#94a3b8' }}>{vm.meter_type}</td>
                  <td>
                    <span className={`badge badge-${vm.is_active ? 'success' : 'secondary'}`}>
                      {vm.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {vm.created_at ? new Date(vm.created_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No virtual meters to show history for.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

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
            <p style={{ color: '#64748b', marginBottom: '1.5rem', padding: '0 1rem' }}>
              Allocate energy consumption proportionally based on area, headcount, or custom ratios.
            </p>
            {renderMeterTable(allocatedMeters, 'No allocated meters configured')}
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
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
                  <span>Operators (+, -, x, /)</span>
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

              <div style={{
                background: '#1e293b',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                border: '1px dashed #334155'
              }}>
                <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
                  Build Expression
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {meters?.slice(0, 6).map(m => (
                    <button key={m.id} className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}>
                      {m.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {['+', '-', '*', '/', '(', ')'].map(op => (
                    <button key={op} className="btn btn-outline btn-sm" style={{ fontFamily: 'monospace', fontWeight: 700, minWidth: '36px' }}>
                      {op}
                    </button>
                  ))}
                </div>
                <div style={{
                  padding: '0.75rem',
                  background: '#0f172a',
                  borderRadius: '0.5rem',
                  fontFamily: 'monospace',
                  color: '#f8fafc',
                  minHeight: '40px',
                  border: '1px solid #334155'
                }}>
                  <span style={{ color: '#64748b' }}>Click meters and operators above to build your expression...</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'source-meters':
        return renderSourceMetersTab()

      case 'dependencies':
        return renderDependenciesTab()

      case 'audit-trail':
        return renderAuditTrailTab()

      default:
        return null
    }
  }

  const renderFormFields = (
    data: { name: string; meter_type: string; expression: string; unit: string; description: string },
    onChange: (field: string, value: string) => void,
    showSite?: boolean,
    siteId?: number,
    onSiteChange?: (id: number) => void
  ) => (
    <>
      <div className="form-group">
        <label className="form-label">Name</label>
        <input
          type="text"
          className="form-input"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., Total Building Load"
        />
      </div>
      {showSite && (
        <div className="form-group">
          <label className="form-label">Site</label>
          <select
            className="form-input"
            value={siteId || ''}
            onChange={(e) => onSiteChange?.(Number(e.target.value))}
          >
            <option value="">Select Site</option>
            {sites?.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Type</label>
        <select
          className="form-input"
          value={data.meter_type}
          onChange={(e) => onChange('meter_type', e.target.value)}
        >
          <option value="formula">Formula</option>
          <option value="aggregation">Aggregation</option>
          <option value="allocation">Allocation</option>
          <option value="difference">Difference</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Expression</label>
        <input
          type="text"
          className="form-input"
          value={data.expression}
          onChange={(e) => onChange('expression', e.target.value)}
          placeholder="e.g., Meter_A + Meter_B"
          style={{ fontFamily: 'monospace' }}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Unit</label>
        <select
          className="form-input"
          value={data.unit}
          onChange={(e) => onChange('unit', e.target.value)}
        >
          <option value="kWh">kWh</option>
          <option value="kW">kW</option>
          <option value="kVA">kVA</option>
          <option value="kVAr">kVAr</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Description (optional)</label>
        <input
          type="text"
          className="form-input"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="What does this virtual meter calculate?"
        />
      </div>
    </>
  )

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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Virtual Meter</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {renderFormFields(
                newMeter,
                (field, value) => setNewMeter({ ...newMeter, [field]: value }),
                true,
                newMeter.site_id,
                (id) => setNewMeter({ ...newMeter, site_id: id })
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => createMutation.mutate(newMeter)}
                disabled={!newMeter.name || !newMeter.site_id || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedVM && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Virtual Meter</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {renderFormFields(
                editData,
                (field, value) => setEditData({ ...editData, [field]: value })
              )}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editData.is_active}
                    onChange={e => setEditData({ ...editData, is_active: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => updateMutation.mutate({ id: selectedVM.id, data: editData })}
                disabled={!editData.name || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => selectedVM && deleteMutation.mutate(selectedVM.id)}
        title="Delete Virtual Meter"
        message={`Are you sure you want to delete "${selectedVM?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
