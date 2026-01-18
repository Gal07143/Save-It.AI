import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { 
  X, ChevronRight, ChevronLeft, Check, Wifi, WifiOff, 
  Server, Database, CheckCircle, Cpu, Zap, Battery, RefreshCw
} from 'lucide-react'

interface DeviceOnboardingWizardProps {
  isOpen: boolean
  onClose: () => void
  currentSite?: number | null
  onComplete?: (dataSourceId: number) => void
}

type DeviceCategory = 'energy_meter' | 'solar_inverter' | 'bess' | 'gateway'
type ProtocolType = 'modbus_tcp' | 'modbus_rtu' | 'mqtt' | 'https_webhook' | 'direct_inverter' | 'direct_bess'

interface WizardState {
  siteId: number | null
  deviceCategory: DeviceCategory | null
  protocol: ProtocolType | null
  gatewayId: number | null
  connection: {
    host: string
    port: number
    slaveId: number
    mqttBrokerUrl: string
    mqttTopic: string
    mqttPort: number
    mqttUseTls: boolean
    mqttUsername: string
    mqttPassword: string
    webhookUrl: string
    webhookApiKey: string
  }
  deviceName: string
  templateId: number | null
  meterId: number | null
  pollingInterval: number
}

const initialState: WizardState = {
  siteId: null,
  deviceCategory: null,
  protocol: null,
  gatewayId: null,
  connection: {
    host: '',
    port: 502,
    slaveId: 1,
    mqttBrokerUrl: '',
    mqttTopic: '',
    mqttPort: 1883,
    mqttUseTls: false,
    mqttUsername: '',
    mqttPassword: '',
    webhookUrl: '',
    webhookApiKey: ''
  },
  deviceName: '',
  templateId: null,
  meterId: null,
  pollingInterval: 60
}

const deviceCategories = [
  { id: 'energy_meter', label: 'Energy Meter', icon: Zap, description: 'Power meters, CT meters, smart meters' },
  { id: 'solar_inverter', label: 'Solar Inverter', icon: Cpu, description: 'PV inverters from SMA, SolarEdge, Huawei, etc.' },
  { id: 'bess', label: 'Battery Storage', icon: Battery, description: 'Tesla, BYD, LG RESU, Pylontech systems' },
  { id: 'gateway', label: 'Data Gateway', icon: Server, description: 'Aggregation devices for multiple meters' }
]

const protocols = [
  { id: 'modbus_tcp', label: 'Modbus TCP', description: 'Standard industrial protocol over Ethernet' },
  { id: 'modbus_rtu', label: 'Modbus RTU', description: 'Serial protocol via RS-485' },
  { id: 'mqtt', label: 'MQTT', description: 'Lightweight IoT messaging protocol' },
  { id: 'https_webhook', label: 'HTTPS Webhook', description: 'Push data via secure HTTP endpoint' },
  { id: 'direct_inverter', label: 'Direct Inverter API', description: 'Native inverter cloud API connection' },
  { id: 'direct_bess', label: 'Direct BESS API', description: 'Native battery storage cloud API' }
]

export default function DeviceOnboardingWizard({ 
  isOpen, 
  onClose, 
  currentSite,
  onComplete 
}: DeviceOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    ...initialState,
    siteId: currentSite || null
  })
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (currentSite && !state.siteId) {
      setState(prev => ({ ...prev, siteId: currentSite }))
    }
  }, [currentSite])

  const steps = [
    { title: 'Prerequisites', description: 'Select device type and protocol' },
    { title: 'Connect', description: 'Configure connection settings' },
    { title: 'Configure', description: 'Name device and select template' },
    { title: 'Datapoints', description: 'Review and confirm registers' }
  ]

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  
  const effectiveSiteId = state.siteId || currentSite
  
  const { data: gateways } = useQuery({
    queryKey: ['gateways', effectiveSiteId],
    queryFn: () => api.gateways.list(effectiveSiteId || undefined),
    enabled: !!effectiveSiteId
  })

  const { data: templates } = useQuery({
    queryKey: ['device-templates'],
    queryFn: () => api.deviceTemplates.list()
  })

  const { data: meters } = useQuery({
    queryKey: ['meters', effectiveSiteId],
    queryFn: () => api.meters.list(effectiveSiteId || undefined),
    enabled: !!effectiveSiteId
  })

  const filteredTemplates = templates?.filter((t: any) => {
    if (!state.deviceCategory) return true
    if (state.deviceCategory === 'energy_meter') return t.device_type === 'energy_meter'
    if (state.deviceCategory === 'solar_inverter') return t.device_type === 'solar_inverter'
    if (state.deviceCategory === 'bess') return t.device_type === 'bess'
    return true
  }) || []

  const testConnectionMutation = useMutation({
    mutationFn: () => api.dataSources.testConnection({
      host: state.connection.host,
      port: state.connection.port,
      slave_id: state.connection.slaveId
    }),
    onSuccess: (data) => {
      if (data.success) {
        setConnectionStatus('success')
        setConnectionError(null)
      } else {
        setConnectionStatus('error')
        setConnectionError(data.error || 'Connection failed')
      }
    },
    onError: () => {
      setConnectionStatus('error')
      setConnectionError('Failed to test connection')
    }
  })

  const createDataSourceMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: state.deviceName,
        site_id: state.siteId || currentSite,
        source_type: state.protocol,
        polling_interval_seconds: state.pollingInterval,
        is_active: 1
      }
      
      if (state.gatewayId) {
        payload.gateway_id = state.gatewayId
      }
      
      if (state.protocol === 'modbus_tcp' || state.protocol === 'modbus_rtu') {
        payload.host = state.connection.host
        payload.port = state.connection.port
        payload.slave_id = state.connection.slaveId
      } else if (state.protocol === 'mqtt') {
        payload.mqtt_broker_url = state.connection.mqttBrokerUrl
        payload.mqtt_topic = state.connection.mqttTopic
        payload.mqtt_port = state.connection.mqttPort
        payload.mqtt_use_tls = state.connection.mqttUseTls ? 1 : 0
        payload.mqtt_username = state.connection.mqttUsername || null
        payload.mqtt_password = state.connection.mqttPassword || null
      } else if (state.protocol === 'https_webhook') {
        payload.webhook_url = state.connection.webhookUrl
        payload.webhook_api_key = state.connection.webhookApiKey || null
      }

      return api.dataSources.create(payload)
    }
  })

  const applyTemplateMutation = useMutation({
    mutationFn: (dataSourceId: number) => {
      if (!state.templateId) return Promise.resolve({ registers_created: 0 })
      
      return api.deviceTemplates.apply({
        template_id: state.templateId,
        data_source_id: dataSourceId,
        meter_id: state.meterId || null
      })
    }
  })

  const handleTestConnection = () => {
    setConnectionStatus('testing')
    setConnectionError(null)
    testConnectionMutation.mutate()
  }

  const handleComplete = async () => {
    try {
      const dataSource = await createDataSourceMutation.mutateAsync()
      
      if (state.templateId) {
        await applyTemplateMutation.mutateAsync(dataSource.id)
      }
      
      queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-registers'] })
      
      onComplete?.(dataSource.id)
      handleClose()
    } catch (error) {
      console.error('Failed to complete device onboarding:', error)
    }
  }

  const handleClose = () => {
    setState({
      ...initialState,
      siteId: currentSite || null
    })
    setCurrentStep(0)
    setConnectionStatus('idle')
    setConnectionError(null)
    onClose()
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return state.deviceCategory && state.protocol && (currentSite || state.siteId)
      case 1:
        if (state.protocol === 'modbus_tcp' || state.protocol === 'modbus_rtu') {
          return state.connection.host && state.connection.port
        }
        if (state.protocol === 'mqtt') {
          return state.connection.mqttBrokerUrl && state.connection.mqttTopic
        }
        if (state.protocol === 'https_webhook') {
          return state.connection.webhookUrl
        }
        return true
      case 2:
        return state.deviceName.trim().length > 0
      case 3:
        return true
      default:
        return false
    }
  }

  useEffect(() => {
    if (state.templateId && templates) {
      const template = templates.find((t: any) => t.id === state.templateId)
      if (template && !state.deviceName) {
        setState(prev => ({
          ...prev,
          deviceName: `${template.manufacturer} ${template.model}`
        }))
      }
    }
  }, [state.templateId, templates])

  if (!isOpen) return null

  const selectedSite = sites?.find((s: any) => s.id === effectiveSiteId)

  return (
    <div className="modal-overlay" style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', 
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{ 
        backgroundColor: '#1e293b', borderRadius: '12px', width: '800px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '1.5rem', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9' }}>
              Device Onboarding Wizard
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              {selectedSite ? `Adding device to ${selectedSite.name}` : 'Configure a new data source'}
            </p>
          </div>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'
          }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ 
          padding: '1rem 1.5rem', borderBottom: '1px solid #334155',
          display: 'flex', gap: '0.5rem'
        }}>
          {steps.map((step, index) => (
            <div key={index} style={{ 
              flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: index < currentStep ? '#10b981' : 
                  index === currentStep ? '#3b82f6' : '#334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: index <= currentStep ? '#fff' : '#64748b',
                fontSize: '0.75rem', fontWeight: 600
              }}>
                {index < currentStep ? <Check size={14} /> : index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '0.75rem', fontWeight: 600, 
                  color: index === currentStep ? '#f1f5f9' : '#64748b' 
                }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.625rem', color: '#64748b' }}>
                  {step.description}
                </div>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight size={16} style={{ color: '#334155' }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {currentStep === 0 && (
            <div>
              {!currentSite && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', display: 'block', marginBottom: '0.5rem' }}>
                    Select Site *
                  </label>
                  <select
                    value={state.siteId || ''}
                    onChange={(e) => setState(prev => ({ 
                      ...prev, siteId: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Choose a site...</option>
                    {sites?.map((site: any) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                What type of device are you connecting?
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                {deviceCategories.map(cat => (
                  <button key={cat.id} onClick={() => setState(prev => ({ 
                    ...prev, deviceCategory: cat.id as DeviceCategory 
                  }))} style={{
                    padding: '1rem', borderRadius: '8px', textAlign: 'left',
                    backgroundColor: state.deviceCategory === cat.id ? '#1e3a5f' : '#0f172a',
                    border: state.deviceCategory === cat.id ? '2px solid #3b82f6' : '1px solid #334155',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                    <cat.icon size={24} style={{ 
                      color: state.deviceCategory === cat.id ? '#3b82f6' : '#64748b',
                      marginBottom: '0.5rem'
                    }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {cat.description}
                    </div>
                  </button>
                ))}
              </div>

              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                Select communication protocol
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {protocols.map(proto => (
                  <button key={proto.id} onClick={() => setState(prev => ({ 
                    ...prev, protocol: proto.id as ProtocolType 
                  }))} style={{
                    padding: '1rem', borderRadius: '8px', textAlign: 'left',
                    backgroundColor: state.protocol === proto.id ? '#1e3a5f' : '#0f172a',
                    border: state.protocol === proto.id ? '2px solid #3b82f6' : '1px solid #334155',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                        {proto.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {proto.description}
                      </div>
                    </div>
                    {state.protocol === proto.id && (
                      <CheckCircle size={20} style={{ color: '#3b82f6' }} />
                    )}
                  </button>
                ))}
              </div>

              {state.deviceCategory !== 'gateway' && (gateways?.length ?? 0) > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', display: 'block', marginBottom: '0.5rem' }}>
                    Connect via Gateway (optional)
                  </label>
                  <select
                    value={state.gatewayId || ''}
                    onChange={(e) => setState(prev => ({ 
                      ...prev, gatewayId: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Direct connection (no gateway)</option>
                    {gateways?.map((gw: any) => (
                      <option key={gw.id} value={gw.id}>{gw.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                Connection Settings
              </h3>
              
              {(state.protocol === 'modbus_tcp' || state.protocol === 'modbus_rtu') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Host / IP Address *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="192.168.1.100"
                      value={state.connection.host}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        connection: { ...prev.connection, host: e.target.value }
                      }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Port *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={state.connection.port}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          connection: { ...prev.connection, port: parseInt(e.target.value) || 502 }
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Slave ID</label>
                      <input
                        type="number"
                        className="form-input"
                        value={state.connection.slaveId}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          connection: { ...prev.connection, slaveId: parseInt(e.target.value) || 1 }
                        }))}
                      />
                    </div>
                  </div>
                  
                  <div style={{ 
                    padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px',
                    border: '1px solid #334155', marginTop: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {connectionStatus === 'success' && <Wifi size={20} style={{ color: '#10b981' }} />}
                        {connectionStatus === 'error' && <WifiOff size={20} style={{ color: '#ef4444' }} />}
                        {connectionStatus === 'idle' && <Wifi size={20} style={{ color: '#64748b' }} />}
                        {connectionStatus === 'testing' && <RefreshCw size={20} style={{ color: '#3b82f6' }} className="spin" />}
                        <span style={{ 
                          fontSize: '0.875rem', fontWeight: 500,
                          color: connectionStatus === 'success' ? '#10b981' :
                            connectionStatus === 'error' ? '#ef4444' : '#94a3b8'
                        }}>
                          {connectionStatus === 'idle' && 'Test connection before proceeding'}
                          {connectionStatus === 'testing' && 'Testing connection...'}
                          {connectionStatus === 'success' && 'Connection successful!'}
                          {connectionStatus === 'error' && (connectionError || 'Connection failed')}
                        </span>
                      </div>
                      <button
                        onClick={handleTestConnection}
                        disabled={!state.connection.host || connectionStatus === 'testing'}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.875rem' }}
                      >
                        {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {state.protocol === 'mqtt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Broker URL *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="mqtt://broker.example.com"
                      value={state.connection.mqttBrokerUrl}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        connection: { ...prev.connection, mqttBrokerUrl: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Topic *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="devices/meter/data"
                      value={state.connection.mqttTopic}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        connection: { ...prev.connection, mqttTopic: e.target.value }
                      }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Port</label>
                      <input
                        type="number"
                        className="form-input"
                        value={state.connection.mqttPort}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          connection: { ...prev.connection, mqttPort: parseInt(e.target.value) || 1883 }
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={state.connection.mqttUseTls}
                          onChange={(e) => setState(prev => ({
                            ...prev,
                            connection: { ...prev.connection, mqttUseTls: e.target.checked }
                          }))}
                        />
                        Use TLS
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Username (optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={state.connection.mqttUsername}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          connection: { ...prev.connection, mqttUsername: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password (optional)</label>
                      <input
                        type="password"
                        className="form-input"
                        value={state.connection.mqttPassword}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          connection: { ...prev.connection, mqttPassword: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {state.protocol === 'https_webhook' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Webhook URL *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://api.example.com/data"
                      value={state.connection.webhookUrl}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        connection: { ...prev.connection, webhookUrl: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">API Key (optional)</label>
                    <input
                      type="password"
                      className="form-input"
                      value={state.connection.webhookApiKey}
                      onChange={(e) => setState(prev => ({
                        ...prev,
                        connection: { ...prev.connection, webhookApiKey: e.target.value }
                      }))}
                    />
                  </div>
                  <div style={{ 
                    padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px',
                    border: '1px solid #334155'
                  }}>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      A unique webhook endpoint will be generated after device creation. 
                      Configure your device to POST data to this endpoint.
                    </p>
                  </div>
                </div>
              )}

              {(state.protocol === 'direct_inverter' || state.protocol === 'direct_bess') && (
                <div style={{ 
                  padding: '1.5rem', backgroundColor: '#0f172a', borderRadius: '8px',
                  border: '1px solid #334155', textAlign: 'center'
                }}>
                  <Cpu size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
                    Direct Cloud API Connection
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    Connect directly to manufacturer cloud APIs. Select a template in the next step 
                    to configure the API connection details.
                  </p>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Polling Interval (seconds)</label>
                <select
                  className="form-input"
                  value={state.pollingInterval}
                  onChange={(e) => setState(prev => ({ ...prev, pollingInterval: parseInt(e.target.value) }))}
                >
                  <option value={15}>15 seconds (high frequency)</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute (recommended)</option>
                  <option value={300}>5 minutes</option>
                  <option value={900}>15 minutes</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                Device Configuration
              </h3>
              
              <div className="form-group">
                <label className="form-label">Device Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Main Building Meter"
                  value={state.deviceName}
                  onChange={(e) => setState(prev => ({ ...prev, deviceName: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Device Template (optional)</label>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Select a pre-configured template to auto-populate register mappings
                </p>
                <select
                  className="form-input"
                  value={state.templateId || ''}
                  onChange={(e) => setState(prev => ({ 
                    ...prev, templateId: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                >
                  <option value="">No template (manual configuration)</option>
                  {filteredTemplates.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.manufacturer} {t.model} ({t.device_type})
                    </option>
                  ))}
                </select>
              </div>

              {state.templateId && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Link to Meter (optional)</label>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Associate readings with an existing meter for billing and analytics
                  </p>
                  <select
                    className="form-input"
                    value={state.meterId || ''}
                    onChange={(e) => setState(prev => ({ 
                      ...prev, meterId: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  >
                    <option value="">No meter link</option>
                    {meters?.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {state.templateId && (
                <div style={{ 
                  marginTop: '1.5rem', padding: '1rem', backgroundColor: '#0f172a',
                  borderRadius: '8px', border: '1px solid #334155'
                }}>
                  {(() => {
                    const template = templates?.find((t: any) => t.id === state.templateId)
                    if (!template) return null
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <Database size={16} style={{ color: '#3b82f6' }} />
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                            Template Preview: {template.manufacturer} {template.model}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                          {template.description || `Standard register map for ${template.device_type}`}
                        </p>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Registers will be created in the next step
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                Review Configuration
              </h3>
              
              <div style={{ 
                display: 'flex', flexDirection: 'column', gap: '1rem',
                padding: '1.5rem', backgroundColor: '#0f172a', borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Device Name:</span>
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9', fontWeight: 500 }}>{state.deviceName}</span>
                  
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Device Type:</span>
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                    {deviceCategories.find(c => c.id === state.deviceCategory)?.label || '-'}
                  </span>
                  
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Protocol:</span>
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                    {protocols.find(p => p.id === state.protocol)?.label || '-'}
                  </span>
                  
                  {(state.protocol === 'modbus_tcp' || state.protocol === 'modbus_rtu') && (
                    <>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Host:</span>
                      <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                        {state.connection.host}:{state.connection.port} (Slave ID: {state.connection.slaveId})
                      </span>
                    </>
                  )}
                  
                  {state.protocol === 'mqtt' && (
                    <>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Broker:</span>
                      <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                        {state.connection.mqttBrokerUrl}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Topic:</span>
                      <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                        {state.connection.mqttTopic}
                      </span>
                    </>
                  )}
                  
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Polling:</span>
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                    Every {state.pollingInterval} seconds
                  </span>
                  
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Template:</span>
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                    {state.templateId 
                      ? templates?.find((t: any) => t.id === state.templateId)?.model || 'Selected'
                      : 'None (manual configuration)'
                    }
                  </span>
                  
                  {state.meterId && (
                    <>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Linked Meter:</span>
                      <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                        {meters?.find((m: any) => m.id === state.meterId)?.name || 'Selected'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ 
                marginTop: '1.5rem', padding: '1rem', backgroundColor: '#1e3a5f',
                borderRadius: '8px', border: '1px solid #3b82f6',
                display: 'flex', alignItems: 'center', gap: '0.75rem'
              }}>
                <CheckCircle size={20} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                    Ready to create device
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Click "Complete Setup" to create the data source
                    {state.templateId && ' and apply the selected template'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '1rem 1.5rem', borderTop: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between'
        }}>
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
            className="btn btn-secondary"
            style={{ opacity: currentStep === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} style={{ marginRight: '0.25rem' }} />
            Back
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="btn btn-primary"
            >
              Next
              <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={createDataSourceMutation.isPending}
              className="btn btn-primary"
              style={{ backgroundColor: '#10b981' }}
            >
              {createDataSourceMutation.isPending ? 'Creating...' : 'Complete Setup'}
              <Check size={16} style={{ marginLeft: '0.25rem' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
