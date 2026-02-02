import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Tariff } from '../services/api'
import {
  DollarSign, Plus, Clock, Zap, Trash2, Calendar, Gift, TrendingUp, Calculator,
  Upload, Search, Filter, Edit2, X, AlertTriangle, Building2
} from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

interface TariffFormData {
  site_id: number
  name: string
  tariff_type: string
  rate_per_kwh: number
  demand_rate_per_kw: number
  fixed_charge: number
  peak_rate: number
  off_peak_rate: number
  peak_hours_start: string
  peak_hours_end: string
  effective_from: string
}

export default function Tariffs({ currentSite }: { currentSite: number | null }) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [siteFilter, setSiteFilter] = useState<number | 'all'>(currentSite || 'all')
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all')

  const defaultFormData: TariffFormData = {
    site_id: currentSite || 1,
    name: '',
    tariff_type: 'flat',
    rate_per_kwh: 0.12,
    demand_rate_per_kw: 15,
    fixed_charge: 50,
    peak_rate: 0.20,
    off_peak_rate: 0.08,
    peak_hours_start: '08:00',
    peak_hours_end: '20:00',
    effective_from: new Date().toISOString().split('T')[0],
  }

  const [formData, setFormData] = useState<TariffFormData>(defaultFormData)
  const [editFormData, setEditFormData] = useState<TariffFormData>(defaultFormData)

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api.tariffs.list(),
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: api.sites.list
  })

  // Filter tariffs
  const filteredTariffs = useMemo(() => {
    if (!tariffs) return []
    return tariffs.filter(tariff => {
      const matchesSite = siteFilter === 'all' || tariff.site_id === siteFilter
      const matchesType = typeFilter === 'all' || tariff.tariff_type === typeFilter
      const matchesSearch = !searchQuery ||
        tariff.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSite && matchesType && matchesSearch
    })
  }, [tariffs, siteFilter, typeFilter, searchQuery])

  // Enrich tariffs with site names
  const tariffsWithSiteNames = useMemo(() => {
    return filteredTariffs.map(tariff => {
      const site = sites?.find(s => s.id === tariff.site_id)
      return {
        ...tariff,
        site_name: site?.name || 'Unknown Site'
      }
    })
  }, [filteredTariffs, sites])

  const createMutation = useMutation({
    mutationFn: (data: Partial<Tariff>) => api.tariffs.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariffs'] })
      setShowForm(false)
      setFormData({ ...defaultFormData, site_id: currentSite || 1 })
      success('Tariff Created', 'Tariff has been added successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to create tariff')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TariffFormData> }) => api.tariffs.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariffs'] })
      setShowEditModal(false)
      setSelectedTariff(null)
      success('Tariff Updated', 'Tariff has been updated successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to update tariff')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tariffs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariffs'] })
      setShowDeleteConfirm(false)
      setSelectedTariff(null)
      success('Tariff Deleted', 'Tariff has been deleted successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to delete tariff')
    }
  })

  const handleEdit = (tariff: Tariff) => {
    setSelectedTariff(tariff)
    setEditFormData({
      site_id: tariff.site_id,
      name: tariff.name || '',
      tariff_type: tariff.tariff_type || 'flat',
      rate_per_kwh: tariff.rate_per_kwh || 0,
      demand_rate_per_kw: tariff.demand_rate_per_kw || 0,
      fixed_charge: tariff.fixed_charge || 0,
      peak_rate: tariff.peak_rate || 0,
      off_peak_rate: tariff.off_peak_rate || 0,
      peak_hours_start: tariff.peak_hours_start || '08:00',
      peak_hours_end: tariff.peak_hours_end || '20:00',
      effective_from: tariff.effective_from || new Date().toISOString().split('T')[0],
    })
    setShowEditModal(true)
  }

  const handleDelete = (tariff: Tariff) => {
    setSelectedTariff(tariff)
    setShowDeleteConfirm(true)
  }

  const tariffTypes = [
    { value: 'flat', label: 'Flat Rate', description: 'Single rate for all hours', icon: DollarSign, color: '#10b981' },
    { value: 'tou', label: 'Time of Use (TOU)', description: 'Different rates for peak/off-peak', icon: Clock, color: '#f59e0b' },
    { value: 'tiered', label: 'Tiered/Block', description: 'Rates change based on usage', icon: Zap, color: '#8b5cf6' },
    { value: 'demand', label: 'Demand Charges', description: 'Includes peak demand charges', icon: TrendingUp, color: '#ef4444' },
  ]

  const tabs: Tab[] = [
    { id: 'rate-structures', label: 'Rate Structures', icon: DollarSign, badge: filteredTariffs.length },
    { id: 'rate-schedules', label: 'Rate Schedules', icon: Calendar },
    { id: 'holidays', label: 'Holidays', icon: Gift },
    { id: 'demand-charges', label: 'Demand Charges', icon: TrendingUp },
    { id: 'rate-simulator', label: 'Rate Simulator', icon: Calculator },
    { id: 'import-rates', label: 'Import Rates', icon: Upload },
  ]

  const renderTariffForm = (isEdit: boolean = false) => {
    const data = isEdit ? editFormData : formData
    const setData = isEdit ? setEditFormData : setFormData

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Site</label>
            <select
              value={data.site_id}
              onChange={(e) => setData({ ...data, site_id: Number(e.target.value) })}
            >
              {sites?.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tariff Name *</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="e.g., Commercial Rate 2024"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tariff Type</label>
            <select
              value={data.tariff_type}
              onChange={(e) => setData({ ...data, tariff_type: e.target.value })}
            >
              {tariffTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Effective From</label>
            <input
              type="date"
              value={data.effective_from}
              onChange={(e) => setData({ ...data, effective_from: e.target.value })}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Base Rate ($/kWh)</label>
            <input
              type="number"
              step="0.001"
              value={data.rate_per_kwh}
              onChange={(e) => setData({ ...data, rate_per_kwh: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fixed Charge ($/month)</label>
            <input
              type="number"
              step="0.01"
              value={data.fixed_charge}
              onChange={(e) => setData({ ...data, fixed_charge: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Demand Rate ($/kW)</label>
            <input
              type="number"
              step="0.01"
              value={data.demand_rate_per_kw}
              onChange={(e) => setData({ ...data, demand_rate_per_kw: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        {data.tariff_type === 'tou' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <div style={{ gridColumn: '1 / -1', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f59e0b' }}>Time of Use Settings</span>
            </div>
            <div className="form-group">
              <label className="form-label">Peak Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                value={data.peak_rate}
                onChange={(e) => setData({ ...data, peak_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Off-Peak Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                value={data.off_peak_rate}
                onChange={(e) => setData({ ...data, off_peak_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Peak Hours Start</label>
              <input
                type="time"
                value={data.peak_hours_start}
                onChange={(e) => setData({ ...data, peak_hours_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Peak Hours End</label>
              <input
                type="time"
                value={data.peak_hours_end}
                onChange={(e) => setData({ ...data, peak_hours_end: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderRateStructures = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search tariffs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: '0.875rem',
                minWidth: '180px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Filter size={16} color="#64748b" />
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Sites</option>
              {sites?.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Types</option>
            {tariffTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          Add Tariff
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">New Tariff Schedule</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData as any) }}>
            {renderTariffForm(false)}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Tariff'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {tariffTypes.map(type => {
          const Icon = type.icon
          const count = tariffs?.filter(t => t.tariff_type === type.value).length || 0
          return (
            <div
              key={type.value}
              className="card"
              style={{
                padding: '1rem',
                border: typeFilter === type.value ? `2px solid ${type.color}` : '1px solid #334155',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setTypeFilter(typeFilter === type.value ? 'all' : type.value)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={24} color={type.color} />
                  <div>
                    <div style={{ fontWeight: '600' }}>{type.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{type.description}</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: type.color }}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Active Tariff Schedules</h2>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {filteredTariffs.length} tariff{filteredTariffs.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isLoading ? (
          <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading tariffs...</p>
        ) : tariffsWithSiteNames && tariffsWithSiteNames.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Base Rate</th>
                  <th>Peak/Off-Peak</th>
                  <th>Fixed</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tariffsWithSiteNames.map((tariff) => {
                  const typeInfo = tariffTypes.find(t => t.value === tariff.tariff_type)
                  return (
                    <tr key={tariff.id}>
                      <td style={{ fontWeight: '500' }}>{tariff.name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                          <Building2 size={12} />
                          {tariff.site_name}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: `${typeInfo?.color}20`, color: typeInfo?.color, border: `1px solid ${typeInfo?.color}40` }}
                        >
                          {tariff.tariff_type.toUpperCase()}
                        </span>
                      </td>
                      <td>${tariff.rate_per_kwh?.toFixed(4)}/kWh</td>
                      <td>
                        {tariff.tariff_type === 'tou' ? (
                          <div style={{ fontSize: '0.875rem' }}>
                            <span style={{ color: '#ef4444' }}>${tariff.peak_rate?.toFixed(3)}</span>
                            {' / '}
                            <span style={{ color: '#10b981' }}>${tariff.off_peak_rate?.toFixed(3)}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>N/A</span>
                        )}
                      </td>
                      <td>${tariff.fixed_charge?.toFixed(2) || '0.00'}</td>
                      <td style={{ fontSize: '0.875rem' }}>{tariff.effective_from}</td>
                      <td>
                        <span className={`badge badge-${tariff.is_active ? 'success' : 'warning'}`}>
                          {tariff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem' }}
                            onClick={() => handleEdit(tariff)}
                            title="Edit tariff"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={() => handleDelete(tariff)}
                            title="Delete tariff"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <DollarSign size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>{searchQuery || siteFilter !== 'all' || typeFilter !== 'all' ? 'No tariffs match your filters' : 'No tariffs configured yet. Add your first tariff schedule above.'}</p>
          </div>
        )}
      </div>
    </>
  )

  const renderPlaceholder = (icon: React.ElementType, title: string, description: string) => {
    const Icon = icon
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <Icon size={64} style={{ marginBottom: '1.5rem', color: '#10b981', opacity: 0.6 }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>{title}</h3>
        <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>{description}</p>
      </div>
    )
  }

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'rate-structures':
        return renderRateStructures()
      case 'rate-schedules':
        return renderPlaceholder(
          Calendar,
          'Rate Schedules',
          'Configure time-based rate calendars with seasonal adjustments, weekday/weekend variations, and special rate periods throughout the year.'
        )
      case 'holidays':
        return renderPlaceholder(
          Gift,
          'Holiday Rate Exceptions',
          'Define holidays and special dates when alternative rate structures apply. Configure off-peak rates for major holidays and custom observance dates.'
        )
      case 'demand-charges':
        return renderPlaceholder(
          TrendingUp,
          'Demand Charges',
          'Track and manage peak demand charges. Monitor 15-minute demand intervals, set demand thresholds, and analyze peak load patterns to minimize demand costs.'
        )
      case 'rate-simulator':
        return renderPlaceholder(
          Calculator,
          'Rate Simulator',
          'Compare "what-if" scenarios across different rate structures. Simulate how changes in consumption patterns or rate plans would impact your energy costs.'
        )
      case 'import-rates':
        return renderPlaceholder(
          Upload,
          'Import Utility Rates',
          'Import rate schedules directly from utility rate sheets. Supports CSV, Excel, and common utility format imports for quick rate configuration.'
        )
      default:
        return renderRateStructures()
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Tariff Management</h1>
        <p style={{ color: '#64748b' }}>Configure electricity rate schedules and pricing structures</p>
      </div>

      <TabPanel tabs={tabs} variant="default">
        {renderTabContent}
      </TabPanel>

      {/* Edit Modal */}
      {showEditModal && selectedTariff && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tariff</h2>
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {renderTariffForm(true)}

              <button
                className="btn btn-primary"
                onClick={() => updateMutation.mutate({ id: selectedTariff.id, data: editFormData })}
                disabled={updateMutation.isPending}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Tariff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTariff && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Tariff</h2>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete this tariff?</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '1rem' }}>{selectedTariff.name}</p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                This action cannot be undone. Sites using this tariff may be affected.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => deleteMutation.mutate(selectedTariff.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1e293b;
          border-radius: 0.75rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #334155;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 0.75rem;
        }

        .form-group label,
        .form-label {
          display: block;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #0f172a;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          color: #f8fafc;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #10b981;
        }
      `}</style>
    </div>
  )
}
