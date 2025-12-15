import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { 
  Gauge, CheckCircle, XCircle, Clock, Plus, Wifi, WifiOff, 
  Settings, RefreshCw, Link2, Radio, AlertTriangle
} from 'lucide-react'

interface MeterWithConnectivity {
  id: number
  meter_id: string
  name: string
  is_active: boolean
  last_reading_at: string | null
  asset_id: number | null
  site_id: number
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

export default function Meters() {
  const queryClient = useQueryClient()
  const { data: meters, isLoading } = useQuery({ queryKey: ['meters'], queryFn: () => api.meters.list() })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  
  const [showAddMeter, setShowAddMeter] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [selectedMeter, setSelectedMeter] = useState<MeterWithConnectivity | null>(null)
  
  const [newMeter, setNewMeter] = useState({
    meter_id: '',
    name: '',
    site_id: '',
    is_active: true
  })

  const [connectionConfig, setConnectionConfig] = useState({
    protocol: 'modbus_tcp' as 'modbus_tcp' | 'mbus' | 'modbus_rtu',
    address: '',
    slaveId: 1,
    registerStart: 0,
    pollInterval: 60
  })

  const metersWithConnectivity: MeterWithConnectivity[] = (meters || []).map((m: any, i: number) => ({
    ...m,
    connectivity: {
      protocol: i % 3 === 0 ? 'modbus_tcp' : i % 3 === 1 ? 'mbus' : 'modbus_rtu',
      address: i % 3 === 0 ? `192.168.1.${100 + i}:502` : i % 3 === 1 ? `0x0${i + 1}` : `/dev/ttyUSB0:${i + 1}`,
      status: i % 4 === 3 ? 'error' : i % 5 === 4 ? 'disconnected' : 'connected',
      gatewayId: i < 3 ? 1 : 2,
      gatewayName: i < 3 ? 'Main Building Gateway' : 'Solar Array Gateway',
      lastPoll: new Date(Date.now() - Math.random() * 300000),
      errorMessage: i % 4 === 3 ? 'Connection timeout after 30s' : null
    }
  }))

  const createMeterMutation = useMutation({
    mutationFn: async (data: typeof newMeter) => {
      const response = await fetch('/api/v1/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, site_id: parseInt(data.site_id) })
      })
      if (!response.ok) throw new Error('Failed to create meter')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      setShowAddMeter(false)
      setNewMeter({ meter_id: '', name: '', site_id: '', is_active: true })
    }
  })

  const handleAddMeter = () => {
    createMeterMutation.mutate(newMeter)
  }

  const handleConnect = () => {
    console.log('Connecting meter:', selectedMeter?.id, 'with config:', connectionConfig)
    setShowConnectModal(false)
    setSelectedMeter(null)
  }

  const handleTestConnection = (meter: MeterWithConnectivity) => {
    console.log('Testing connection for meter:', meter.id)
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

      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Meters</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{metersWithConnectivity.length}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Connected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
            {metersWithConnectivity.filter(m => m.connectivity?.status === 'connected').length}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Disconnected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748b' }}>
            {metersWithConnectivity.filter(m => m.connectivity?.status === 'disconnected').length}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Errors</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
            {metersWithConnectivity.filter(m => m.connectivity?.status === 'error').length}
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p>Loading meters...</p>
        ) : metersWithConnectivity.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Name</th>
                <th>Protocol</th>
                <th>Address</th>
                <th>Gateway</th>
                <th>Connection Status</th>
                <th>Last Poll</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {metersWithConnectivity.map((meter) => (
                <tr key={meter.id}>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                      {meter.meter_id}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{meter.name}</td>
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
                    <code style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {meter.connectivity?.address || '-'}
                    </code>
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
                      >
                        <Settings size={14} />
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
