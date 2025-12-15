import { useState } from 'react'
import { 
  Radio, Wifi, Plus, Settings, Trash2, CheckCircle, XCircle, 
  RefreshCw, Link2, Server, Shield, Clock, Activity
} from 'lucide-react'

interface Gateway {
  id: number
  name: string
  type: 'mqtt' | 'https'
  host: string
  port: number
  status: 'online' | 'offline' | 'connecting'
  lastSeen: Date | null
  connectedMeters: number[]
  config: {
    username?: string
    topic?: string
    apiKey?: string
    endpoint?: string
    ssl: boolean
    pollInterval: number
  }
}

interface MeterConnection {
  meterId: number
  meterName: string
  gatewayId: number | null
  protocol: 'mbus' | 'modbus_tcp' | 'modbus_rtu' | null
  address: string
  status: 'connected' | 'disconnected' | 'error'
}

const MOCK_GATEWAYS: Gateway[] = [
  {
    id: 1,
    name: 'Main Building Gateway',
    type: 'mqtt',
    host: 'mqtt.saveit.ai',
    port: 8883,
    status: 'online',
    lastSeen: new Date(),
    connectedMeters: [1, 2, 3],
    config: { username: 'gateway_1', topic: 'meters/#', ssl: true, pollInterval: 60 }
  },
  {
    id: 2,
    name: 'Solar Array Gateway',
    type: 'https',
    host: 'api.solar-inverter.com',
    port: 443,
    status: 'online',
    lastSeen: new Date(Date.now() - 120000),
    connectedMeters: [4, 5],
    config: { endpoint: '/v1/readings', ssl: true, pollInterval: 300 }
  }
]

const MOCK_METERS: MeterConnection[] = [
  { meterId: 1, meterName: 'Main Meter', gatewayId: 1, protocol: 'modbus_tcp', address: '192.168.1.100:502', status: 'connected' },
  { meterId: 2, meterName: 'HVAC Meter', gatewayId: 1, protocol: 'mbus', address: '0x01', status: 'connected' },
  { meterId: 3, meterName: 'Lighting Meter', gatewayId: 1, protocol: 'modbus_rtu', address: '/dev/ttyUSB0:1', status: 'connected' },
  { meterId: 4, meterName: 'Solar Inverter 1', gatewayId: 2, protocol: 'modbus_tcp', address: '10.0.0.50:502', status: 'connected' },
  { meterId: 5, meterName: 'Solar Inverter 2', gatewayId: 2, protocol: 'modbus_tcp', address: '10.0.0.51:502', status: 'error' },
  { meterId: 6, meterName: 'Generator Meter', gatewayId: null, protocol: null, address: '', status: 'disconnected' },
]

export default function Gateways() {
  const [gateways, setGateways] = useState<Gateway[]>(MOCK_GATEWAYS)
  const [meters, setMeters] = useState<MeterConnection[]>(MOCK_METERS)
  const [showAddGateway, setShowAddGateway] = useState(false)
  const [showConnectMeter, setShowConnectMeter] = useState(false)
  const [_selectedGateway, setSelectedGateway] = useState<Gateway | null>(null)
  const [selectedMeter, setSelectedMeter] = useState<MeterConnection | null>(null)

  const [newGateway, setNewGateway] = useState({
    name: '',
    type: 'mqtt' as 'mqtt' | 'https',
    host: '',
    port: 1883,
    username: '',
    password: '',
    topic: 'meters/#',
    apiKey: '',
    endpoint: '/api/readings',
    ssl: true,
    pollInterval: 60
  })

  const [meterConnection, setMeterConnection] = useState({
    gatewayId: 0,
    protocol: 'modbus_tcp' as 'mbus' | 'modbus_tcp' | 'modbus_rtu',
    address: '',
    slaveId: 1
  })

  const handleAddGateway = () => {
    const gateway: Gateway = {
      id: Date.now(),
      name: newGateway.name,
      type: newGateway.type,
      host: newGateway.host,
      port: newGateway.port,
      status: 'connecting',
      lastSeen: null,
      connectedMeters: [],
      config: {
        username: newGateway.username,
        topic: newGateway.topic,
        apiKey: newGateway.apiKey,
        endpoint: newGateway.endpoint,
        ssl: newGateway.ssl,
        pollInterval: newGateway.pollInterval
      }
    }
    setGateways([...gateways, gateway])
    setShowAddGateway(false)
    setNewGateway({
      name: '', type: 'mqtt', host: '', port: 1883, username: '', password: '',
      topic: 'meters/#', apiKey: '', endpoint: '/api/readings', ssl: true, pollInterval: 60
    })
    setTimeout(() => {
      setGateways(prev => prev.map(g => g.id === gateway.id ? { ...g, status: 'online', lastSeen: new Date() } : g))
    }, 2000)
  }

  const handleConnectMeter = () => {
    if (!selectedMeter) return
    setMeters(prev => prev.map(m => 
      m.meterId === selectedMeter.meterId 
        ? { ...m, gatewayId: meterConnection.gatewayId, protocol: meterConnection.protocol, address: meterConnection.address, status: 'connected' }
        : m
    ))
    setShowConnectMeter(false)
    setSelectedMeter(null)
  }

  const handleDeleteGateway = (id: number) => {
    setGateways(prev => prev.filter(g => g.id !== id))
    setMeters(prev => prev.map(m => m.gatewayId === id ? { ...m, gatewayId: null, status: 'disconnected' } : m))
  }

  const handleTestConnection = (gateway: Gateway) => {
    setGateways(prev => prev.map(g => g.id === gateway.id ? { ...g, status: 'connecting' } : g))
    setTimeout(() => {
      setGateways(prev => prev.map(g => g.id === gateway.id ? { ...g, status: 'online', lastSeen: new Date() } : g))
    }, 1500)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': case 'connected': return '#10b981'
      case 'offline': case 'disconnected': return '#64748b'
      case 'connecting': return '#f59e0b'
      case 'error': return '#ef4444'
      default: return '#64748b'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Radio size={28} />
            Gateways & Connectivity
          </h1>
          <p className="page-subtitle">Configure data collection gateways and meter connections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddGateway(true)}>
          <Plus size={18} />
          Add Gateway
        </button>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={20} />
            Configured Gateways
          </h3>
          
          {gateways.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <Radio size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No gateways configured</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAddGateway(true)}>
                Add Your First Gateway
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {gateways.map(gateway => (
                <div 
                  key={gateway.id}
                  style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        {gateway.type === 'mqtt' ? <Wifi size={16} color="#3b82f6" /> : <Link2 size={16} color="#8b5cf6" />}
                        <span style={{ fontWeight: 600 }}>{gateway.name}</span>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: gateway.type === 'mqtt' ? '#dbeafe' : '#ede9fe',
                          color: gateway.type === 'mqtt' ? '#1d4ed8' : '#7c3aed'
                        }}>
                          {gateway.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {gateway.host}:{gateway.port}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {gateway.status === 'online' && <CheckCircle size={12} color="#10b981" />}
                          {gateway.status === 'offline' && <XCircle size={12} color="#64748b" />}
                          {gateway.status === 'connecting' && <RefreshCw size={12} color="#f59e0b" className="spin" />}
                          <span style={{ color: getStatusColor(gateway.status), fontWeight: 500 }}>
                            {gateway.status.charAt(0).toUpperCase() + gateway.status.slice(1)}
                          </span>
                        </span>
                        <span style={{ color: '#94a3b8' }}>
                          {gateway.connectedMeters.length} meters
                        </span>
                        {gateway.lastSeen && (
                          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} />
                            Last seen {Math.round((Date.now() - gateway.lastSeen.getTime()) / 1000 / 60)}m ago
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleTestConnection(gateway)}
                        title="Test Connection"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedGateway(gateway)}
                        title="Configure"
                      >
                        <Settings size={14} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteGateway(gateway.id)}
                        title="Delete"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} />
            Meter Connections
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {meters.map(meter => (
              <div 
                key={meter.meterId}
                style={{
                  padding: '0.75rem 1rem',
                  background: meter.status === 'connected' ? '#f0fdf4' : meter.status === 'error' ? '#fef2f2' : '#f8fafc',
                  borderRadius: '0.5rem',
                  border: `1px solid ${meter.status === 'connected' ? '#bbf7d0' : meter.status === 'error' ? '#fecaca' : '#e2e8f0'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{meter.meterName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {meter.protocol ? (
                      <>
                        <span style={{ 
                          padding: '0.125rem 0.375rem', 
                          background: '#e2e8f0', 
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '0.625rem',
                          marginRight: '0.5rem'
                        }}>
                          {meter.protocol.toUpperCase()}
                        </span>
                        {meter.address}
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not configured</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    background: `${getStatusColor(meter.status)}22`,
                    color: getStatusColor(meter.status)
                  }}>
                    {meter.status === 'connected' && <CheckCircle size={10} />}
                    {meter.status === 'disconnected' && <XCircle size={10} />}
                    {meter.status === 'error' && <XCircle size={10} />}
                    {meter.status.toUpperCase()}
                  </span>
                  {!meter.gatewayId && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => { setSelectedMeter(meter); setShowConnectMeter(true); }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} />
          Connection Protocols
        </h3>
        <div className="grid grid-3" style={{ gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#166534' }}>Modbus TCP/IP</div>
            <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
              Standard industrial protocol over Ethernet. Connect to smart meters and PLCs using IP address and port 502.
            </div>
          </div>
          <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#1e40af' }}>M-Bus (Meter Bus)</div>
            <div style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>
              European standard for utility meter reading. Supports wired connections with primary/secondary addressing.
            </div>
          </div>
          <div style={{ padding: '1rem', background: '#fdf4ff', borderRadius: '0.5rem', border: '1px solid #f5d0fe' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#86198f' }}>Modbus RTU</div>
            <div style={{ fontSize: '0.75rem', color: '#a21caf' }}>
              Serial communication over RS-485. Ideal for legacy meters and industrial equipment.
            </div>
          </div>
        </div>
      </div>

      {showAddGateway && (
        <div className="modal-overlay" onClick={() => setShowAddGateway(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Gateway</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddGateway(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Gateway Name</label>
                <input
                  type="text"
                  value={newGateway.name}
                  onChange={e => setNewGateway({ ...newGateway, name: e.target.value })}
                  placeholder="e.g., Main Building Gateway"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Protocol Type</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${newGateway.type === 'mqtt' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setNewGateway({ ...newGateway, type: 'mqtt', port: 1883 })}
                    style={{ flex: 1 }}
                  >
                    <Wifi size={16} />
                    MQTT
                  </button>
                  <button
                    type="button"
                    className={`btn ${newGateway.type === 'https' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setNewGateway({ ...newGateway, type: 'https', port: 443 })}
                    style={{ flex: 1 }}
                  >
                    <Link2 size={16} />
                    HTTPS API
                  </button>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Host</label>
                  <input
                    type="text"
                    value={newGateway.host}
                    onChange={e => setNewGateway({ ...newGateway, host: e.target.value })}
                    placeholder={newGateway.type === 'mqtt' ? 'mqtt.example.com' : 'api.example.com'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input
                    type="number"
                    value={newGateway.port}
                    onChange={e => setNewGateway({ ...newGateway, port: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {newGateway.type === 'mqtt' && (
                <>
                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        value={newGateway.username}
                        onChange={e => setNewGateway({ ...newGateway, username: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        value={newGateway.password}
                        onChange={e => setNewGateway({ ...newGateway, password: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Topic</label>
                    <input
                      type="text"
                      value={newGateway.topic}
                      onChange={e => setNewGateway({ ...newGateway, topic: e.target.value })}
                      placeholder="meters/#"
                    />
                  </div>
                </>
              )}

              {newGateway.type === 'https' && (
                <>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      type="password"
                      value={newGateway.apiKey}
                      onChange={e => setNewGateway({ ...newGateway, apiKey: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Endpoint Path</label>
                    <input
                      type="text"
                      value={newGateway.endpoint}
                      onChange={e => setNewGateway({ ...newGateway, endpoint: e.target.value })}
                      placeholder="/api/v1/readings"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Poll Interval (seconds)</label>
                  <input
                    type="number"
                    value={newGateway.pollInterval}
                    onChange={e => setNewGateway({ ...newGateway, pollInterval: parseInt(e.target.value) })}
                    min={10}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={newGateway.ssl}
                      onChange={e => setNewGateway({ ...newGateway, ssl: e.target.checked })}
                    />
                    Enable SSL/TLS
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddGateway(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddGateway}
                disabled={!newGateway.name || !newGateway.host}
              >
                Add Gateway
              </button>
            </div>
          </div>
        </div>
      )}

      {showConnectMeter && selectedMeter && (
        <div className="modal-overlay" onClick={() => setShowConnectMeter(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Connect Meter: {selectedMeter.meterName}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConnectMeter(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Gateway</label>
                <select
                  value={meterConnection.gatewayId}
                  onChange={e => setMeterConnection({ ...meterConnection, gatewayId: parseInt(e.target.value) })}
                >
                  <option value={0}>Select Gateway</option>
                  {gateways.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Protocol</label>
                <select
                  value={meterConnection.protocol}
                  onChange={e => setMeterConnection({ ...meterConnection, protocol: e.target.value as any })}
                >
                  <option value="modbus_tcp">Modbus TCP/IP</option>
                  <option value="mbus">M-Bus</option>
                  <option value="modbus_rtu">Modbus RTU</option>
                </select>
              </div>

              {meterConnection.protocol === 'modbus_tcp' && (
                <div className="form-group">
                  <label className="form-label">IP Address:Port</label>
                  <input
                    type="text"
                    value={meterConnection.address}
                    onChange={e => setMeterConnection({ ...meterConnection, address: e.target.value })}
                    placeholder="192.168.1.100:502"
                  />
                </div>
              )}

              {meterConnection.protocol === 'mbus' && (
                <div className="form-group">
                  <label className="form-label">M-Bus Address (hex)</label>
                  <input
                    type="text"
                    value={meterConnection.address}
                    onChange={e => setMeterConnection({ ...meterConnection, address: e.target.value })}
                    placeholder="0x01"
                  />
                </div>
              )}

              {meterConnection.protocol === 'modbus_rtu' && (
                <div className="grid grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Serial Port</label>
                    <input
                      type="text"
                      value={meterConnection.address}
                      onChange={e => setMeterConnection({ ...meterConnection, address: e.target.value })}
                      placeholder="/dev/ttyUSB0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Slave ID</label>
                    <input
                      type="number"
                      value={meterConnection.slaveId}
                      onChange={e => setMeterConnection({ ...meterConnection, slaveId: parseInt(e.target.value) })}
                      min={1}
                      max={247}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowConnectMeter(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleConnectMeter}
                disabled={!meterConnection.gatewayId || !meterConnection.address}
              >
                Connect Meter
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
