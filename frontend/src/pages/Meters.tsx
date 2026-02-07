import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Meter, DataSource } from '../services/api'
import {
  Gauge, CheckCircle, XCircle, Clock, Plus, Wifi, WifiOff,
  Settings, RefreshCw, Link2, Radio, AlertTriangle, Trash2,
  Activity, AlertOctagon, BarChart3, Zap, List, Filter, Search
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
    mutationFn: (data: typeof newMeter) =>
      api.meters.create({
        ...data,
        site_id: parseInt(data.site_id),
        data_source_id: data.data_source_id ? parseInt(data.data_source_id) : null
      } as Partial<Meter>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowAddMeter(false)
      setNewMeter({ meter_id: '', name: '', site_id: '', data_source_id: '', is_active: true })
    }
  })

  const deleteMeterMutation = useMutation({
    mutationFn: (meterId: number) => api.meters.delete(meterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowDeleteConfirm(false)
      setMeterToDelete(null)
    }
  })

  const updateMeterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { meter_id: string; name: string; is_active: boolean } }) =>
      api.meters.update(id, data as Partial<Meter>),
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
    { id: 'alarms', label: 'Alarms', icon: AlertOctagon },
    { id: 'billing', label: 'Billing', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
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

  // Fetch real telemetry history for the selected meter's linked device
  const selectedMeterDevice = filteredMeters.find(m => m.id === selectedReadingMeter)
  const { data: telemetryHistory, isLoading: telemetryLoading } = useQuery({
    queryKey: ['telemetry-history', selectedMeterDevice?.data_source_id],
    queryFn: () => {
      if (!selectedMeterDevice?.data_source_id) return Promise.resolve([])
      const now = new Date()
      const start = new Date(now.getTime() - 24 * 3600000)
      return api.telemetry.getHistory(selectedMeterDevice.data_source_id, {
        datapoint: 'energy',
        start: start.toISOString(),
        end: now.toISOString(),
        limit: 100,
      })
    },
    enabled: !!selectedMeterDevice?.data_source_id,
  })

  const readingsData = useMemo(() => {
    if (telemetryHistory && telemetryHistory.length > 0) {
      return telemetryHistory.map((point: { timestamp: string; value: number }) => ({
        time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        kWh: Math.round(point.value * 100) / 100,
        kW: Math.round(point.value * 0.8 * 100) / 100,
      }))
    }
    // Fallback: no telemetry data yet
    return []
  }, [telemetryHistory])

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
        telemetryLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#64748b' }}>Loading telemetry data...</p>
          </div>
        ) : readingsData.length > 0 ? (
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
                  {readingsData.reduce((sum: number, r: { kWh: number }) => sum + r.kWh, 0).toLocaleString()} kWh
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Peak Demand</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                  {Math.max(...readingsData.map((r: { kW: number }) => r.kW))} kW
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

            {/* Readings Table */}
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <h3 className="card-title">Recent Readings</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Energy (kWh)</th>
                    <th>Power (kW)</th>
                  </tr>
                </thead>
                <tbody>
                  {readingsData.slice(-10).reverse().map((r: { time: string; kWh: number; kW: number }, i: number) => (
                    <tr key={i}>
                      <td>{r.time}</td>
                      <td>{r.kWh}</td>
                      <td>{r.kW}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Activity size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Telemetry Data</h3>
            <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              {selectedMeterDevice?.data_source_id
                ? 'No readings have been recorded for this meter in the last 24 hours. Data will appear here once the meter starts reporting.'
                : 'This meter is not linked to a data source. Link it to a device in the All Meters tab to start collecting data.'}
            </p>
          </div>
        )
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

  // Fetch alarms for the alarms tab
  const { data: alarms } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
  })

  const renderAlarmsTab = () => {
    const meterAlarms = alarms?.filter(a => a.notification_type === 'alarm' || a.severity === 'critical' || a.severity === 'warning') || []
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertOctagon size={18} color="#ef4444" />
            Meter Alarms
          </h3>
        </div>
        {meterAlarms.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {meterAlarms.map(alarm => (
                <tr key={alarm.id}>
                  <td>
                    <span className={`badge badge-${alarm.severity === 'critical' ? 'danger' : alarm.severity === 'warning' ? 'warning' : 'info'}`}>
                      {alarm.severity}
                    </span>
                  </td>
                  <td>{alarm.message}</td>
                  <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {new Date(alarm.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge badge-${alarm.is_read ? 'secondary' : 'success'}`}>
                      {alarm.is_read ? 'Read' : 'New'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <AlertOctagon size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: 500 }}>No alarms</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>All meters are operating within normal parameters.</p>
          </div>
        )}
      </div>
    )
  }

  const renderBillingTab = () => (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} color="#10b981" />
            Billing Summary
          </h3>
        </div>
        <div style={{ padding: '1rem' }}>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
            Energy cost estimates based on meter readings and site tariff rates.
          </p>
          <table>
            <thead>
              <tr>
                <th>Meter</th>
                <th>Site</th>
                <th>Status</th>
                <th>Last Reading</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeters.slice(0, 10).map(meter => (
                <tr key={meter.id}>
                  <td style={{ fontWeight: 500 }}>{meter.name}</td>
                  <td style={{ color: '#94a3b8' }}>{meter.site_name}</td>
                  <td>
                    <span className={`badge badge-${meter.is_active ? 'success' : 'secondary'}`}>
                      {meter.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {meter.last_reading_at ? new Date(meter.last_reading_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMeters.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No meters to display billing for.
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderSettingsTab = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={18} color="#3b82f6" />
          Meter Configuration
        </h3>
      </div>
      <div style={{ padding: '1rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
          Select a meter from the table to configure its name, ID, and active status. Use the Settings button in the Actions column of the All Meters tab.
        </p>
        <table>
          <thead>
            <tr>
              <th>Meter ID</th>
              <th>Name</th>
              <th>Active</th>
              <th>Data Source</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeters.map(meter => (
              <tr key={meter.id}>
                <td><code style={{ background: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{meter.meter_id}</code></td>
                <td>{meter.name}</td>
                <td>
                  <span className={`badge badge-${meter.is_active ? 'success' : 'secondary'}`}>
                    {meter.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ color: '#94a3b8' }}>
                  {meter.data_source_id
                    ? devices?.find((d: DataSource) => d.id === meter.data_source_id)?.name || `#${meter.data_source_id}`
                    : 'Not linked'}
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setSelectedMeter(meter)
                      setEditMeter({ meter_id: meter.meter_id, name: meter.name, is_active: meter.is_active })
                      setShowSettingsModal(true)
                    }}
                  >
                    <Settings size={14} />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCTPTRatiosTab = () => (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={18} color="#f59e0b" />
          CT/PT Ratio Management
        </h3>
      </div>
      <div style={{ padding: '1rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
          Current Transformer (CT) and Potential Transformer (PT) ratios affect measurement accuracy. Configure these for each metered asset.
        </p>
        <table>
          <thead>
            <tr>
              <th>Meter</th>
              <th>Protocol</th>
              <th>CT Ratio</th>
              <th>PT Ratio</th>
              <th>Scaling Factor</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeters
              .filter(m => m.connectivity?.protocol)
              .map(meter => (
                <tr key={meter.id}>
                  <td style={{ fontWeight: 500 }}>{meter.name}</td>
                  <td>{getProtocolLabel(meter.connectivity?.protocol || null)}</td>
                  <td style={{ color: '#f59e0b' }}>1:1</td>
                  <td style={{ color: '#f59e0b' }}>1:1</td>
                  <td>1.000</td>
                </tr>
              ))}
          </tbody>
        </table>
        {filteredMeters.filter(m => m.connectivity?.protocol).length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <Zap size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
            <p>No meters with configured protocols found. Link meters to data sources first.</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'all-meters':
        return renderAllMetersTab()
      case 'readings':
        return renderReadingsTab()
      case 'alarms':
        return renderAlarmsTab()
      case 'billing':
        return renderBillingTab()
      case 'settings':
        return renderSettingsTab()
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
