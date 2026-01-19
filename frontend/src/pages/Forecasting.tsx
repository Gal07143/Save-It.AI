import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TrendingUp, Clock, Target, Zap, RefreshCw, CloudSun, Cloud, BarChart3, GitBranch, Download, Sun, Thermometer, Wind, Droplets, CheckCircle, AlertTriangle, FileSpreadsheet, FileText } from 'lucide-react'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import TabPanel, { Tab } from '../components/TabPanel'

const API_BASE = '/api/v1'

export default function Forecasting() {
  const [forecastType, setForecastType] = useState<'load' | 'pv'>('load')
  const [horizonHours, setHorizonHours] = useState(24)
  const [activeTab, setActiveTab] = useState('load-forecast')

  const tabs: Tab[] = [
    { id: 'load-forecast', label: 'Load Forecast', icon: Zap },
    { id: 'pv-forecast', label: 'PV Forecast', icon: Sun },
    { id: 'weather', label: 'Weather Integration', icon: Cloud },
    { id: 'accuracy', label: 'Accuracy Metrics', icon: BarChart3 },
    { id: 'scenarios', label: 'Scenarios', icon: GitBranch },
    { id: 'export', label: 'Export', icon: Download },
  ]

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

  const generateMockForecast = (type: 'load' | 'pv' = forecastType) => {
    const data = []
    const now = new Date()
    for (let i = 0; i < horizonHours; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000)
      const hourOfDay = hour.getHours()
      const baseLoad = type === 'load' 
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

  const pvForecastData = generateMockForecast('pv')

  const totalPredicted = forecastData.reduce((sum: number, p: { predicted: number }) => sum + p.predicted, 0)
  const peakPredicted = Math.max(...forecastData.map((p: { predicted: number }) => p.predicted))

  const pvTotalPredicted = pvForecastData.reduce((sum: number, p: { predicted: number }) => sum + p.predicted, 0)
  const pvPeakPredicted = Math.max(...pvForecastData.map((p: { predicted: number }) => p.predicted))

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'load-forecast':
        return (
          <>
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
          </>
        )

      case 'pv-forecast':
        return (
          <>
            <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
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
                  <Sun size={24} color="#f59e0b" />
                </div>
                <div>
                  <div className="stat-value">{Math.round(pvTotalPredicted)} kWh</div>
                  <div className="stat-label">Total Generation</div>
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
                  <Zap size={24} color="#10b981" />
                </div>
                <div>
                  <div className="stat-value">{Math.round(pvPeakPredicted)} kW</div>
                  <div className="stat-label">Peak Generation</div>
                </div>
              </div>

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
                  <CloudSun size={24} color="#6366f1" />
                </div>
                <div>
                  <div className="stat-value">92%</div>
                  <div className="stat-label">Irradiance Factor</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '0.5rem',
                  background: '#8b5cf620',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Target size={24} color="#8b5cf6" />
                </div>
                <div>
                  <div className="stat-value">88%</div>
                  <div className="stat-label">Confidence</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Solar Generation Forecast</h2>
              </div>
              
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pvForecastData}>
                    <defs>
                      <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
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
                      fill="#fcd34d33"
                      name="Upper Bound"
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="transparent"
                      fill="#0f172a"
                      name="Lower Bound"
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#colorPV)"
                      name="Predicted (kW)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )

      case 'weather':
        return (
          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cloud size={20} color="#3b82f6" />
                  Current Weather Conditions
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Thermometer size={24} color="#ef4444" />
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>22°C</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Temperature</div>
                  </div>
                </div>
                <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Droplets size={24} color="#3b82f6" />
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>65%</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Humidity</div>
                  </div>
                </div>
                <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Wind size={24} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>12 km/h</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Wind Speed</div>
                  </div>
                </div>
                <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Sun size={24} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>850 W/m²</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Irradiance</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Weather Impact on Forecasts</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#10b98115', borderRadius: '0.5rem', border: '1px solid #10b98130' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <CheckCircle size={16} color="#10b981" />
                    <span style={{ fontWeight: 500, color: '#10b981' }}>Optimal Conditions</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                    Clear skies expected. PV generation forecast increased by 15%.
                  </p>
                </div>
                <div style={{ padding: '1rem', background: '#3b82f615', borderRadius: '0.5rem', border: '1px solid #3b82f630' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Cloud size={16} color="#3b82f6" />
                    <span style={{ fontWeight: 500, color: '#3b82f6' }}>Weather Data Source</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                    Data sourced from OpenWeather API. Last updated: 5 minutes ago.
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <h2 className="card-title">Weather Forecast Integration Settings</h2>
              </div>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                Configure weather data sources and adjustment parameters for improved forecast accuracy.
              </p>
              <div className="grid grid-3" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Weather API Provider</label>
                  <select className="form-input">
                    <option>OpenWeather API</option>
                    <option>Weather.gov</option>
                    <option>AccuWeather</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Update Frequency</label>
                  <select className="form-input">
                    <option>Every 15 minutes</option>
                    <option>Every 30 minutes</option>
                    <option>Every hour</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Adjustment Factor</label>
                  <select className="form-input">
                    <option>Automatic</option>
                    <option>Conservative (±5%)</option>
                    <option>Moderate (±10%)</option>
                    <option>Aggressive (±15%)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )

      case 'accuracy':
        return (
          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Model Performance Metrics</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Mean Absolute Error (MAE)', value: '4.2 kW', status: 'good' },
                  { label: 'Root Mean Square Error (RMSE)', value: '6.8 kW', status: 'good' },
                  { label: 'Mean Absolute Percentage Error (MAPE)', value: '5.3%', status: 'good' },
                  { label: 'R² Score', value: '0.94', status: 'excellent' },
                ].map((metric) => (
                  <div key={metric.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                    <span style={{ color: '#94a3b8' }}>{metric.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{metric.value}</span>
                      <span style={{ 
                        padding: '0.125rem 0.5rem', 
                        borderRadius: '9999px', 
                        fontSize: '0.75rem',
                        background: metric.status === 'excellent' ? '#10b98120' : '#3b82f620',
                        color: metric.status === 'excellent' ? '#10b981' : '#3b82f6'
                      }}>
                        {metric.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Accuracy by Time Horizon</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { horizon: '1-6 hours', accuracy: 96 },
                  { horizon: '6-12 hours', accuracy: 92 },
                  { horizon: '12-24 hours', accuracy: 88 },
                  { horizon: '24-48 hours', accuracy: 82 },
                  { horizon: '48-72 hours', accuracy: 75 },
                ].map((item) => (
                  <div key={item.horizon}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{item.horizon}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.accuracy}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${item.accuracy}%`, 
                        background: item.accuracy >= 90 ? '#10b981' : item.accuracy >= 80 ? '#3b82f6' : '#f59e0b',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <h2 className="card-title">Recent Prediction Accuracy</h2>
              </div>
              <p style={{ color: '#94a3b8' }}>
                Historical comparison of predicted vs actual values will be displayed here. 
                Connect to the forecasting API to enable real-time accuracy tracking.
              </p>
            </div>
          </div>
        )

      case 'scenarios':
        return (
          <div className="grid grid-3" style={{ gap: '1.5rem' }}>
            <div className="card" style={{ borderTop: '3px solid #10b981' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ color: '#10b981' }}>Best Case Scenario</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Load Reduction</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>-18%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>PV Generation</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>+25%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Cost Savings</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>$1,240</div>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  Assumes optimal weather conditions and maximum demand response participation.
                </p>
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #3b82f6' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ color: '#3b82f6' }}>Expected Scenario</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Load Variation</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>±5%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>PV Generation</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>Baseline</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Cost Estimate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>$2,850</div>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  Based on historical patterns and current forecasts with 85% confidence.
                </p>
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #ef4444' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ color: '#ef4444' }}>Worst Case Scenario</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Load Increase</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>+22%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>PV Generation</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>-40%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Cost Impact</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>$4,120</div>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  Accounts for extreme weather events and equipment underperformance.
                </p>
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 3' }}>
              <div className="card-header">
                <h2 className="card-title">Scenario Configuration</h2>
              </div>
              <p style={{ color: '#94a3b8' }}>
                Customize scenario parameters to model different operational conditions. 
                Scenarios help in risk assessment and contingency planning.
              </p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Configure Custom Scenarios
              </button>
            </div>
          </div>
        )

      case 'export':
        return (
          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Export Forecast Data</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Forecast Type</label>
                  <select className="form-input">
                    <option>Load Forecast</option>
                    <option>PV Forecast</option>
                    <option>Combined Forecast</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date Range</label>
                  <select className="form-input">
                    <option>Last 24 hours</option>
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Custom range</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select className="form-input">
                    <option>CSV</option>
                    <option>Excel (.xlsx)</option>
                    <option>JSON</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Quick Export Options</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { icon: FileSpreadsheet, label: 'Export to CSV', desc: 'Comma-separated values file' },
                  { icon: FileText, label: 'Export to Excel', desc: 'Microsoft Excel spreadsheet' },
                  { icon: Download, label: 'Export Raw JSON', desc: 'Machine-readable format' },
                ].map((option) => (
                  <button
                    key={option.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <option.icon size={24} color="#6366f1" />
                    <div>
                      <div style={{ fontWeight: 500 }}>{option.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{option.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <h2 className="card-title">Scheduled Reports</h2>
              </div>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                Set up automated forecast reports to be delivered via email on a schedule.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary">
                  Create Scheduled Report
                </button>
                <button className="btn" style={{ background: '#334155' }}>
                  View Existing Schedules
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

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

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="default"
      >
        {renderTabContent}
      </TabPanel>

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
