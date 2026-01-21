import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { api } from '../services/api'
import { 
  Building2, Gauge, Receipt, AlertTriangle, TrendingUp, Zap, 
  Leaf, RefreshCw, Clock, ArrowUpRight, ArrowDownRight,
  Target, Battery, Sun, Activity
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

const generateEnergyData = () => Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  consumption: Math.round(100 + Math.random() * 150 + (i > 8 && i < 18 ? 100 : 0)),
  solar: i > 6 && i < 19 ? Math.round(Math.sin((i - 6) / 12 * Math.PI) * 80) : 0,
}))

const monthlyData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => ({
  month,
  consumption: Math.round(10000 + Math.random() * 5000 - (i > 4 && i < 9 ? 2000 : 0)),
  cost: Math.round(1500 + Math.random() * 800 - (i > 4 && i < 9 ? 300 : 0)),
  lastYear: Math.round(12000 + Math.random() * 4000),
}))

const energyMix = [
  { name: 'Grid', value: 65, color: '#6366f1' },
  { name: 'Solar', value: 25, color: '#10b981' },
  { name: 'Battery', value: 10, color: '#f59e0b' },
]

export default function Dashboard() {
  const [energyData, setEnergyData] = useState(generateEnergyData())
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: meters } = useQuery({ queryKey: ['meters'], queryFn: () => api.meters.list() })
  const { data: bills } = useQuery({ queryKey: ['bills'], queryFn: () => api.bills.list() })
  const { data: notifications } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: () => api.notifications.list(undefined, true) 
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setEnergyData(generateEnergyData())
      setLastUpdate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setEnergyData(generateEnergyData())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const totalYtdConsumption = monthlyData.slice(0, new Date().getMonth() + 1).reduce((a, b) => a + b.consumption, 0)
  const totalYtdCost = monthlyData.slice(0, new Date().getMonth() + 1).reduce((a, b) => a + b.cost, 0)
  const lastYearSamePeriod = monthlyData.slice(0, new Date().getMonth() + 1).reduce((a, b) => a + b.lastYear, 0)
  const savingsPercent = ((lastYearSamePeriod - totalYtdConsumption) / lastYearSamePeriod * 100).toFixed(1)
  const estimatedSavings = Math.round((lastYearSamePeriod - totalYtdConsumption) * 0.12)

  const stats = [
    { label: 'Sites', value: sites?.length || 0, icon: Building2, color: '#6366f1' },
    { label: 'Active Meters', value: meters?.filter(m => m.is_active).length || 0, icon: Gauge, color: '#10b981' },
    { label: 'Pending Bills', value: bills?.filter(b => !b.is_validated).length || 0, icon: Receipt, color: '#f59e0b' },
    { label: 'Active Alerts', value: notifications?.length || 0, icon: AlertTriangle, color: '#ef4444' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Energy Dashboard</h1>
          <p style={{ color: '#64748b' }}>Monitor and optimize your energy consumption</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={14} />
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
          <button 
            className="btn btn-outline" 
            onClick={handleRefresh}
            style={{ padding: '0.5rem' }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>
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

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>YTD Savings vs Last Year</span>
            <ArrowDownRight size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            ${estimatedSavings.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.125rem 0.5rem', borderRadius: '999px' }}>
              {savingsPercent}% reduction
            </span>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>YTD Energy Consumption</span>
            <Zap size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {(totalYtdConsumption / 1000).toFixed(1)} MWh
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            ${totalYtdCost.toLocaleString()} total cost
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Energy Efficiency Score</span>
            <Target size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            87/100
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
            <ArrowUpRight size={14} />
            <span>+5 points this month</span>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Activity size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Real-Time Load Profile
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
              Live
            </span>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyData}>
                <defs>
                  <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="consumption" stroke="#6366f1" fill="url(#colorConsumption)" name="Load (kW)" />
                <Area type="monotone" dataKey="solar" stroke="#10b981" fill="url(#colorSolar)" name="Solar (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <TrendingUp size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Monthly Consumption Trend
            </h2>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="consumption" fill="#6366f1" name="This Year (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lastYear" fill="#374151" name="Last Year (kWh)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Energy Mix</h2>
          </div>
          <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={energyMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {energyMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  formatter={(value: number) => [`${value}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {energyMix.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                <span style={{ color: '#94a3b8' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Alerts</h2>
            <Link href="/notifications" style={{ color: '#10b981', textDecoration: 'none', fontSize: '0.875rem' }}>View All</Link>
          </div>
          {notifications && notifications.length > 0 ? (
            <div>
              {notifications.slice(0, 4).map((n) => (
                <div key={n.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #334155',
                }}>
                  <AlertTriangle size={14} color={n.severity === 'critical' ? '#ef4444' : '#f59e0b'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                  </div>
                  <span className={`badge badge-${n.severity === 'critical' ? 'danger' : 'warning'}`} style={{ fontSize: '0.625rem' }}>
                    {n.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
              <Leaf size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem' }}>No active alerts</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <Link href="/bills" className="btn btn-primary" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.875rem' }}>
              <Receipt size={16} style={{ marginRight: '0.5rem' }} />
              Scan Bill with AI
            </Link>
            <Link href="/gap-analysis" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.875rem' }}>
              <Target size={16} style={{ marginRight: '0.5rem' }} />
              Run Gap Analysis
            </Link>
            <Link href="/bess" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.875rem' }}>
              <Battery size={16} style={{ marginRight: '0.5rem' }} />
              BESS Simulation
            </Link>
            <Link href="/supplier-comparison" className="btn btn-outline" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.875rem' }}>
              <Sun size={16} style={{ marginRight: '0.5rem' }} />
              Compare Suppliers
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        
        @media (max-width: 1024px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 640px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
