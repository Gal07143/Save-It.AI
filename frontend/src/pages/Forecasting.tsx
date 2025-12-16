import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TrendingUp, Clock, Target, Zap, RefreshCw, CloudSun } from 'lucide-react'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

const API_BASE = '/api/v1'

export default function Forecasting() {
  const [forecastType, setForecastType] = useState<'load' | 'pv'>('load')
  const [horizonHours, setHorizonHours] = useState(24)

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/forecasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: 1,
          forecast_type: forecastType,
          horizon_hours: horizonHours,
        }),
      })
      return response.json()
    },
  })

  const generateMockForecast = () => {
    const data = []
    const now = new Date()
    for (let i = 0; i < horizonHours; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000)
      const hourOfDay = hour.getHours()
      const baseLoad = forecastType === 'load' 
        ? 100 + 50 * Math.sin((hourOfDay - 6) * Math.PI / 12) + Math.random() * 20
        : Math.max(0, 80 * Math.sin((hourOfDay - 6) * Math.PI / 12) + Math.random() * 10)
      
      data.push({
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        predicted: Math.max(0, baseLoad),
        lower: Math.max(0, baseLoad * 0.85),
        upper: baseLoad * 1.15,
      })
    }
    return data
  }

  const forecastData = forecastMutation.data?.data?.length 
    ? forecastMutation.data.data.map((p: { timestamp: string; predicted_value: number; lower_bound: number; upper_bound: number }) => ({
        time: new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        predicted: p.predicted_value,
        lower: p.lower_bound,
        upper: p.upper_bound,
      }))
    : generateMockForecast()

  const totalPredicted = forecastData.reduce((sum: number, p: { predicted: number }) => sum + p.predicted, 0)
  const peakPredicted = Math.max(...forecastData.map((p: { predicted: number }) => p.predicted))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={24} color="#6366f1" />
            Load & PV Forecasting
          </h1>
          <p style={{ color: '#64748b' }}>Predict future energy consumption and solar production</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => forecastMutation.mutate()}
          disabled={forecastMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={forecastMutation.isPending ? 'spinning' : ''} />
          Generate Forecast
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#6366f120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={24} color="#6366f1" />
          </div>
          <div>
            <div className="stat-value">{Math.round(totalPredicted)} kWh</div>
            <div className="stat-label">Total Predicted</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#f59e0b20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={24} color="#f59e0b" />
          </div>
          <div>
            <div className="stat-value">{Math.round(peakPredicted)} kW</div>
            <div className="stat-label">Peak Predicted</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#10b98120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Target size={24} color="#10b981" />
          </div>
          <div>
            <div className="stat-value">85%</div>
            <div className="stat-label">Confidence</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.5rem',
            background: '#3b82f620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Clock size={24} color="#3b82f6" />
          </div>
          <div>
            <div className="stat-value">{horizonHours}h</div>
            <div className="stat-label">Horizon</div>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Configuration</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Forecast Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { id: 'load', label: 'Load Forecast', desc: 'Predict consumption', icon: Zap },
                  { id: 'pv', label: 'PV Forecast', desc: 'Predict solar production', icon: CloudSun },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setForecastType(type.id as 'load' | 'pv')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: forecastType === type.id ? '2px solid #6366f1' : '1px solid #334155',
                      background: forecastType === type.id ? '#6366f115' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <type.icon size={20} color={forecastType === type.id ? '#6366f1' : '#64748b'} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{type.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{type.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Horizon (hours)</label>
              <select
                className="form-input"
                value={horizonHours}
                onChange={(e) => setHorizonHours(Number(e.target.value))}
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
                <option value={168}>1 week</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="card-header">
            <h2 className="card-title">
              {forecastType === 'load' ? 'Load' : 'PV Production'} Forecast
            </h2>
          </div>
          
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="#c7d2fe33"
                  name="Upper Bound"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="#0f172a"
                  name="Lower Bound"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Predicted (kW)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '3px', background: '#6366f1', borderRadius: '2px' }}></div>
              <span>Predicted</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '12px', background: '#c7d2fe33', borderRadius: '2px' }}></div>
              <span>Confidence Interval</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
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
