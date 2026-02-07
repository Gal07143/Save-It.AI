import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Battery, TrendingUp, AlertTriangle,
  Activity, RefreshCw, Clock, ArrowUpRight, ArrowDownRight, Settings,
  Calendar, DollarSign, Gauge, CheckCircle, Bell
} from 'lucide-react'
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts'
import { useToast } from '../contexts/ToastContext'
import { api } from '../services/api'

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

const generateSocData = () => Array.from({ length: 24 }, (_, i) => {
  let soc = 50
  if (i < 6) soc = 90 - i * 5
  else if (i < 10) soc = 60 + (i - 6) * 8
  else if (i < 14) soc = 92 - (i - 10) * 3
  else if (i < 18) soc = 80 + (i - 14) * 2
  else soc = 88 - (i - 18) * 2
  return {
    hour: `${i}:00`,
    soc: Math.min(100, Math.max(10, soc + seededRandom(i * 3) * 5 - 2.5)),
    power: i > 6 && i < 10 ? 25 + seededRandom(i * 3 + 1) * 10 : i > 17 && i < 21 ? -(30 + seededRandom(i * 3 + 1) * 15) : seededRandom(i * 3 + 1) * 10 - 5,
    price: 0.08 + (i > 16 && i < 21 ? 0.12 : 0) + seededRandom(i * 3 + 2) * 0.02,
  }
})

const generateCycleHistory = () => Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  cycles: 0.8 + seededRandom(i * 2 + 100) * 0.4,
  revenue: 15 + seededRandom(i * 2 + 101) * 20,
}))

export default function StorageUnits() {
  const { info } = useToast()
  const [socData, setSocData] = useState(generateSocData())
  const [cycleHistory] = useState(generateCycleHistory())
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  const [selectedUnit, setSelectedUnit] = useState(1)
  const [showAlarmConfig, setShowAlarmConfig] = useState(false)

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.sites.list(),
  })

  const { data: assets } = useQuery({
    queryKey: ['assets', selectedSite],
    queryFn: () => api.assets.list(selectedSite!),
    enabled: !!selectedSite,
  })

  // This filter is available for future API integration
  void assets?.filter(a => 
    a.asset_type?.toLowerCase().includes('battery') || 
    a.asset_type?.toLowerCase().includes('bess') ||
    a.asset_type?.toLowerCase().includes('storage')
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setSocData(generateSocData())
      setLastUpdate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setSocData(generateSocData())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const currentSoc = socData[new Date().getHours()]?.soc || 75
  const currentPower = socData[new Date().getHours()]?.power || 0
  const isCharging = currentPower > 0
  const totalCycles = 342
  const warrantyLimit = 4000
  const soh = 94.5

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

  const activeAlerts = [
    { id: 1, type: 'info', message: 'Scheduled maintenance in 3 days', time: '1 hour ago' },
  ]

  const monthlySavings = cycleHistory.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Battery size={24} color="#10b981" />
            Storage Units
          </h1>
          <p style={{ color: '#64748b' }}>Monitor battery storage, dispatch scheduling, and alarms</p>
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
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }} onClick={() => info('Dispatch schedule', 'Schedule editor coming soon')}>
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
                background: '#1e293b', 
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
                background: '#1e293b', 
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
          {activeAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
              <p>All systems nominal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeAlerts.map(alert => (
                <div key={alert.id} style={{ 
                  background: '#1e293b', 
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
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
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
