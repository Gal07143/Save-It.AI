import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Sun, Zap, TrendingUp, AlertTriangle, Thermometer, 
  Activity, RefreshCw, Clock, ArrowUpRight, ArrowDownRight, Settings,
  CloudSun, Gauge, CheckCircle, Battery, Calendar, DollarSign, Bell,
  Fuel, Car, BarChart3, Shield, FileText, Wrench
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, BarChart, Bar, ComposedChart } from 'recharts'
import TabPanel, { Tab } from '../components/TabPanel'

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

const generateSocData = () => Array.from({ length: 24 }, (_, i) => {
  let soc = 50
  if (i < 6) soc = 90 - i * 5
  else if (i < 10) soc = 60 + (i - 6) * 8
  else if (i < 14) soc = 92 - (i - 10) * 3
  else if (i < 18) soc = 80 + (i - 14) * 2
  else soc = 88 - (i - 18) * 2
  return {
    hour: `${i}:00`,
    soc: Math.min(100, Math.max(10, soc + Math.random() * 5 - 2.5)),
    power: i > 6 && i < 10 ? 25 + Math.random() * 10 : i > 17 && i < 21 ? -(30 + Math.random() * 15) : Math.random() * 10 - 5,
    price: 0.08 + (i > 16 && i < 21 ? 0.12 : 0) + Math.random() * 0.02,
  }
})

const generateCycleHistory = () => Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  cycles: 0.8 + Math.random() * 0.4,
  revenue: 15 + Math.random() * 20,
}))

interface Site { id: number; name: string }
interface Asset { id: number; name: string; asset_type: string }
interface Meter { id: number; meter_id: string; meter_type: string; site_id: number }

interface EnergyAssetsProps {
  currentSite?: number | null
}

export default function EnergyAssets({ currentSite }: EnergyAssetsProps) {
  const [activeTab, setActiveTab] = useState('pv')
  const [dailyData, setDailyData] = useState(generateDailyProduction())
  const [monthlyData] = useState(generateMonthlyProduction())
  const [socData, setSocData] = useState(generateSocData())
  const [cycleHistory] = useState(generateCycleHistory())
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSite, setSelectedSite] = useState<number | null>(currentSite || null)
  const [selectedUnit, setSelectedUnit] = useState(1)
  const [showAlarmConfig, setShowAlarmConfig] = useState(false)

  const tabs: Tab[] = [
    { id: 'pv', label: 'PV Systems', icon: Sun },
    { id: 'storage', label: 'Storage Units', icon: Battery },
    { id: 'generators', label: 'Generators', icon: Fuel },
    { id: 'ev-chargers', label: 'EV Chargers', icon: Car },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'warranties', label: 'Warranties', icon: Shield },
  ]

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

  void assets?.filter(a => a.asset_type?.toLowerCase().includes('solar') || a.asset_type?.toLowerCase().includes('pv'))
  void meters?.filter(m => m.meter_type?.toLowerCase().includes('generation') || m.meter_type?.toLowerCase().includes('solar'))

  useEffect(() => {
    if (currentSite !== undefined) {
      setSelectedSite(currentSite)
    }
  }, [currentSite])

  useEffect(() => {
    const interval = setInterval(() => {
      setDailyData(generateDailyProduction())
      setSocData(generateSocData())
      setLastUpdate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setDailyData(generateDailyProduction())
    setSocData(generateSocData())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const currentHour = new Date().getHours()
  const currentProduction = dailyData[currentHour]?.production || 0
  const todayTotal = dailyData.reduce((sum, d) => sum + d.production, 0)
  const monthlyTotal = monthlyData.reduce((sum, d) => sum + d.production, 0)
  const performanceRatio = 0.82 + Math.random() * 0.08

  const currentSoc = socData[currentHour]?.soc || 75
  const currentPower = socData[currentHour]?.power || 0
  const isCharging = currentPower > 0
  const totalCycles = 342
  const warrantyLimit = 4000
  const soh = 94.5

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

  const pvAlerts = [
    { id: 1, type: 'warning', message: 'Inverter D operating above optimal temperature', time: '10 min ago' },
    { id: 2, type: 'info', message: 'String 2B efficiency below threshold (88.5%)', time: '2 hours ago' },
  ]

  const units = [
    { id: 1, name: 'BESS Unit 1', capacity: 250, soc: currentSoc, power: currentPower, status: 'online', temp: 28 },
    { id: 2, name: 'BESS Unit 2', capacity: 250, soc: 82.3, power: -45.2, status: 'online', temp: 31 },
    { id: 3, name: 'Backup UPS', capacity: 50, soc: 100, power: 0, status: 'standby', temp: 24 },
  ]

  const dispatchSchedule = [
    { time: '00:00 - 06:00', mode: 'Charge', reason: 'Off-peak rates', power: '+50 kW' },
    { time: '06:00 - 10:00', mode: 'Discharge', reason: 'Morning peak', power: '-75 kW' },
    { time: '10:00 - 16:00', mode: 'Solar Charge', reason: 'PV excess', power: '+40 kW' },
    { time: '16:00 - 21:00', mode: 'Discharge', reason: 'Evening peak', power: '-100 kW' },
    { time: '21:00 - 00:00', mode: 'Charge', reason: 'Off-peak rates', power: '+50 kW' },
  ]

  const alarms = [
    { id: 1, name: 'Low SoC', threshold: '< 20%', enabled: true, severity: 'warning' },
    { id: 2, name: 'High Temperature', threshold: '> 45°C', enabled: true, severity: 'critical' },
    { id: 3, name: 'Capacity Degradation', threshold: 'SoH < 80%', enabled: true, severity: 'warning' },
    { id: 4, name: 'Communication Loss', threshold: '> 5 min', enabled: true, severity: 'critical' },
    { id: 5, name: 'Overcharge Protection', threshold: '> 100%', enabled: true, severity: 'critical' },
    { id: 6, name: 'Cell Imbalance', threshold: '> 50mV', enabled: false, severity: 'info' },
  ]

  const storageAlerts = [
    { id: 1, type: 'info', message: 'Scheduled maintenance in 3 days', time: '1 hour ago' },
  ]

  const monthlySavings = cycleHistory.reduce((sum, d) => sum + d.revenue, 0)

  const generators = [
    { id: 1, name: 'Diesel Generator 1', capacity: 500, status: 'standby', fuelLevel: 85, runtime: 0, lastTest: '2026-01-15' },
    { id: 2, name: 'Diesel Generator 2', capacity: 500, status: 'standby', fuelLevel: 92, runtime: 0, lastTest: '2026-01-12' },
    { id: 3, name: 'Natural Gas Generator', capacity: 250, status: 'maintenance', fuelLevel: 100, runtime: 0, lastTest: '2026-01-10' },
  ]

  const evChargers = [
    { id: 1, name: 'Charger A1', type: 'DC Fast', power: 150, status: 'available', sessions: 12, energyDelivered: 458 },
    { id: 2, name: 'Charger A2', type: 'DC Fast', power: 150, status: 'charging', sessions: 15, energyDelivered: 521 },
    { id: 3, name: 'Charger B1', type: 'Level 2', power: 22, status: 'available', sessions: 28, energyDelivered: 312 },
    { id: 4, name: 'Charger B2', type: 'Level 2', power: 22, status: 'available', sessions: 31, energyDelivered: 345 },
    { id: 5, name: 'Charger C1', type: 'Level 2', power: 11, status: 'offline', sessions: 8, energyDelivered: 89 },
  ]

  const warranties = [
    { id: 1, equipment: 'PV Panels - Lot A', manufacturer: 'SunPower', installDate: '2022-03-15', warrantyEnd: '2047-03-15', coverage: 'Performance (25yr)', status: 'active' },
    { id: 2, equipment: 'PV Panels - Lot B', manufacturer: 'LG Solar', installDate: '2023-06-20', warrantyEnd: '2048-06-20', coverage: 'Performance (25yr)', status: 'active' },
    { id: 3, equipment: 'Inverters A-D', manufacturer: 'SMA', installDate: '2022-03-15', warrantyEnd: '2032-03-15', coverage: 'Parts & Labor (10yr)', status: 'active' },
    { id: 4, equipment: 'BESS Unit 1', manufacturer: 'Tesla', installDate: '2023-01-10', warrantyEnd: '2033-01-10', coverage: 'Full System (10yr)', status: 'active' },
    { id: 5, equipment: 'BESS Unit 2', manufacturer: 'Tesla', installDate: '2023-01-10', warrantyEnd: '2033-01-10', coverage: 'Full System (10yr)', status: 'active' },
    { id: 6, equipment: 'Diesel Generator 1', manufacturer: 'Caterpillar', installDate: '2021-08-01', warrantyEnd: '2026-08-01', coverage: 'Parts (5yr)', status: 'expiring' },
  ]

  const renderPVContent = () => (
    <div>
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
                  background: '#0f172a', 
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
            <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '1rem' }}>
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
                background: '#0f172a', 
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
          {pvAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
              <p>All systems nominal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pvAlerts.map(alert => (
                <div key={alert.id} style={{ 
                  background: '#0f172a', 
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
    </div>
  )

  const renderStorageContent = () => (
    <div>
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>State of Charge</span>
            <Battery size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{currentSoc.toFixed(1)}%</div>
          <div style={{ 
            width: '100%', 
            height: '6px', 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: '3px',
            marginTop: '0.5rem'
          }}>
            <div style={{ 
              width: `${currentSoc}%`, 
              height: '100%', 
              background: 'white', 
              borderRadius: '3px' 
            }}></div>
          </div>
        </div>

        <div className="card" style={{ background: `linear-gradient(135deg, ${isCharging ? '#0891b2' : '#7c3aed'} 0%, ${isCharging ? '#06b6d4' : '#a855f7'} 100%)`, border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>{isCharging ? 'Charging' : 'Discharging'}</span>
            {isCharging ? <ArrowDownRight size={20} style={{ opacity: 0.8 }} /> : <ArrowUpRight size={20} style={{ opacity: 0.8 }} />}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{Math.abs(currentPower).toFixed(1)} kW</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            {isCharging ? 'From grid/solar' : 'To building'}
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>State of Health</span>
            <Gauge size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{soh}%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            {totalCycles}/{warrantyLimit} cycles
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Monthly Savings</span>
            <DollarSign size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${monthlySavings.toFixed(0)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
            <ArrowUpRight size={14} />
            <span>+8% vs last month</span>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Activity size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              SoC & Power Profile
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
              Live
            </span>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={socData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="soc" stroke="#10b981" fill="#10b98133" name="SoC (%)" />
                <Bar yAxisId="right" dataKey="power" fill="#6366f1" name="Power (kW)" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Calendar size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Dispatch Schedule
            </h2>
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
              <Settings size={14} style={{ marginRight: '0.25rem' }} />
              Edit
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dispatchSchedule.map((slot, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: '#0f172a', 
                borderRadius: '0.5rem', 
                padding: '0.75rem',
                borderLeft: `3px solid ${slot.mode.includes('Charge') ? '#10b981' : '#a855f7'}`
              }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{slot.time}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{slot.reason}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500',
                    color: slot.mode.includes('Charge') ? '#10b981' : '#a855f7'
                  }}>
                    {slot.mode}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{slot.power}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h2 className="card-title">
              <Bell size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Alarm Configuration
            </h2>
            <button 
              className="btn btn-primary" 
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
              onClick={() => setShowAlarmConfig(!showAlarmConfig)}
            >
              {showAlarmConfig ? 'Hide' : 'Configure'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {alarms.map(alarm => (
              <div key={alarm.id} style={{ 
                background: '#0f172a', 
                borderRadius: '0.5rem', 
                padding: '1rem',
                opacity: alarm.enabled ? 1 : 0.5
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>{alarm.name}</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                    <input 
                      type="checkbox" 
                      checked={alarm.enabled} 
                      onChange={() => {}} 
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: alarm.enabled ? '#10b981' : '#374151',
                      borderRadius: '10px',
                      transition: '0.3s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '',
                        height: '16px',
                        width: '16px',
                        left: alarm.enabled ? '18px' : '2px',
                        bottom: '2px',
                        background: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                      }}></span>
                    </span>
                  </label>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Threshold: {alarm.threshold}
                </div>
                <span className={`badge badge-${alarm.severity === 'critical' ? 'danger' : alarm.severity === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: '0.625rem' }}>
                  {alarm.severity}
                </span>
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
          {storageAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
              <p>All systems nominal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {storageAlerts.map(alert => (
                <div key={alert.id} style={{ 
                  background: '#0f172a', 
                  borderRadius: '0.5rem', 
                  padding: '0.75rem',
                  borderLeft: `3px solid ${alert.type === 'warning' ? '#f59e0b' : alert.type === 'critical' ? '#ef4444' : '#3b82f6'}`
                }}>
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{alert.message}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{alert.time}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>System Health</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Temperature</span>
              <span style={{ color: '#10b981' }}>28°C</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Cell Balance</span>
              <span style={{ color: '#10b981' }}>Good</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>Cooling System</span>
              <span style={{ color: '#10b981' }}>Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <TrendingUp size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            30-Day Performance
          </h2>
        </div>
        <div style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cycleHistory.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Bar yAxisId="left" dataKey="cycles" fill="#6366f1" name="Cycles" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )

  const renderGeneratorsContent = () => (
    <div>
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Capacity</span>
            <Fuel size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>1,250 kW</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>3 generators</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Available</span>
            <CheckCircle size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>2</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Ready for backup</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Avg Fuel Level</span>
            <Gauge size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>89%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Est. 48hr runtime</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Fuel size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Generator Fleet
          </h2>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
            <Wrench size={14} style={{ marginRight: '0.25rem' }} />
            Schedule Test
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Generator</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Fuel Level</th>
                <th>Runtime (hrs)</th>
                <th>Last Test</th>
              </tr>
            </thead>
            <tbody>
              {generators.map(gen => (
                <tr key={gen.id}>
                  <td style={{ fontWeight: '500' }}>{gen.name}</td>
                  <td>{gen.capacity} kW</td>
                  <td>
                    <span className={`badge badge-${gen.status === 'standby' ? 'success' : gen.status === 'running' ? 'info' : 'warning'}`}>
                      {gen.status}
                    </span>
                  </td>
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
                          width: `${gen.fuelLevel}%`, 
                          height: '100%', 
                          background: gen.fuelLevel > 50 ? '#10b981' : gen.fuelLevel > 25 ? '#f59e0b' : '#ef4444',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '0.875rem' }}>{gen.fuelLevel}%</span>
                    </div>
                  </td>
                  <td>{gen.runtime}</td>
                  <td style={{ color: '#94a3b8' }}>{gen.lastTest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderEVChargersContent = () => (
    <div>
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Chargers</span>
            <Car size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>5</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>2 DC Fast, 3 Level 2</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Available</span>
            <CheckCircle size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>3</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Ready to charge</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Today's Sessions</span>
            <Activity size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>94</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>+15% vs yesterday</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Energy Delivered</span>
            <Zap size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>1,725 kWh</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>This month</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Car size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            EV Charging Stations
          </h2>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
            <Settings size={14} style={{ marginRight: '0.25rem' }} />
            Manage
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Charger</th>
                <th>Type</th>
                <th>Power</th>
                <th>Status</th>
                <th>Sessions (30d)</th>
                <th>Energy (30d)</th>
              </tr>
            </thead>
            <tbody>
              {evChargers.map(charger => (
                <tr key={charger.id}>
                  <td style={{ fontWeight: '500' }}>{charger.name}</td>
                  <td>{charger.type}</td>
                  <td>{charger.power} kW</td>
                  <td>
                    <span className={`badge badge-${charger.status === 'available' ? 'success' : charger.status === 'charging' ? 'info' : 'danger'}`}>
                      {charger.status}
                    </span>
                  </td>
                  <td>{charger.sessions}</td>
                  <td>{charger.energyDelivered} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderPerformanceContent = () => (
    <div>
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Generation Ratio</span>
            <TrendingUp size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>96.2%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>vs expected output</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Availability</span>
            <CheckCircle size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>99.4%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>System uptime</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Variance</span>
            <BarChart3 size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>-3.8%</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Below forecast</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">
            <BarChart3 size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Generation vs Expected
          </h2>
        </div>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Bar dataKey="production" fill="#10b981" name="Actual (kWh)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="expected" stroke="#f59e0b" strokeWidth={2} name="Expected (kWh)" dot={{ fill: '#f59e0b' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <FileText size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Performance Summary
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Actual (kWh)</th>
                <th>Expected (kWh)</th>
                <th>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.slice(0, 6).map((m, idx) => {
                const variance = ((m.production - m.expected) / m.expected * 100).toFixed(1)
                const isPositive = parseFloat(variance) >= 0
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: '500' }}>{m.month}</td>
                    <td>{m.production.toLocaleString()}</td>
                    <td>{m.expected.toLocaleString()}</td>
                    <td style={{ color: isPositive ? '#10b981' : '#ef4444' }}>
                      {isPositive ? '+' : ''}{variance}%
                    </td>
                    <td>
                      <span className={`badge badge-${isPositive ? 'success' : parseFloat(variance) > -5 ? 'warning' : 'danger'}`}>
                        {isPositive ? 'Above Target' : parseFloat(variance) > -5 ? 'Near Target' : 'Below Target'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderWarrantiesContent = () => (
    <div>
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Active Warranties</span>
            <Shield size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>5</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Fully covered</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Expiring Soon</span>
            <AlertTriangle size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>1</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Within 12 months</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Coverage</span>
            <DollarSign size={20} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>$2.4M</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Equipment value</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Shield size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Equipment Warranties
          </h2>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
            <FileText size={14} style={{ marginRight: '0.25rem' }} />
            Export Report
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Manufacturer</th>
                <th>Install Date</th>
                <th>Warranty End</th>
                <th>Coverage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warranties.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: '500' }}>{w.equipment}</td>
                  <td>{w.manufacturer}</td>
                  <td style={{ color: '#94a3b8' }}>{w.installDate}</td>
                  <td style={{ color: '#94a3b8' }}>{w.warrantyEnd}</td>
                  <td>{w.coverage}</td>
                  <td>
                    <span className={`badge badge-${w.status === 'active' ? 'success' : w.status === 'expiring' ? 'warning' : 'danger'}`}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'pv':
        return renderPVContent()
      case 'storage':
        return renderStorageContent()
      case 'generators':
        return renderGeneratorsContent()
      case 'ev-chargers':
        return renderEVChargersContent()
      case 'performance':
        return renderPerformanceContent()
      case 'warranties':
        return renderWarrantiesContent()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={24} color="#10b981" />
            Energy Assets
          </h1>
          <p style={{ color: '#64748b' }}>Monitor and manage all energy generation and storage assets</p>
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
          {activeTab === 'storage' && (
            <select 
              className="form-input" 
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(Number(e.target.value))}
              style={{ padding: '0.5rem 1rem' }}
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name} - {u.capacity} kWh</option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={14} />
            {lastUpdate.toLocaleTimeString()}
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} style={{ padding: '0.5rem' }}>
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="default"
        size="md"
      >
        {renderTabContent}
      </TabPanel>

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
