import { useState, useEffect } from 'react'
import { 
  Building2, Zap, TrendingDown, TrendingUp, AlertTriangle,
  Activity, Gauge, RefreshCw, Settings, Download,
  ThermometerSun, DollarSign, Leaf, Clock
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

interface PowerFlowNode {
  id: string
  name: string
  type: 'source' | 'load' | 'storage' | 'transformer' | 'meter'
  power: number
  status: 'active' | 'idle' | 'warning' | 'error'
  x: number
  y: number
}

interface PowerFlowEdge {
  from: string
  to: string
  power: number
  losses: number
}

export default function SiteDashboard() {
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [animationPhase, setAnimationPhase] = useState(0)

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: api.sites.list
  })

  const { data: meters } = useQuery({
    queryKey: ['meters'],
    queryFn: () => api.meters.list()
  })

  useEffect(() => {
    if (sites?.length && !selectedSite) {
      setSelectedSite(sites[0].id)
    }
  }, [sites, selectedSite])

  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      setAnimationPhase(p => (p + 1) % 100)
    }, 2000)
    return () => clearInterval(interval)
  }, [isLive])

  const currentSite = sites?.find(s => s.id === selectedSite)

  const powerFlowNodes: PowerFlowNode[] = [
    { id: 'grid', name: 'Grid Supply', type: 'source', power: 450 + Math.random() * 50, status: 'active', x: 50, y: 200 },
    { id: 'solar', name: 'Solar PV', type: 'source', power: 120 + Math.random() * 30, status: 'active', x: 50, y: 80 },
    { id: 'battery', name: 'Battery Storage', type: 'storage', power: -25 + Math.random() * 50, status: 'active', x: 50, y: 320 },
    { id: 'main_meter', name: 'Main Meter', type: 'meter', power: 545, status: 'active', x: 200, y: 200 },
    { id: 'transformer', name: 'MV/LV Transformer', type: 'transformer', power: 530, status: 'active', x: 350, y: 200 },
    { id: 'hvac', name: 'HVAC System', type: 'load', power: 180 + Math.random() * 20, status: 'active', x: 500, y: 80 },
    { id: 'lighting', name: 'Lighting', type: 'load', power: 85 + Math.random() * 10, status: 'active', x: 500, y: 200 },
    { id: 'equipment', name: 'Equipment', type: 'load', power: 220 + Math.random() * 25, status: 'active', x: 500, y: 320 },
  ]

  const powerFlowEdges: PowerFlowEdge[] = [
    { from: 'grid', to: 'main_meter', power: 450, losses: 0 },
    { from: 'solar', to: 'main_meter', power: 120, losses: 2.4 },
    { from: 'battery', to: 'main_meter', power: 25, losses: 0.5 },
    { from: 'main_meter', to: 'transformer', power: 545, losses: 8.2 },
    { from: 'transformer', to: 'hvac', power: 180, losses: 2.7 },
    { from: 'transformer', to: 'lighting', power: 85, losses: 1.3 },
    { from: 'transformer', to: 'equipment', power: 220, losses: 3.3 },
  ]

  const totalGeneration = powerFlowNodes.filter(n => n.type === 'source').reduce((sum, n) => sum + n.power, 0)
  const totalConsumption = powerFlowNodes.filter(n => n.type === 'load').reduce((sum, n) => sum + n.power, 0)
  const totalLosses = powerFlowEdges.reduce((sum, e) => sum + e.losses, 0)
  const lossPercentage = ((totalLosses / totalGeneration) * 100).toFixed(1)

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    consumption: 400 + Math.sin(i / 3) * 150 + Math.random() * 50,
    generation: i >= 6 && i <= 18 ? Math.sin((i - 6) / 4) * 150 : 0,
    gridImport: 350 + Math.random() * 100
  }))

  const lossesBreakdown = [
    { name: 'Transformer', value: 8.2, color: '#ef4444' },
    { name: 'Distribution', value: 5.8, color: '#f97316' },
    { name: 'Solar Inverter', value: 2.4, color: '#eab308' },
    { name: 'Battery', value: 0.5, color: '#22c55e' },
    { name: 'Metering', value: 0.3, color: '#3b82f6' },
  ]

  const assetStatus = [
    { name: 'Main Transformer', status: 'healthy', temp: 65, load: 78 },
    { name: 'Solar Inverter 1', status: 'healthy', temp: 42, load: 92 },
    { name: 'Solar Inverter 2', status: 'warning', temp: 58, load: 95 },
    { name: 'Battery System', status: 'healthy', temp: 28, load: 45 },
    { name: 'HVAC Chiller', status: 'healthy', temp: 35, load: 82 },
  ]

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'source': return '#10b981'
      case 'load': return '#f59e0b'
      case 'storage': return '#8b5cf6'
      case 'transformer': return '#6366f1'
      case 'meter': return '#3b82f6'
      default: return '#64748b'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={28} />
            Site Dashboard
          </h1>
          <p className="page-subtitle">Real-time power flow monitoring and site analytics</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            className="form-select"
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(Number(e.target.value))}
            style={{ minWidth: '200px' }}
          >
            <option value="">Select Site</option>
            {sites?.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button 
            className={`btn ${isLive ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setIsLive(!isLive)}
          >
            <Activity size={18} />
            {isLive ? 'Live' : 'Paused'}
          </button>
          <button className="btn btn-outline">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {!selectedSite ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Building2 size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#94a3b8' }}>Please select a site to view its dashboard</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={14} />
            Last updated: {lastUpdate.toLocaleTimeString()}
            {isLive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
                Live
              </span>
            )}
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <Zap size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Total Generation</span>
                <span className="stat-value">{totalGeneration.toFixed(0)} kW</span>
                <span className="stat-change positive">
                  <TrendingUp size={14} /> +12% vs yesterday
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Activity size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Total Consumption</span>
                <span className="stat-value">{totalConsumption.toFixed(0)} kW</span>
                <span className="stat-change negative">
                  <TrendingDown size={14} /> -5% vs yesterday
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <AlertTriangle size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Total Losses</span>
                <span className="stat-value">{totalLosses.toFixed(1)} kW</span>
                <span className="stat-change" style={{ color: '#64748b' }}>
                  {lossPercentage}% of generation
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                <Leaf size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Self-Consumption</span>
                <span className="stat-value">78%</span>
                <span className="stat-change positive">
                  <TrendingUp size={14} /> +3% this week
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                <DollarSign size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Today's Cost</span>
                <span className="stat-value">$1,245</span>
                <span className="stat-change positive">
                  <TrendingDown size={14} /> -8% vs avg
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                  <Zap size={18} style={{ marginRight: '0.5rem', color: '#10b981' }} />
                  Live Power Flow Diagram
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setLastUpdate(new Date())}>
                  <RefreshCw size={16} className={isLive ? 'spinning' : ''} />
                </button>
              </div>
              
              <div style={{ 
                position: 'relative', 
                height: '400px', 
                background: '#0f172a', 
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <svg width="100%" height="100%" viewBox="0 0 600 400">
                  <defs>
                    <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {powerFlowEdges.map((edge, i) => {
                    const fromNode = powerFlowNodes.find(n => n.id === edge.from)
                    const toNode = powerFlowNodes.find(n => n.id === edge.to)
                    if (!fromNode || !toNode) return null

                    const x1 = fromNode.x + 50
                    const y1 = fromNode.y + 25
                    const x2 = toNode.x
                    const y2 = toNode.y + 25

                    const strokeWidth = Math.max(2, Math.min(8, edge.power / 50))
                    const dashOffset = animationPhase * 3

                    return (
                      <g key={i}>
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          stroke="#334155"
                          strokeWidth={strokeWidth + 4}
                          fill="none"
                        />
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          stroke="url(#flowGradient)"
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray="10,5"
                          strokeDashoffset={-dashOffset}
                          filter="url(#glow)"
                        />
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 10}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {edge.power} kW
                        </text>
                        {edge.losses > 0 && (
                          <text
                            x={(x1 + x2) / 2}
                            y={(y1 + y2) / 2 + 5}
                            fill="#ef4444"
                            fontSize="9"
                            textAnchor="middle"
                          >
                            -{edge.losses} kW loss
                          </text>
                        )}
                      </g>
                    )
                  })}

                  {powerFlowNodes.map(node => (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                      <rect
                        width="100"
                        height="50"
                        rx="8"
                        fill={getNodeColor(node.type)}
                        opacity="0.2"
                        stroke={getNodeColor(node.type)}
                        strokeWidth="2"
                      />
                      <rect
                        width="100"
                        height="50"
                        rx="8"
                        fill="transparent"
                        stroke={getNodeColor(node.type)}
                        strokeWidth="2"
                        filter={node.status === 'active' ? 'url(#glow)' : ''}
                      />
                      <text x="50" y="20" fill="#f8fafc" fontSize="11" textAnchor="middle" fontWeight="600">
                        {node.name}
                      </text>
                      <text x="50" y="38" fill={getNodeColor(node.type)} fontSize="13" textAnchor="middle" fontWeight="bold">
                        {node.power.toFixed(0)} kW
                      </text>
                      {node.status === 'warning' && (
                        <circle cx="90" cy="10" r="6" fill="#f59e0b">
                          <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  ))}

                  <text x="300" y="380" fill="#64748b" fontSize="12" textAnchor="middle">
                    Power flow direction: Sources → Meter → Transformer → Loads
                  </text>
                </svg>

                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  left: '1rem',
                  display: 'flex',
                  gap: '1rem',
                  fontSize: '0.75rem'
                }}>
                  {[
                    { label: 'Source', color: '#10b981' },
                    { label: 'Load', color: '#f59e0b' },
                    { label: 'Storage', color: '#8b5cf6' },
                    { label: 'Transformer', color: '#6366f1' },
                    { label: 'Meter', color: '#3b82f6' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color }}></div>
                      <span style={{ color: '#94a3b8' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                <AlertTriangle size={18} style={{ marginRight: '0.5rem', color: '#ef4444' }} />
                Losses Breakdown
              </h3>
              
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossesBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ value }) => `${value} kW`}
                    >
                      {lossesBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                      formatter={(value: number) => [`${value} kW`, 'Loss']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: '1rem' }}>
                {lossesBreakdown.map((item, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: i < lossesBreakdown.length - 1 ? '1px solid #334155' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }}></div>
                      <span style={{ fontSize: '0.875rem' }}>{item.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{item.value} kW</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {((item.value / totalLosses) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: '0.5rem',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Daily Losses</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>{(totalLosses * 24).toFixed(0)} kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Estimated Cost</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>${((totalLosses * 24) * 0.12).toFixed(2)}/day</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                <Activity size={18} style={{ marginRight: '0.5rem', color: '#3b82f6' }} />
                24-Hour Load Profile
              </h3>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGeneration" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#f8fafc' }}
                    />
                    <Area type="monotone" dataKey="consumption" stroke="#f59e0b" fill="url(#colorConsumption)" strokeWidth={2} name="Consumption (kW)" />
                    <Area type="monotone" dataKey="generation" stroke="#10b981" fill="url(#colorGeneration)" strokeWidth={2} name="Solar Generation (kW)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                <ThermometerSun size={18} style={{ marginRight: '0.5rem', color: '#ef4444' }} />
                Asset Status Monitor
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {assetStatus.map((asset, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: '#1e293b',
                    borderRadius: '0.5rem',
                    borderLeft: `3px solid ${asset.status === 'healthy' ? '#10b981' : asset.status === 'warning' ? '#f59e0b' : '#ef4444'}`
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{asset.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Temp: {asset.temp}°C | Load: {asset.load}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '60px', 
                        height: '6px', 
                        background: '#334155', 
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${asset.load}%`, 
                          height: '100%', 
                          background: asset.load > 90 ? '#ef4444' : asset.load > 70 ? '#f59e0b' : '#10b981',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.125rem 0.5rem', 
                        borderRadius: '9999px',
                        background: asset.status === 'healthy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: asset.status === 'healthy' ? '#10b981' : '#f59e0b'
                      }}>
                        {asset.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                <Gauge size={18} style={{ marginRight: '0.5rem', color: '#6366f1' }} />
                Site Information
              </h3>
              <button className="btn btn-ghost btn-sm">
                <Settings size={16} />
                Configure
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Site Name</div>
                <div style={{ fontWeight: 500 }}>{currentSite?.name || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Address</div>
                <div style={{ fontWeight: 500 }}>{currentSite?.address || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Timezone</div>
                <div style={{ fontWeight: 500 }}>{currentSite?.timezone || 'UTC'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Meters</div>
                <div style={{ fontWeight: 500 }}>{Array.isArray(meters) ? meters.filter((m: any) => m.site_id === selectedSite).length : 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Contract Demand</div>
                <div style={{ fontWeight: 500 }}>1,000 kVA</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Peak Demand (Today)</div>
                <div style={{ fontWeight: 500 }}>856 kW</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Power Factor</div>
                <div style={{ fontWeight: 500 }}>0.94</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Monthly Consumption</div>
                <div style={{ fontWeight: 500 }}>284,500 kWh</div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spinning {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
