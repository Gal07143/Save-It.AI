import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Sun, Zap, TrendingUp, AlertTriangle, Thermometer, 
  Activity, RefreshCw, Clock, ArrowUpRight, Settings,
  CloudSun, Gauge, CheckCircle
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts'

const API_BASE = '/api/v1'

const generateDailyProduction = () => Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  production: i > 5 && i < 20 ? Math.round(Math.sin((i - 5) / 14 * Math.PI) * 85 + Math.random() * 10) : 0,
  forecast: i > 5 && i < 20 ? Math.round(Math.sin((i - 5) / 14 * Math.PI) * 80) : 0,
  irradiance: i > 5 && i < 20 ? Math.round(Math.sin((i - 5) / 14 * Math.PI) * 950 + Math.random() * 50) : 0,
}))

const generateMonthlyProduction = () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => ({
  month,
  production: Math.round(2000 + Math.sin((i + 3) / 6 * Math.PI) * 1500 + Math.random() * 200),
  expected: Math.round(2200 + Math.sin((i + 3) / 6 * Math.PI) * 1400),
}))

interface Site { id: number; name: string }
interface Asset { id: number; name: string; asset_type: string }
interface Meter { id: number; meter_id: string; meter_type: string; site_id: number }

export default function PVSystems() {
  const [dailyData, setDailyData] = useState(generateDailyProduction())
  const [monthlyData] = useState(generateMonthlyProduction())
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSite, setSelectedSite] = useState<number | null>(null)

  const { data: sites } = useQuery<Site[]>({ 
    queryKey: ['sites'], 
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sites`)
      return res.json()
    }
  })

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets', selectedSite],
    queryFn: async () => {
      const url = selectedSite ? `${API_BASE}/assets?site_id=${selectedSite}` : `${API_BASE}/assets`
      const res = await fetch(url)
      return res.json()
    },
    enabled: !!selectedSite
  })

  const { data: meters } = useQuery<Meter[]>({
    queryKey: ['meters', selectedSite],
    queryFn: async () => {
      const url = selectedSite ? `${API_BASE}/meters?site_id=${selectedSite}` : `${API_BASE}/meters`
      const res = await fetch(url)
      return res.json()
    },
    enabled: !!selectedSite
  })

  // These filters are available for future API integration
  void assets?.filter(a => a.asset_type?.toLowerCase().includes('solar') || a.asset_type?.toLowerCase().includes('pv'))
  void meters?.filter(m => m.meter_type?.toLowerCase().includes('generation') || m.meter_type?.toLowerCase().includes('solar'))

  useEffect(() => {
    const interval = setInterval(() => {
      setDailyData(generateDailyProduction())
      setLastUpdate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setDailyData(generateDailyProduction())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const currentHour = new Date().getHours()
  const currentProduction = dailyData[currentHour]?.production || 0
  const todayTotal = dailyData.reduce((sum, d) => sum + d.production, 0)
  const monthlyTotal = monthlyData.reduce((sum, d) => sum + d.production, 0)
  const performanceRatio = 0.82 + Math.random() * 0.08

  const inverters = [
    { id: 1, name: 'Inverter A', capacity: 50, output: 42.5 + Math.random() * 5, status: 'online', temp: 38 + Math.random() * 8 },
    { id: 2, name: 'Inverter B', capacity: 50, output: 44.2 + Math.random() * 4, status: 'online', temp: 40 + Math.random() * 6 },
    { id: 3, name: 'Inverter C', capacity: 50, output: 0, status: 'offline', temp: 25 },
    { id: 4, name: 'Inverter D', capacity: 25, output: 21.8 + Math.random() * 3, status: 'warning', temp: 52 },
  ]

  const panelStrings = [
    { id: 1, name: 'String 1A', panels: 20, efficiency: 96.5, output: 8.2 },
    { id: 2, name: 'String 1B', panels: 20, efficiency: 94.2, output: 7.9 },
    { id: 3, name: 'String 2A', panels: 20, efficiency: 97.1, output: 8.4 },
    { id: 4, name: 'String 2B', panels: 20, efficiency: 88.5, output: 7.1 },
    { id: 5, name: 'String 3A', panels: 20, efficiency: 95.8, output: 8.1 },
    { id: 6, name: 'String 3B', panels: 20, efficiency: 92.3, output: 7.6 },
  ]

  const alerts = [
    { id: 1, type: 'warning', message: 'Inverter D operating above optimal temperature', time: '10 min ago' },
    { id: 2, type: 'info', message: 'String 2B efficiency below threshold (88.5%)', time: '2 hours ago' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sun size={24} color="#f59e0b" />
            PV Systems
          </h1>
          <p style={{ color: '#64748b' }}>Monitor solar production, panel health, and inverter status</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            className="form-input" 
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: '0.5rem 1rem' }}
          >
            <option value="">Select a site...</option>
            {sites?.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
            {(!sites || sites.length === 0) && <option disabled>No sites available</option>}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={14} />
            {lastUpdate.toLocaleTimeString()}
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} style={{ padding: '0.5rem' }}>
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Current Output</span>
            <Zap size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{currentProduction} kW</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>of 175 kWp capacity</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Today's Production</span>
            <TrendingUp size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{todayTotal} kWh</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
            <ArrowUpRight size={14} />
            <span>+12% vs yesterday</span>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Performance Ratio</span>
            <Gauge size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{(performanceRatio * 100).toFixed(1)}%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Target: 85%</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Year to Date</span>
            <Sun size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{(monthlyTotal / 1000).toFixed(1)} MWh</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>$18,420 revenue</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Activity size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Real-Time Production
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
              Live
            </span>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="production" stroke="#f59e0b" fill="url(#colorProduction)" name="Actual (kW)" />
                <Line type="monotone" dataKey="forecast" stroke="#94a3b8" strokeDasharray="5 5" name="Forecast (kW)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <CloudSun size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Production Forecast
            </h2>
          </div>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              {['Today', 'Tomorrow', 'Day 3', 'Day 4'].map((day, i) => (
                <div key={day} style={{ 
                  background: '#1e293b', 
                  borderRadius: '0.5rem', 
                  padding: '0.75rem', 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{day}</div>
                  <CloudSun size={24} style={{ color: i === 2 ? '#94a3b8' : '#f59e0b', margin: '0.25rem auto' }} />
                  <div style={{ fontWeight: 'bold' }}>{Math.round(400 + Math.random() * 200 - (i === 2 ? 150 : 0))} kWh</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{i === 2 ? 'Cloudy' : 'Sunny'}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Weekly Forecast</span>
                <span style={{ fontWeight: 'bold' }}>2,850 kWh</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Expected Revenue</span>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>$342</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h2 className="card-title">Inverter Status</h2>
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
              <Settings size={14} style={{ marginRight: '0.25rem' }} />
              Configure
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {inverters.map(inv => (
              <div key={inv.id} style={{ 
                background: '#1e293b', 
                borderRadius: '0.5rem', 
                padding: '1rem',
                borderLeft: `3px solid ${inv.status === 'online' ? '#10b981' : inv.status === 'warning' ? '#f59e0b' : '#ef4444'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500' }}>{inv.name}</span>
                  <span className={`badge badge-${inv.status === 'online' ? 'success' : inv.status === 'warning' ? 'warning' : 'danger'}`}>
                    {inv.status}
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {inv.output.toFixed(1)} kW
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  of {inv.capacity} kW capacity
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: inv.temp > 50 ? '#f59e0b' : '#94a3b8' }}>
                  <Thermometer size={12} />
                  {inv.temp.toFixed(0)}°C
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <AlertTriangle size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Active Alerts
            </h2>
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
              <p>All systems nominal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts.map(alert => (
                <div key={alert.id} style={{ 
                  background: '#1e293b', 
                  borderRadius: '0.5rem', 
                  padding: '0.75rem',
                  borderLeft: `3px solid ${alert.type === 'warning' ? '#f59e0b' : '#3b82f6'}`
                }}>
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{alert.message}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{alert.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Panel String Performance</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>String</th>
                <th>Panels</th>
                <th>Output (kW)</th>
                <th>Efficiency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {panelStrings.map(str => (
                <tr key={str.id}>
                  <td style={{ fontWeight: '500' }}>{str.name}</td>
                  <td>{str.panels}</td>
                  <td>{str.output.toFixed(1)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '60px', 
                        height: '6px', 
                        background: '#374151', 
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${str.efficiency}%`, 
                          height: '100%', 
                          background: str.efficiency > 95 ? '#10b981' : str.efficiency > 90 ? '#f59e0b' : '#ef4444',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '0.875rem' }}>{str.efficiency}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${str.efficiency > 95 ? 'success' : str.efficiency > 90 ? 'warning' : 'danger'}`}>
                      {str.efficiency > 95 ? 'Optimal' : str.efficiency > 90 ? 'Degraded' : 'Low'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      `}</style>
    </div>
  )
}
