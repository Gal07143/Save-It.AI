import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CarbonEmission } from '../services/api'
import { Leaf, TrendingDown, Factory, Truck, Building2, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b']

export default function CarbonESG({ currentSite }: { currentSite: number | null }) {
  const queryClient = useQueryClient()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    site_id: currentSite || 1,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    scope1_kg_co2: 0,
    scope2_kg_co2: 0,
    scope3_kg_co2: 0,
    energy_kwh: 0,
    emission_factor: 0.42,
  })

  const { data: emissions } = useQuery({
    queryKey: ['carbon-emissions', currentSite, selectedYear],
    queryFn: () => api.carbonEmissions.list(currentSite || undefined, selectedYear),
  })

  const { data: summary } = useQuery({
    queryKey: ['carbon-summary', currentSite, selectedYear],
    queryFn: () => api.carbonEmissions.summary(currentSite || undefined, selectedYear),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<CarbonEmission>) => api.carbonEmissions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carbon-emissions'] })
      queryClient.invalidateQueries({ queryKey: ['carbon-summary'] })
      setShowForm(false)
    },
  })

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const chartData = monthNames.map((month, idx) => {
    const record = emissions?.find(e => e.month === idx + 1)
    return {
      month,
      scope1: record?.scope1_kg_co2 || 0,
      scope2: record?.scope2_kg_co2 || 0,
      scope3: record?.scope3_kg_co2 || 0,
    }
  })

  const pieData = [
    { name: 'Scope 1 (Direct)', value: summary?.total_scope1_kg_co2 || 0 },
    { name: 'Scope 2 (Electricity)', value: summary?.total_scope2_kg_co2 || 0 },
    { name: 'Scope 3 (Indirect)', value: summary?.total_scope3_kg_co2 || 0 },
  ].filter(d => d.value > 0)

  const stats = [
    { 
      label: 'Total CO2 Emissions', 
      value: `${((summary?.total_emissions_kg_co2 || 0) / 1000).toFixed(1)} tonnes`,
      icon: Factory,
      color: '#ef4444',
      subtext: 'All scopes combined'
    },
    { 
      label: 'Scope 1 (Direct)', 
      value: `${((summary?.total_scope1_kg_co2 || 0) / 1000).toFixed(1)} tonnes`,
      icon: Truck,
      color: '#10b981',
      subtext: 'On-site fuel combustion'
    },
    { 
      label: 'Scope 2 (Electricity)', 
      value: `${((summary?.total_scope2_kg_co2 || 0) / 1000).toFixed(1)} tonnes`,
      icon: Building2,
      color: '#3b82f6',
      subtext: 'Purchased electricity'
    },
    { 
      label: 'Emission Intensity', 
      value: `${(summary?.emission_intensity || 0).toFixed(3)} kg/kWh`,
      icon: TrendingDown,
      color: '#8b5cf6',
      subtext: 'CO2 per unit energy'
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Leaf color="#10b981" />
            Carbon Footprint & ESG Reporting
          </h1>
          <p style={{ color: '#64748b' }}>Track greenhouse gas emissions and sustainability metrics</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            className="form-input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ width: '120px' }}
          >
            {[2025, 2024, 2023, 2022].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} style={{ marginRight: '0.25rem' }} />
            Add Record
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">New Emission Record</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData as any) }}>
            <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Month</label>
                <select
                  className="form-input"
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Energy Consumed (kWh)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.energy_kwh}
                  onChange={(e) => setFormData({ ...formData, energy_kwh: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emission Factor (kg CO2/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.emission_factor}
                  onChange={(e) => setFormData({ ...formData, emission_factor: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Scope 1 Emissions (kg CO2)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.scope1_kg_co2}
                  onChange={(e) => setFormData({ ...formData, scope1_kg_co2: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Scope 2 Emissions (kg CO2)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.scope2_kg_co2}
                  onChange={(e) => setFormData({ ...formData, scope2_kg_co2: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Scope 3 Emissions (kg CO2)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.scope3_kg_co2}
                  onChange={(e) => setFormData({ ...formData, scope3_kg_co2: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Record'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.5rem',
                background: `${stat.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{stat.value}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{stat.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{stat.subtext}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Emissions by Scope</h2>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="scope1" stackId="a" fill="#10b981" name="Scope 1" />
                <Bar dataKey="scope2" stackId="a" fill="#3b82f6" name="Scope 2" />
                <Bar dataKey="scope3" stackId="a" fill="#f59e0b" name="Scope 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Emissions by Scope</h2>
          </div>
          <div style={{ height: '300px' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                No emission data for selected year
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Emission Records</h2>
        </div>
        {emissions && emissions.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Energy (kWh)</th>
                <th>Scope 1 (kg)</th>
                <th>Scope 2 (kg)</th>
                <th>Scope 3 (kg)</th>
                <th>Total (kg)</th>
                <th>Intensity</th>
              </tr>
            </thead>
            <tbody>
              {emissions.map((e) => (
                <tr key={e.id}>
                  <td>{monthNames[e.month - 1]} {e.year}</td>
                  <td>{e.energy_kwh.toLocaleString()}</td>
                  <td>{e.scope1_kg_co2.toLocaleString()}</td>
                  <td>{e.scope2_kg_co2.toLocaleString()}</td>
                  <td>{e.scope3_kg_co2.toLocaleString()}</td>
                  <td style={{ fontWeight: '500' }}>
                    {(e.scope1_kg_co2 + e.scope2_kg_co2 + e.scope3_kg_co2).toLocaleString()}
                  </td>
                  <td>{e.emission_factor.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Leaf size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No emission records for {selectedYear}. Add your first record above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
