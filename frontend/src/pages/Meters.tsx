import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Meter, DataSource } from '../services/api'
import {
  Gauge, CheckCircle, XCircle, Clock, Plus, Wifi, WifiOff,
  Settings, RefreshCw, Link2, Radio, AlertTriangle, Trash2,
  Activity, Calendar, AlertOctagon, BarChart3, Zap, List, Filter, Search
} from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface MeterWithConnectivity {
  id: number
  meter_id: string
  name: string
  is_active: boolean
  last_reading_at?: string | null
  asset_id?: number | null
  site_id: number
  data_source_id?: number | null
  site_name?: string
  connectivity?: {
    protocol: 'modbus_tcp' | 'mbus' | 'modbus_rtu' | null
    address: string
    status: 'connected' | 'disconnected' | 'error' | 'polling'
    gatewayId: number | null
    gatewayName: string | null
    lastPoll: Date | null
    errorMessage: string | null
  }
}

interface MetersProps {
  currentSite?: number | null
}

export default function Meters({ currentSite }: MetersProps) {
  const queryClient = useQueryClient()
  const [siteFilter, setSiteFilter] = useState<number | 'all'>(currentSite || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReadingMeter, setSelectedReadingMeter] = useState<number | null>(null)

  const { data: meters, isLoading } = useQuery({ queryKey: ['meters'], queryFn: () => api.meters.list() })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: devices } = useQuery({ queryKey: ['dataSources'], queryFn: () => api.dataSources.list() })
  const { data: gateways } = useQuery({ queryKey: ['gateways'], queryFn: () => api.gateways.list() })
  
  const [showAddMeter, setShowAddMeter] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedMeter, setSelectedMeter] = useState<MeterWithConnectivity | null>(null)
  const [meterToDelete, setMeterToDelete] = useState<MeterWithConnectivity | null>(null)
  const [editMeter, setEditMeter] = useState({ meter_id: '', name: '', is_active: true })
  
  const [newMeter, setNewMeter] = useState({
    meter_id: '',
    name: '',
    site_id: '',
    data_source_id: '',
    is_active: true
  })

  const [connectionConfig, setConnectionConfig] = useState({
    protocol: 'modbus_tcp' as 'modbus_tcp' | 'mbus' | 'modbus_rtu',
    address: '',
    slaveId: 1,
    registerStart: 0,
    pollInterval: 60
  })

  // Map meters with real connectivity status based on actual data
  const metersWithConnectivity: MeterWithConnectivity[] = useMemo(() => {
    return (meters || []).map((m: Meter) => {
      const device = devices?.find((d: DataSource) => d.id === m.data_source_id)
      const gateway = gateways?.find((g: any) => g.id === device?.gateway_id)
      const site = sites?.find((s: any) => s.id === m.site_id)

      // Determine connection status based on last_reading_at
      let status: 'connected' | 'disconnected' | 'error' | 'polling' = 'disconnected'
      if (m.last_reading_at) {
        const lastReading = new Date(m.last_reading_at)
        const minutesSinceReading = (Date.now() - lastReading.getTime()) / 60000
        if (minutesSinceReading < 5) status = 'connected'
        else if (minutesSinceReading < 30) status = 'polling'
        else if (minutesSinceReading < 1440) status = 'disconnected'
        else status = 'error'
      }

      // Build address string from connection params or device properties
      let address = '-'
      if (device?.connection_params?.host) {
        address = `${device.connection_params.host}:${device.connection_params.port || 502}`
      } else if (device?.connection_params?.serial_port) {
        address = String(device.connection_params.serial_port)
      } else if (device?.host) {
        address = `${device.host}:${device.port || 502}`
      }

      return {
        ...m,
        site_name: site?.name || `Site ${m.site_id}`,
        connectivity: device ? {
          protocol: device.source_type as 'modbus_tcp' | 'mbus' | 'modbus_rtu' | null,
          address,
          status,
          gatewayId: gateway?.id || null,
          gatewayName: gateway?.name || null,
          lastPoll: m.last_reading_at ? new Date(m.last_reading_at) : null,
          errorMessage: status === 'error' ? 'No data received in 24+ hours' : null
        } : {
          protocol: null,
          address: '-',
          status: m.is_active ? 'disconnected' : 'disconnected',
          gatewayId: null,
          gatewayName: null,
          lastPoll: m.last_reading_at ? new Date(m.last_reading_at) : null,
          errorMessage: null
        }
      }
    })
  }, [meters, devices, gateways, sites])

  // Filter meters based on site and search query
  const filteredMeters = useMemo(() => {
    return metersWithConnectivity.filter(m => {
      const matchesSite = siteFilter === 'all' || m.site_id === siteFilter
      const matchesSearch = !searchQuery ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.meter_id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSite && matchesSearch
    })
  }, [metersWithConnectivity, siteFilter, searchQuery])

  const createMeterMutation = useMutation({
    mutationFn: async (data: typeof newMeter) => {
      const response = await fetch('/api/v1/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data, 
          site_id: parseInt(data.site_id),
          data_source_id: data.data_source_id ? parseInt(data.data_source_id) : null
        })
      })
      if (!response.ok) throw new Error('Failed to create meter')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowAddMeter(false)
      setNewMeter({ meter_id: '', name: '', site_id: '', data_source_id: '', is_active: true })
    }
  })

  const deleteMeterMutation = useMutation({
    mutationFn: async (meterId: number) => {
      const response = await fetch(`/api/v1/meters/${meterId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete meter')
      if (response.status === 204) return { success: true }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowDeleteConfirm(false)
      setMeterToDelete(null)
    }
  })

  const updateMeterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { meter_id: string; name: string; is_active: boolean } }) => {
      const response = await fetch(`/api/v1/meters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update meter')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowSettingsModal(false)
      setSelectedMeter(null)
    }
  })

  const handleAddMeter = () => {
    createMeterMutation.mutate(newMeter)
  }

  const handleDeleteMeter = () => {
    if (meterToDelete) {
      deleteMeterMutation.mutate(meterToDelete.id)
    }
  }

  const confirmDelete = (meter: MeterWithConnectivity) => {
    setMeterToDelete(meter)
    setShowDeleteConfirm(true)
  }

  const handleConnect = () => {
    setShowConnectModal(false)
    setSelectedMeter(null)
  }

  const handleTestConnection = (_meter: MeterWithConnectivity) => {
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#10b981'
      case 'disconnected': return '#64748b'
      case 'error': return '#ef4444'
      case 'polling': return '#f59e0b'
      default: return '#64748b'
    }
  }

  const getProtocolLabel = (protocol: string | null) => {
    switch (protocol) {
      case 'modbus_tcp': return 'Modbus TCP'
      case 'mbus': return 'M-Bus'
      case 'modbus_rtu': return 'Modbus RTU'
      default: return 'Not configured'
    }
  }

  const tabs: Tab[] = [
    { id: 'all-meters', label: 'All Meters', icon: List, badge: filteredMeters.length },
    { id: 'readings', label: 'Readings', icon: Activity },
    { id: 'calibration', label: 'Calibration', icon: Calendar },
    { id: 'anomalies', label: 'Anomalies', icon: AlertOctagon },
    { id: 'comparison', label: 'Comparison', icon: BarChart3 },
    { id: 'ct-pt-ratios', label: 'CT/PT Ratios', icon: Zap }
  ]

  const renderAllMetersTab = () => (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search meters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.25rem',
              paddingRight: '0.75rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '0.875rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="#64748b" />
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '0.875rem',
              minWidth: '150px'
            }}
          >
            <option value="all">All Sites</option>
            {sites?.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Meters</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>{filteredMeters.length}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Connected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
            {filteredMeters.filter(m => m.connectivity?.status === 'connected').length}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Polling</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
            {filteredMeters.filter(m => m.connectivity?.status === 'polling').length}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Errors</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
            {filteredMeters.filter(m => m.connectivity?.status === 'error').length}
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p>Loading meters...</p>
        ) : filteredMeters.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Name</th>
                <th>Site</th>
                <th>Connected Device</th>
                <th>Protocol</th>
                <th>Gateway</th>
                <th>Status</th>
                <th>Last Reading</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeters.map((meter) => (
                <tr key={meter.id}>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                      {meter.meter_id}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{meter.name}</td>
                  <td>
                    <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{meter.site_name}</span>
                  </td>
                  <td>
                    {meter.data_source_id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                        <Link2 size={14} color="#10b981" />
                        {devices?.find((d: DataSource) => d.id === meter.data_source_id)?.name || `Device #${meter.data_source_id}`}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Not linked</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: meter.connectivity?.protocol ? '#e0e7ff' : '#f1f5f9',
                      color: meter.connectivity?.protocol ? '#4338ca' : '#94a3b8'
                    }}>
                      {getProtocolLabel(meter.connectivity?.protocol || null)}
                    </span>
                  </td>
                  <td>
                    {meter.connectivity?.gatewayName ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                        <Radio size={14} color="#3b82f6" />
                        {meter.connectivity.gatewayName}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Not assigned</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        background: `${getStatusColor(meter.connectivity?.status || 'disconnected')}22`,
                        color: getStatusColor(meter.connectivity?.status || 'disconnected')
                      }}>
                        {meter.connectivity?.status === 'connected' && <Wifi size={10} />}
                        {meter.connectivity?.status === 'disconnected' && <WifiOff size={10} />}
                        {meter.connectivity?.status === 'error' && <AlertTriangle size={10} />}
                        {meter.connectivity?.status === 'polling' && <RefreshCw size={10} className="spin" />}
                        {(meter.connectivity?.status || 'DISCONNECTED').toUpperCase()}
                      </span>
                      {meter.connectivity?.errorMessage && (
                        <span title={meter.connectivity.errorMessage} style={{ cursor: 'help' }}>
                          <AlertTriangle size={14} color="#ef4444" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {meter.connectivity?.lastPoll ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}>
                        <Clock size={12} />
                        {Math.round((Date.now() - new Date(meter.connectivity.lastPoll).getTime()) / 1000)}s ago
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Never</span>
                    )}
                  </td>
                  <td>
                    {meter.is_active ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleTestConnection(meter)}
                        title="Test Connection"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setSelectedMeter(meter); setShowConnectModal(true); }}
                        title="Configure Connection"
                      >
                        <Link2 size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm"
                        title="Settings"
                        onClick={() => { 
                          setSelectedMeter(meter); 
                          setEditMeter({ meter_id: meter.meter_id, name: meter.name, is_active: meter.is_active });
                          setShowSettingsModal(true); 
                        }}
                      >
                        <Settings size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => confirmDelete(meter)}
                        title="Delete Meter"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Gauge size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Meters Found</h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>Add meters to start monitoring energy consumption</p>
            <button className="btn btn-primary" onClick={() => setShowAddMeter(true)}>
              <Plus size={18} />
              Add Meter
            </button>
          </div>
        )}
      </div>
    </>
  )

  // Generate sample readings data for demonstration
  const generateReadingsData = () => {
    const now = new Date()
    return Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 3600000)
      return {
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        kWh: Math.round(50 + Math.random() * 100),
        kW: Math.round(20 + Math.random() * 40),
      }
    })
  }

  const readingsData = generateReadingsData()

  const renderReadingsTab = () => (
    <div>
      {/* Meter selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#f1f5f9' }}>
          Select Meter
        </label>
        <select
          value={selectedReadingMeter || ''}
          onChange={(e) => setSelectedReadingMeter(e.target.value ? Number(e.target.value) : null)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
            background: '#1e293b',
            color: '#f1f5f9',
            minWidth: '250px'
          }}
        >
          <option value="">Select a meter to view readings...</option>
          {filteredMeters.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.meter_id})</option>
          ))}
        </select>
      </div>

      {selectedReadingMeter ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Last Reading</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                {readingsData[readingsData.length - 1].kWh} kWh
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Current Demand</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
                {readingsData[readingsData.length - 1].kW} kW
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>24h Total</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                {readingsData.reduce((sum, r) => sum + r.kWh, 0).toLocaleString()} kWh
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Peak Demand</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                {Math.max(...readingsData.map(r => r.kW))} kW
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">24-Hour Consumption</h3>
            </div>
            <div style={{ height: '300px', padding: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readingsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#10b981" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="kWh" stroke="#10b981" strokeWidth={2} dot={false} name="Energy (kWh)" />
                  <Line yAxisId="right" type="monotone" dataKey="kW" stroke="#3b82f6" strokeWidth={2} dot={false} name="Power (kW)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Activity size={48} color="#3b82f6" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Meter Readings</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            Select a meter from the dropdown above to view its readings and consumption charts.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
            <span className="badge badge-info">Real-time Data</span>
            <span className="badge badge-info">Historical Charts</span>
            <span className="badge badge-info">Export Options</span>
          </div>
        </div>
      )}
    </div>
  )

  const renderCalibrationTab = () => (
    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
      <Calendar size={48} color="#8b5cf6" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>Calibration Management</h3>
      <p style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
        Schedule and track meter calibration activities. Maintain compliance records, set calibration reminders, and view calibration history for each meter.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
        <span className="badge badge-warning">Schedules</span>
        <span className="badge badge-warning">Records</span>
        <span className="badge badge-warning">Certificates</span>
      </div>
    </div>
  )

  const renderAnomaliesTab = () => (
    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
      <AlertOctagon size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>Anomaly Detection</h3>
      <p style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
        Detect unusual reading patterns and potential meter issues. AI-powered analysis identifies spikes, drops, and irregular consumption that may indicate problems.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
        <span className="badge badge-danger">Alerts</span>
        <span className="badge badge-danger">Pattern Analysis</span>
        <span className="badge badge-danger">Thresholds</span>
      </div>
    </div>
  )

  const renderComparisonTab = () => (
    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
      <BarChart3 size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>Meter Comparison</h3>
      <p style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
        Compare readings across multiple meters side-by-side. Identify efficiency variations, benchmark performance, and analyze consumption differences between locations.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
        <span className="badge badge-success">Side-by-Side</span>
        <span className="badge badge-success">Benchmarking</span>
        <span className="badge badge-success">Charts</span>
      </div>
    </div>
  )

  const renderCTPTRatiosTab = () => (
    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
      <Zap size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>CT/PT Ratio Management</h3>
      <p style={{ color: '#64748b', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
        Configure and manage Current Transformer (CT) and Potential Transformer (PT) ratios. Ensure accurate measurement scaling for high-voltage metering installations.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
        <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>CT Ratios</span>
        <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>PT Ratios</span>
        <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Scaling</span>
      </div>
    </div>
  )

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'all-meters':
        return renderAllMetersTab()
      case 'readings':
        return renderReadingsTab()
      case 'calibration':
        return renderCalibrationTab()
      case 'anomalies':
        return renderAnomaliesTab()
      case 'comparison':
        return renderComparisonTab()
      case 'ct-pt-ratios':
        return renderCTPTRatiosTab()
      default:
        return renderAllMetersTab()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Meters</h1>
          <p style={{ color: '#64748b' }}>Monitor meter status, readings, and connectivity</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddMeter(true)}>
          <Plus size={18} />
          Add Meter
        </button>
      </div>

      <TabPanel tabs={tabs} variant="default" size="md">
        {renderTabContent}
      </TabPanel>

      {showAddMeter && (
        <div className="modal-overlay" onClick={() => setShowAddMeter(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Add New Meter</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMeter(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Meter ID</label>
                <input
                  type="text"
                  value={newMeter.meter_id}
                  onChange={e => setNewMeter({ ...newMeter, meter_id: e.target.value })}
                  placeholder="e.g., MTR-001"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={newMeter.name}
                  onChange={e => setNewMeter({ ...newMeter, name: e.target.value })}
                  placeholder="e.g., Main Building Meter"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Site</label>
                <select
                  value={newMeter.site_id}
                  onChange={e => setNewMeter({ ...newMeter, site_id: e.target.value })}
                >
                  <option value="">Select Site</option>
                  {sites?.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Connected Device (Optional)</label>
                <select
                  value={newMeter.data_source_id}
                  onChange={e => setNewMeter({ ...newMeter, data_source_id: e.target.value })}
                >
                  <option value="">No Device / Manual Entry</option>
                  {devices?.map((device: DataSource) => (
                    <option key={device.id} value={device.id}>{device.name} ({device.source_type})</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Link this meter to a device for automatic data collection
                </p>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={newMeter.is_active}
                    onChange={e => setNewMeter({ ...newMeter, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddMeter(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddMeter}
                disabled={!newMeter.meter_id || !newMeter.name || !newMeter.site_id || createMeterMutation.isPending}
              >
                {createMeterMutation.isPending ? 'Creating...' : 'Add Meter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConnectModal && selectedMeter && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Configure Connection: {selectedMeter.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConnectModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Connection Protocol</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${connectionConfig.protocol === 'modbus_tcp' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setConnectionConfig({ ...connectionConfig, protocol: 'modbus_tcp' })}
                    style={{ flex: 1 }}
                  >
                    Modbus TCP
                  </button>
                  <button
                    type="button"
                    className={`btn ${connectionConfig.protocol === 'mbus' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setConnectionConfig({ ...connectionConfig, protocol: 'mbus' })}
                    style={{ flex: 1 }}
                  >
                    M-Bus
                  </button>
                  <button
                    type="button"
                    className={`btn ${connectionConfig.protocol === 'modbus_rtu' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setConnectionConfig({ ...connectionConfig, protocol: 'modbus_rtu' })}
                    style={{ flex: 1 }}
                  >
                    Modbus RTU
                  </button>
                </div>
              </div>

              {connectionConfig.protocol === 'modbus_tcp' && (
                <>
                  <div className="form-group">
                    <label className="form-label">IP Address:Port</label>
                    <input
                      type="text"
                      value={connectionConfig.address}
                      onChange={e => setConnectionConfig({ ...connectionConfig, address: e.target.value })}
                      placeholder="192.168.1.100:502"
                    />
                  </div>
                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Slave ID</label>
                      <input
                        type="number"
                        value={connectionConfig.slaveId}
                        onChange={e => setConnectionConfig({ ...connectionConfig, slaveId: parseInt(e.target.value) })}
                        min={1}
                        max={247}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Register Start</label>
                      <input
                        type="number"
                        value={connectionConfig.registerStart}
                        onChange={e => setConnectionConfig({ ...connectionConfig, registerStart: parseInt(e.target.value) })}
                        min={0}
                      />
                    </div>
                  </div>
                </>
              )}

              {connectionConfig.protocol === 'mbus' && (
                <div className="form-group">
                  <label className="form-label">M-Bus Primary Address</label>
                  <input
                    type="text"
                    value={connectionConfig.address}
                    onChange={e => setConnectionConfig({ ...connectionConfig, address: e.target.value })}
                    placeholder="0x01 or 1-250"
                  />
                </div>
              )}

              {connectionConfig.protocol === 'modbus_rtu' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Serial Port</label>
                    <input
                      type="text"
                      value={connectionConfig.address}
                      onChange={e => setConnectionConfig({ ...connectionConfig, address: e.target.value })}
                      placeholder="/dev/ttyUSB0 or COM1"
                    />
                  </div>
                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Slave ID</label>
                      <input
                        type="number"
                        value={connectionConfig.slaveId}
                        onChange={e => setConnectionConfig({ ...connectionConfig, slaveId: parseInt(e.target.value) })}
                        min={1}
                        max={247}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Baud Rate</label>
                      <select defaultValue="9600">
                        <option value="9600">9600</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="115200">115200</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Poll Interval (seconds)</label>
                <input
                  type="number"
                  value={connectionConfig.pollInterval}
                  onChange={e => setConnectionConfig({ ...connectionConfig, pollInterval: parseInt(e.target.value) })}
                  min={10}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowConnectModal(false)}>Cancel</button>
              <button className="btn btn-outline" onClick={() => handleTestConnection(selectedMeter)}>
                <RefreshCw size={16} />
                Test Connection
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConnect}
                disabled={!connectionConfig.address}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && selectedMeter && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Meter Settings: {selectedMeter.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSettingsModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Meter ID</label>
                <input
                  type="text"
                  value={editMeter.meter_id}
                  onChange={e => setEditMeter({ ...editMeter, meter_id: e.target.value })}
                  placeholder="Enter unique meter ID"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Meter Name</label>
                <input
                  type="text"
                  value={editMeter.name}
                  onChange={e => setEditMeter({ ...editMeter, name: e.target.value })}
                  placeholder="Enter meter name"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editMeter.is_active}
                    onChange={e => setEditMeter({ ...editMeter, is_active: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
                <small style={{ color: '#64748b' }}>Inactive meters will not collect data</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  updateMeterMutation.mutate({
                    id: selectedMeter.id,
                    data: { meter_id: editMeter.meter_id, name: editMeter.name, is_active: editMeter.is_active }
                  });
                  setShowSettingsModal(false);
                }}
                disabled={!editMeter.meter_id || !editMeter.name}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && meterToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Delete Meter</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  background: '#fef2f2', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <Trash2 size={32} color="#ef4444" />
                </div>
                <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  Are you sure you want to delete <strong>{meterToDelete.name}</strong>?
                </p>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Meter ID: <code style={{ background: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{meterToDelete.meter_id}</code>
                </p>
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem' }}>
                  This action cannot be undone. All readings and data associated with this meter will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button 
                className="btn" 
                style={{ background: '#ef4444', color: 'white' }}
                onClick={handleDeleteMeter}
                disabled={deleteMeterMutation.isPending}
              >
                {deleteMeterMutation.isPending ? 'Deleting...' : 'Delete Meter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin {
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
