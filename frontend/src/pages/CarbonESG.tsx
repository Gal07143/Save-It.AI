import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CarbonEmission } from '../services/api'
import { Leaf, TrendingDown, Factory, Truck, Building2, Plus, Target, DollarSign, FileText, BarChart3, Layers, TreePine, Globe, Award, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b']

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Emissions Dashboard', icon: Leaf },
  { id: 'scopes', label: 'Scope 1/2/3', icon: Layers },
  { id: 'targets', label: 'Reduction Targets', icon: Target },
  { id: 'offsets', label: 'Offsets', icon: TreePine },
  { id: 'reporting', label: 'Reporting', icon: FileText },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
]

export default function CarbonESG({ currentSite }: { currentSite: number | null }) {
  const { info } = useToast()
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

  const renderEmissionsDashboard = () => (
    <>
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
    </>
  )

  const renderScopesTab = () => {
    const scopeDetails = [
      {
        scope: 'Scope 1',
        title: 'Direct Emissions',
        description: 'Emissions from sources owned or controlled by the organization',
        value: summary?.total_scope1_kg_co2 || 0,
        color: '#10b981',
        icon: Truck,
        sources: ['On-site fuel combustion', 'Company vehicles', 'Fugitive emissions', 'Process emissions']
      },
      {
        scope: 'Scope 2',
        title: 'Indirect Emissions - Energy',
        description: 'Emissions from purchased electricity, steam, heating, and cooling',
        value: summary?.total_scope2_kg_co2 || 0,
        color: '#3b82f6',
        icon: Building2,
        sources: ['Purchased electricity', 'Purchased steam', 'Purchased heating', 'Purchased cooling']
      },
      {
        scope: 'Scope 3',
        title: 'Other Indirect Emissions',
        description: 'All other indirect emissions in the value chain',
        value: summary?.total_scope3_kg_co2 || 0,
        color: '#f59e0b',
        icon: Globe,
        sources: ['Business travel', 'Employee commuting', 'Supply chain', 'Product use']
      }
    ]

    return (
      <>
        <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
          {scopeDetails.map((scope) => (
            <div key={scope.scope} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '0.75rem',
                  background: `${scope.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <scope.icon size={24} color={scope.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{scope.scope}</div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>{scope.title}</div>
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: scope.color }}>
                {(scope.value / 1000).toFixed(1)} tonnes
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>{scope.description}</p>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>EMISSION SOURCES</div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  {scope.sources.map((source) => (
                    <li key={source} style={{ marginBottom: '0.25rem' }}>{source}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Scope Breakdown</h2>
          </div>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="scope1" stackId="1" stroke="#10b981" fill="#10b981" name="Scope 1" />
                <Area type="monotone" dataKey="scope2" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Scope 2" />
                <Area type="monotone" dataKey="scope3" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Scope 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    )
  }

  const renderTargetsTab = () => {
    const targets = [
      { name: 'Net Zero by 2050', progress: 15, target: '100%', status: 'on-track', deadline: '2050' },
      { name: '50% Reduction by 2030', progress: 32, target: '50%', status: 'on-track', deadline: '2030' },
      { name: 'Scope 2 Carbon Neutral', progress: 68, target: '100%', status: 'ahead', deadline: '2028' },
      { name: 'Fleet Electrification', progress: 45, target: '100%', status: 'behind', deadline: '2027' },
    ]

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'ahead': return '#10b981'
        case 'on-track': return '#3b82f6'
        case 'behind': return '#ef4444'
        default: return '#64748b'
      }
    }

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'ahead': return CheckCircle
        case 'on-track': return Clock
        case 'behind': return AlertCircle
        default: return Clock
      }
    }

    return (
      <>
        <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
          {targets.map((target) => {
            const StatusIcon = getStatusIcon(target.status)
            return (
              <div key={target.name} className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{target.name}</h3>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Target: {target.target} by {target.deadline}</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.25rem', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '9999px',
                    background: `${getStatusColor(target.status)}20`,
                    color: getStatusColor(target.status),
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    <StatusIcon size={12} />
                    {target.status.replace('-', ' ')}
                  </div>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Progress</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{target.progress}%</span>
                  </div>
                  <div style={{ 
                    height: '8px', 
                    background: 'rgba(51, 65, 85, 0.5)', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${target.progress}%`, 
                      background: getStatusColor(target.status),
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Emission Reduction Roadmap</h2>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Target size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Configure your reduction targets and track progress over time.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => info('Add Reduction Target', 'Target configuration wizard coming soon')}>
              <Plus size={16} style={{ marginRight: '0.25rem' }} />
              Add Reduction Target
            </button>
          </div>
        </div>
      </>
    )
  }

  const renderOffsetsTab = () => {
    const offsets = [
      { project: 'Amazon Rainforest Conservation', type: 'REDD+', credits: 500, price: 15.50, status: 'Active', verified: true },
      { project: 'Wind Farm - Texas', type: 'Renewable Energy', credits: 250, price: 12.00, status: 'Active', verified: true },
      { project: 'Mangrove Restoration - Indonesia', type: 'Blue Carbon', credits: 100, price: 22.00, status: 'Pending', verified: false },
    ]

    const totalCredits = offsets.reduce((sum, o) => sum + o.credits, 0)
    const totalValue = offsets.reduce((sum, o) => sum + (o.credits * o.price), 0)

    return (
      <>
        <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TreePine size={20} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{totalCredits.toLocaleString()}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Credits</div>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${totalValue.toLocaleString()}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Investment</div>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{offsets.filter(o => o.verified).length}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Verified Projects</div>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: '#8b5cf620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={20} color="#8b5cf6" />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${(totalValue / totalCredits).toFixed(2)}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Avg. Price/Credit</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">Carbon Credit Portfolio</h2>
            <button className="btn btn-primary" onClick={() => info('Purchase Credits', 'Carbon credit marketplace coming soon')}>
              <Plus size={16} style={{ marginRight: '0.25rem' }} />
              Purchase Credits
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Type</th>
                <th>Credits (tCO2e)</th>
                <th>Price/Credit</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {offsets.map((offset) => (
                <tr key={offset.project}>
                  <td style={{ fontWeight: '500' }}>{offset.project}</td>
                  <td>{offset.type}</td>
                  <td>{offset.credits.toLocaleString()}</td>
                  <td>${offset.price.toFixed(2)}</td>
                  <td style={{ fontWeight: '500' }}>${(offset.credits * offset.price).toLocaleString()}</td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem',
                      background: offset.status === 'Active' ? '#10b98120' : '#f59e0b20',
                      color: offset.status === 'Active' ? '#10b981' : '#f59e0b'
                    }}>
                      {offset.status}
                    </span>
                  </td>
                  <td>
                    {offset.verified ? (
                      <CheckCircle size={18} color="#10b981" />
                    ) : (
                      <Clock size={18} color="#64748b" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  const renderReportingTab = () => {
    const reports = [
      { name: 'Annual ESG Report 2025', framework: 'GRI Standards', status: 'Draft', dueDate: '2026-03-31', progress: 65 },
      { name: 'CDP Climate Response', framework: 'CDP', status: 'In Progress', dueDate: '2026-07-31', progress: 30 },
      { name: 'TCFD Disclosure', framework: 'TCFD', status: 'Not Started', dueDate: '2026-06-30', progress: 0 },
      { name: 'Science Based Targets', framework: 'SBTi', status: 'Submitted', dueDate: '2025-12-31', progress: 100 },
    ]

    const getStatusStyle = (status: string) => {
      switch (status) {
        case 'Submitted': return { bg: '#10b98120', color: '#10b981' }
        case 'In Progress': return { bg: '#3b82f620', color: '#3b82f6' }
        case 'Draft': return { bg: '#f59e0b20', color: '#f59e0b' }
        default: return { bg: '#64748b20', color: '#64748b' }
      }
    }

    return (
      <>
        <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>1</div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Submitted</div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>1</div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>In Progress</div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>1</div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Draft</div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#64748b' }}>1</div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Not Started</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">ESG Disclosure Reports</h2>
            <button className="btn btn-primary" onClick={() => info('New Report', 'ESG report wizard coming soon')}>
              <Plus size={16} style={{ marginRight: '0.25rem' }} />
              New Report
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Framework</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.name}>
                  <td style={{ fontWeight: '500' }}>{report.name}</td>
                  <td>{report.framework}</td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem',
                      background: getStatusStyle(report.status).bg,
                      color: getStatusStyle(report.status).color
                    }}>
                      {report.status}
                    </span>
                  </td>
                  <td>{report.dueDate}</td>
                  <td style={{ width: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        flex: 1,
                        height: '6px', 
                        background: 'rgba(51, 65, 85, 0.5)', 
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${report.progress}%`, 
                          background: report.progress === 100 ? '#10b981' : '#3b82f6',
                          borderRadius: '3px'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{report.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  const renderBenchmarksTab = () => {
    const benchmarkData = [
      { category: 'Your Organization', scope1: 45, scope2: 120, scope3: 85, total: 250 },
      { category: 'Industry Average', scope1: 65, scope2: 180, scope3: 150, total: 395 },
      { category: 'Best in Class', scope1: 25, scope2: 60, scope3: 45, total: 130 },
    ]

    const metrics = [
      { label: 'vs Industry Average', value: '-37%', color: '#10b981', positive: true },
      { label: 'vs Best in Class', value: '+92%', color: '#ef4444', positive: false },
      { label: 'Percentile Rank', value: '28th', color: '#3b82f6', positive: true },
      { label: 'YoY Improvement', value: '-12%', color: '#10b981', positive: true },
    ]

    return (
      <>
        <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
          {metrics.map((metric) => (
            <div key={metric.label} className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: metric.color }}>{metric.value}</div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{metric.label}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Industry Comparison (tonnes CO2e)</h2>
          </div>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="scope1" fill="#10b981" name="Scope 1" />
                <Bar dataKey="scope2" fill="#3b82f6" name="Scope 2" />
                <Bar dataKey="scope3" fill="#f59e0b" name="Scope 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Peer Comparison Details</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Scope 1</th>
                <th>Scope 2</th>
                <th>Scope 3</th>
                <th>Total (tonnes)</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkData.map((row) => (
                <tr key={row.category}>
                  <td style={{ fontWeight: row.category === 'Your Organization' ? 'bold' : 'normal' }}>{row.category}</td>
                  <td>{row.scope1}</td>
                  <td>{row.scope2}</td>
                  <td>{row.scope3}</td>
                  <td style={{ fontWeight: '500' }}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

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

      <TabPanel tabs={tabs} variant="default">
        {(activeTab) => {
          switch (activeTab) {
            case 'dashboard':
              return renderEmissionsDashboard()
            case 'scopes':
              return renderScopesTab()
            case 'targets':
              return renderTargetsTab()
            case 'offsets':
              return renderOffsetsTab()
            case 'reporting':
              return renderReportingTab()
            case 'benchmarks':
              return renderBenchmarksTab()
            default:
              return renderEmissionsDashboard()
          }
        }}
      </TabPanel>
    </div>
  )
}
