import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Building2, Gauge, Receipt, AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const mockEnergyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  consumption: Math.round(100 + Math.random() * 150 + (i > 8 && i < 18 ? 100 : 0)),
  solar: i > 6 && i < 19 ? Math.round(Math.sin((i - 6) / 12 * Math.PI) * 80) : 0,
}))

const mockMonthlyData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
  month,
  consumption: Math.round(10000 + Math.random() * 5000),
  cost: Math.round(1500 + Math.random() * 800),
}))

export default function Dashboard() {
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: meters } = useQuery({ queryKey: ['meters'], queryFn: () => api.meters.list() })
  const { data: bills } = useQuery({ queryKey: ['bills'], queryFn: () => api.bills.list() })
  const { data: notifications } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: () => api.notifications.list(undefined, true) 
  })

  const stats = [
    { label: 'Sites', value: sites?.length || 0, icon: Building2, color: '#1e40af' },
    { label: 'Active Meters', value: meters?.filter(m => m.is_active).length || 0, icon: Gauge, color: '#10b981' },
    { label: 'Pending Bills', value: bills?.filter(b => !b.is_validated).length || 0, icon: Receipt, color: '#f59e0b' },
    { label: 'Active Alerts', value: notifications?.length || 0, icon: AlertTriangle, color: '#ef4444' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Energy Dashboard</h1>
        <p style={{ color: '#64748b' }}>Monitor and optimize your energy consumption</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.5rem',
              background: `${stat.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <stat.icon size={24} color={stat.color} />
            </div>
            <div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Zap size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Today's Load Profile
            </h2>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockEnergyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="consumption" stroke="#1e40af" fill="#1e40af" fillOpacity={0.3} name="Load (kW)" />
                <Area type="monotone" dataKey="solar" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Solar (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <TrendingUp size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Monthly Energy & Cost
            </h2>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="consumption" fill="#1e40af" name="kWh" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="cost" fill="#10b981" name="Cost ($)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Alerts</h2>
            <a href="/notifications" style={{ color: '#1e40af', textDecoration: 'none', fontSize: '0.875rem' }}>View All</a>
          </div>
          {notifications && notifications.length > 0 ? (
            <div>
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #e2e8f0',
                }}>
                  <AlertTriangle size={16} color={n.severity === 'critical' ? '#ef4444' : '#f59e0b'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{n.message}</div>
                  </div>
                  <span className={`badge badge-${n.severity === 'critical' ? 'danger' : 'warning'}`}>
                    {n.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No active alerts</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <a href="/gap-analysis" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              Run Gap Analysis
            </a>
            <a href="/bess" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              BESS Simulation
            </a>
            <a href="/bills" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              Upload Bill
            </a>
            <a href="/tenants" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              Generate Invoices
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
