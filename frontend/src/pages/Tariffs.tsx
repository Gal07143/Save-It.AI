import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Tariff } from '../services/api'
import { DollarSign, Plus, Clock, Zap, Trash2, Calendar, Gift, TrendingUp, Calculator, Upload } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'

export default function Tariffs({ currentSite }: { currentSite: number | null }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
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
  })

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ['tariffs', currentSite],
    queryFn: () => api.tariffs.list(currentSite || undefined),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Tariff>) => api.tariffs.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariffs'] })
      setShowForm(false)
      setFormData({
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
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tariffs.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tariffs'] }),
  })

  const tariffTypes = [
    { value: 'flat', label: 'Flat Rate', description: 'Single rate for all hours' },
    { value: 'tou', label: 'Time of Use (TOU)', description: 'Different rates for peak/off-peak' },
    { value: 'tiered', label: 'Tiered/Block', description: 'Rates change based on usage' },
    { value: 'demand', label: 'Demand Charges', description: 'Includes peak demand charges' },
  ]

  const tabs: Tab[] = [
    { id: 'rate-structures', label: 'Rate Structures', icon: DollarSign },
    { id: 'rate-schedules', label: 'Rate Schedules', icon: Calendar },
    { id: 'holidays', label: 'Holidays', icon: Gift },
    { id: 'demand-charges', label: 'Demand Charges', icon: TrendingUp },
    { id: 'rate-simulator', label: 'Rate Simulator', icon: Calculator },
    { id: 'import-rates', label: 'Import Rates', icon: Upload },
  ]

  const renderRateStructures = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
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
            <div className="grid grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tariff Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Commercial Rate 2024"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tariff Type</label>
                <select
                  className="form-input"
                  value={formData.tariff_type}
                  onChange={(e) => setFormData({ ...formData, tariff_type: e.target.value })}
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
                  className="form-input"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Base Rate ($/kWh)</label>
                <input
                  type="number"
                  step="0.001"
                  className="form-input"
                  value={formData.rate_per_kwh}
                  onChange={(e) => setFormData({ ...formData, rate_per_kwh: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fixed Charge ($/month)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.fixed_charge}
                  onChange={(e) => setFormData({ ...formData, fixed_charge: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Demand Rate ($/kW)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.demand_rate_per_kw}
                  onChange={(e) => setFormData({ ...formData, demand_rate_per_kw: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Site ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            {formData.tariff_type === 'tou' && (
              <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Peak Rate ($/kWh)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    value={formData.peak_rate}
                    onChange={(e) => setFormData({ ...formData, peak_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Off-Peak Rate ($/kWh)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    value={formData.off_peak_rate}
                    onChange={(e) => setFormData({ ...formData, off_peak_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Peak Hours Start</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.peak_hours_start}
                    onChange={(e) => setFormData({ ...formData, peak_hours_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Peak Hours End</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.peak_hours_end}
                    onChange={(e) => setFormData({ ...formData, peak_hours_end: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Tariff'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        {tariffTypes.map(type => (
          <div key={type.value} className="card" style={{ 
            padding: '1rem',
            border: formData.tariff_type === type.value ? '2px solid #1e40af' : '1px solid #e2e8f0',
            cursor: 'pointer'
          }} onClick={() => setFormData({ ...formData, tariff_type: type.value })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {type.value === 'flat' && <DollarSign size={24} color="#10b981" />}
              {type.value === 'tou' && <Clock size={24} color="#f59e0b" />}
              {type.value === 'tiered' && <Zap size={24} color="#8b5cf6" />}
              {type.value === 'demand' && <Zap size={24} color="#ef4444" />}
              <div>
                <div style={{ fontWeight: '600' }}>{type.label}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{type.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Active Tariff Schedules</h2>
        </div>
        {isLoading ? (
          <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading tariffs...</p>
        ) : tariffs && tariffs.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Base Rate</th>
                <th>Demand Rate</th>
                <th>Fixed Charge</th>
                <th>Effective From</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((tariff) => (
                <tr key={tariff.id}>
                  <td style={{ fontWeight: '500' }}>{tariff.name}</td>
                  <td>
                    <span className={`badge ${tariff.tariff_type === 'tou' ? 'badge-warning' : 'badge-info'}`}>
                      {tariff.tariff_type.toUpperCase()}
                    </span>
                  </td>
                  <td>${tariff.rate_per_kwh?.toFixed(4)}/kWh</td>
                  <td>${tariff.demand_rate_per_kw?.toFixed(2) || '0.00'}/kW</td>
                  <td>${tariff.fixed_charge?.toFixed(2) || '0.00'}</td>
                  <td>{tariff.effective_from}</td>
                  <td>
                    <span className={`badge ${tariff.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {tariff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem' }}
                      onClick={() => deleteMutation.mutate(tariff.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <DollarSign size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No tariffs configured yet. Add your first tariff schedule above.</p>
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
    </div>
  )
}
