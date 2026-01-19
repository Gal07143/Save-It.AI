import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { 
  Plug, CheckCircle, XCircle, Clock, AlertTriangle, Server, 
  FileCode, Settings, Plus, Wifi, WifiOff, RefreshCw, Play,
  ChevronDown, ChevronRight, Activity, Cpu, Database, Download, Upload, Wand2, Heart
} from 'lucide-react'
import DeviceOnboardingWizard from './DeviceOnboardingWizard'
import BulkDeviceImport from '../components/BulkDeviceImport'
import DeviceHealthDashboard from '../components/DeviceHealthDashboard'
import ValidationRulesManager from '../components/ValidationRulesManager'
import DeviceGroupsManager from '../components/DeviceGroupsManager'
import RetryManager from '../components/RetryManager'
import FirmwareTracker from '../components/FirmwareTracker'
import DeviceDiscovery from '../components/DeviceDiscovery'
import DeviceCommissioning from '../components/DeviceCommissioning'
import MaintenanceManager from '../components/MaintenanceManager'
import DeviceAlertsManager from '../components/DeviceAlertsManager'

const sourceTypeLabels: Record<string, string> = {
  modbus_tcp: 'Modbus TCP',
  modbus_rtu: 'Modbus RTU',
  mqtt: 'MQTT',
  https_webhook: 'HTTPS Webhook',
  bacnet: 'BACnet',
  csv_import: 'CSV Import',
  external_api: 'External API',
  direct_inverter: 'Direct Inverter',
  direct_bess: 'Direct BESS',
  manual: 'Manual Entry',
}

interface IntegrationsProps {
  currentSite?: number | null
}

export default function Integrations({ currentSite }: IntegrationsProps) {
  const [activeTab, setActiveTab] = useState<'gateways' | 'sources' | 'templates' | 'registers' | 'health' | 'validation' | 'groups' | 'retry' | 'firmware' | 'maintenance' | 'alerts'>('sources')
  const [showAddGateway, setShowAddGateway] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [selectedSource, setSelectedSource] = useState<number | null>(null)
  const [showConnectionTest, setShowConnectionTest] = useState(false)
  const [testHost, setTestHost] = useState('')
  const [testPort, setTestPort] = useState(502)
  const [testSlaveId, setTestSlaveId] = useState(1)
  const [testResult, setTestResult] = useState<any>(null)
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [applyTemplateId, setApplyTemplateId] = useState<number | null>(null)
  const [applyDataSourceId, setApplyDataSourceId] = useState<number | null>(null)
  const [applyMeterId, setApplyMeterId] = useState<number | null>(null)
  const [showImportTemplate, setShowImportTemplate] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneSourceId, setCloneSourceId] = useState<number | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [cloneHost, setCloneHost] = useState('')
  const [cloneSlaveId, setCloneSlaveId] = useState<number | undefined>(undefined)
  const [showQRModal, setShowQRModal] = useState(false)
  const [_qrSourceId, setQRSourceId] = useState<number | null>(null)
  const [qrData, setQRData] = useState<any>(null)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [showCommissioning, setShowCommissioning] = useState(false)
  const [commissioningSourceId, setCommissioningSourceId] = useState<number | null>(null)
  
  const [newSource, setNewSource] = useState({
    name: '',
    site_id: '',
    gateway_id: '',
    source_type: 'modbus_tcp',
    host: '',
    port: 502,
    slave_id: 1,
    polling_interval_seconds: 60,
    mqtt_broker_url: '',
    mqtt_topic: '',
    mqtt_username: '',
    mqtt_password: '',
    mqtt_port: 1883,
    mqtt_use_tls: false,
    webhook_url: '',
    webhook_api_key: '',
    webhook_auth_type: 'bearer'
  })

  const [newGateway, setNewGateway] = useState({
    name: '',
    site_id: '',
    ip_address: '',
    description: '',
    firmware_version: '',
    heartbeat_interval_seconds: 60
  })
  
  const queryClient = useQueryClient()

  const { data: dataSources, isLoading: loadingSources } = useQuery({ 
    queryKey: ['data-sources', currentSite], 
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const { data: gateways, isLoading: loadingGateways } = useQuery({
    queryKey: ['gateways', currentSite],
    queryFn: () => api.gateways.list(currentSite || undefined)
  })

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['device-templates'],
    queryFn: () => api.deviceTemplates.list()
  })

  const { data: registers, isLoading: loadingRegisters } = useQuery({
    queryKey: ['modbus-registers', selectedSource],
    queryFn: () => selectedSource ? api.modbusRegisters.list(selectedSource) : Promise.resolve([]),
    enabled: !!selectedSource
  })

  const { data: meters } = useQuery({
    queryKey: ['meters', currentSite],
    queryFn: () => api.meters.list(currentSite || undefined)
  })

  const seedTemplatesMutation = useMutation({
    mutationFn: () => api.deviceTemplates.seed(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-templates'] })
    }
  })

  const importTemplateMutation = useMutation({
    mutationFn: async (jsonData: string) => {
      let data
      try {
        data = JSON.parse(jsonData)
      } catch {
        throw new Error('Invalid JSON format. Please check the template data.')
      }
      return api.deviceTemplates.importTemplate(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-templates'] })
      setShowImportTemplate(false)
      setImportJson('')
      alert('Template imported successfully!')
    },
    onError: (error: Error) => {
      alert(`Import failed: ${error.message}`)
    }
  })

  const handleExportTemplate = async (templateId: number) => {
    try {
      const data = await api.deviceTemplates.exportTemplate(templateId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.template?.manufacturer || 'template'}_${data.template?.model || 'export'}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Failed to export template')
    }
  }

  const testConnectionMutation = useMutation({
    mutationFn: (data: { host: string; port: number; slave_id: number }) => 
      api.dataSources.testConnection(data),
    onSuccess: (data) => {
      setTestResult(data)
    }
  })

  const readRegistersMutation = useMutation({
    mutationFn: (dataSourceId: number) => api.modbusRegisters.read(dataSourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modbus-registers'] })
    }
  })

  const applyTemplateMutation = useMutation({
    mutationFn: (data: { template_id: number; data_source_id: number; meter_id?: number | null }) =>
      api.deviceTemplates.apply(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['modbus-registers'] })
      setShowApplyTemplate(false)
      setApplyMeterId(null)
      setSelectedSource(applyDataSourceId)
      setActiveTab('registers')
      alert(`Template applied! Created ${data.registers_created} registers.`)
    }
  })

  const createDataSourceMutation = useMutation({
    mutationFn: async (data: typeof newSource) => {
      const payload: any = {
        name: data.name,
        site_id: parseInt(data.site_id),
        source_type: data.source_type,
        polling_interval_seconds: data.polling_interval_seconds,
        is_active: 1
      }
      if (data.gateway_id) {
        payload.gateway_id = parseInt(data.gateway_id)
      }
      if (data.source_type === 'modbus_tcp' || data.source_type === 'modbus_rtu') {
        payload.host = data.host
        payload.port = data.port
        payload.slave_id = data.slave_id
      } else if (data.source_type === 'mqtt') {
        payload.mqtt_broker_url = data.mqtt_broker_url
        payload.mqtt_topic = data.mqtt_topic
        payload.mqtt_username = data.mqtt_username || null
        payload.mqtt_password = data.mqtt_password || null
        payload.mqtt_port = data.mqtt_port
        payload.mqtt_use_tls = data.mqtt_use_tls ? 1 : 0
      } else if (data.source_type === 'https_webhook') {
        payload.webhook_url = data.webhook_url
        payload.webhook_api_key = data.webhook_api_key || null
        payload.webhook_auth_type = data.webhook_auth_type
      }
      return api.dataSources.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      setShowAddSource(false)
      setNewSource({
        name: '', site_id: '', gateway_id: '', source_type: 'modbus_tcp', host: '', port: 502, slave_id: 1,
        polling_interval_seconds: 60, mqtt_broker_url: '', mqtt_topic: '', mqtt_username: '',
        mqtt_password: '', mqtt_port: 1883, mqtt_use_tls: false, webhook_url: '', webhook_api_key: '',
        webhook_auth_type: 'bearer'
      })
    }
  })

  const createGatewayMutation = useMutation({
    mutationFn: (data: typeof newGateway) => 
      api.gateways.create({
        ...data,
        site_id: parseInt(data.site_id)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
      setShowAddGateway(false)
      setNewGateway({ name: '', site_id: '', ip_address: '', description: '', firmware_version: '', heartbeat_interval_seconds: 60 })
    }
  })

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const renderGateways = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <Server size={20} style={{ marginRight: '0.5rem' }} />
          Data Collection Gateways
        </h2>
        <button className="btn btn-primary" onClick={() => setShowAddGateway(true)}>
          <Plus size={16} /> Add Gateway
        </button>
      </div>
      
      {loadingGateways ? (
        <p>Loading gateways...</p>
      ) : gateways && gateways.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>IP Address</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>Firmware</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((gw: any) => (
              <tr key={gw.id}>
                <td style={{ fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={16} color="#64748b" />
                    {gw.name}
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{gw.ip_address || '-'}</td>
                <td>
                  {gw.status === 'online' ? (
                    <span className="badge badge-success">
                      <Wifi size={12} style={{ marginRight: '0.25rem' }} /> Online
                    </span>
                  ) : gw.status === 'error' ? (
                    <span className="badge badge-danger">
                      <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} /> Error
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#475569' }}>
                      <WifiOff size={12} style={{ marginRight: '0.25rem' }} /> Offline
                    </span>
                  )}
                </td>
                <td>
                  {gw.last_seen_at ? new Date(gw.last_seen_at).toLocaleString() : 'Never'}
                </td>
                <td>{gw.firmware_version || '-'}</td>
                <td>
                  <button className="btn btn-sm" style={{ marginRight: '0.5rem' }}>Configure</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Server size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Gateways Configured</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Gateways collect data from multiple meters and forward to the platform
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddGateway(true)}>
            <Plus size={16} /> Add First Gateway
          </button>
        </div>
      )}
    </div>
  )

  const renderDataSources = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <Database size={20} style={{ marginRight: '0.5rem' }} />
          Data Sources
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => setShowConnectionTest(true)}>
            <Activity size={16} /> Test Connection
          </button>
          <button className="btn" onClick={() => setShowDiscovery(true)}>
            <Wifi size={16} /> Discover
          </button>
          <button className="btn btn-primary" onClick={() => setShowOnboardingWizard(true)} style={{ backgroundColor: '#10b981' }}>
            <Wand2 size={16} /> Device Wizard
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddSource(true)}>
            <Plus size={16} /> Add Source
          </button>
        </div>
      </div>
      
      {loadingSources ? (
        <p>Loading data sources...</p>
      ) : dataSources && dataSources.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Host / Port</th>
              <th>Status</th>
              <th>Last Poll</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dataSources.map((source: any) => (
              <tr key={source.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedSource(source.id)}>
                <td style={{ fontWeight: 500 }}>{source.name}</td>
                <td>
                  <span className="badge badge-info">
                    {sourceTypeLabels[source.source_type] || source.source_type}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {source.host ? `${source.host}:${source.port || 502}` : '-'}
                </td>
                <td>
                  {source.is_active ? (
                    source.last_error ? (
                      <span className="badge badge-warning">
                        <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} />
                        Error
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Active
                      </span>
                    )
                  ) : (
                    <span className="badge badge-danger">
                      <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                      Inactive
                    </span>
                  )}
                </td>
                <td>
                  {source.last_poll_at ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.875rem' }}>
                      <Clock size={14} />
                      {new Date(source.last_poll_at).toLocaleString()}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Never</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button 
                      className="btn btn-sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedSource(source.id)
                        setActiveTab('registers')
                      }}
                      title="View Registers"
                    >
                      <Settings size={14} />
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const data = await api.qrCodes.get(source.id)
                          setQRData(data)
                          setQRSourceId(source.id)
                          setShowQRModal(true)
                        } catch (err) {
                          console.error('Failed to get QR code:', err)
                        }
                      }}
                      title="Show QR Code"
                    >
                      <Activity size={14} />
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        setCloneSourceId(source.id)
                        setCloneName(source.name + ' (Copy)')
                        setCloneHost(source.host || '')
                        setCloneSlaveId(source.slave_id ? source.slave_id + 1 : undefined)
                        setShowCloneModal(true)
                      }}
                      title="Clone Device"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        setCommissioningSourceId(source.id)
                        setShowCommissioning(true)
                      }}
                      title="Commissioning"
                      style={{ color: '#10b981' }}
                    >
                      <CheckCircle size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Plug size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Data Sources</h3>
          <p style={{ color: '#64748b' }}>Add data sources to start collecting meter data</p>
        </div>
      )}
    </div>
  )

  const renderDeviceTemplates = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <FileCode size={20} style={{ marginRight: '0.5rem' }} />
          Device Templates
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn"
            onClick={() => setShowImportTemplate(true)}
          >
            <Upload size={16} /> Import Template
          </button>
          {(!templates || templates.length === 0) && (
            <button 
              className="btn btn-primary" 
              onClick={() => seedTemplatesMutation.mutate()}
              disabled={seedTemplatesMutation.isPending}
            >
              {seedTemplatesMutation.isPending ? (
                <><RefreshCw size={16} className="spin" /> Loading...</>
              ) : (
                <><Database size={16} /> Load Standard Templates</>
              )}
            </button>
          )}
        </div>
      </div>
      
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Pre-configured register maps for common energy meters. Apply a template to quickly configure registers for a data source.
      </p>
      
      {loadingTemplates ? (
        <p>Loading templates...</p>
      ) : templates && templates.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.map((template: any) => (
            <div 
              key={template.id} 
              style={{ 
                border: '1px solid #334155', 
                borderRadius: '0.5rem',
                overflow: 'hidden'
              }}
            >
              <div 
                style={{ 
                  padding: '1rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: expandedTemplate === template.id ? '#1e293b' : 'transparent'
                }}
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {expandedTemplate === template.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {template.manufacturer} | {template.register_count} registers
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-info">{template.protocol.replace('_', ' ').toUpperCase()}</span>
                  {template.is_system_template && (
                    <span className="badge" style={{ background: '#7c3aed' }}>System</span>
                  )}
                </div>
              </div>
              
              {expandedTemplate === template.id && (
                <div style={{ padding: '1rem', borderTop: '1px solid #334155', background: '#0f172a' }}>
                  <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>{template.description}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Default Port</span>
                      <div style={{ fontFamily: 'monospace' }}>{template.default_port}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Default Slave ID</span>
                      <div style={{ fontFamily: 'monospace' }}>{template.default_slave_id}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExportTemplate(template.id)
                      }}
                    >
                      <Download size={14} /> Export
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setApplyTemplateId(template.id)
                        setApplyMeterId(null)
                        setApplyDataSourceId(null)
                        setShowApplyTemplate(true)
                      }}
                    >
                      Apply to Data Source
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <FileCode size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Device Templates</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Load standard templates for common meters (Schneider, ABB, Siemens, etc.)
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => seedTemplatesMutation.mutate()}
            disabled={seedTemplatesMutation.isPending}
          >
            {seedTemplatesMutation.isPending ? 'Loading...' : 'Load Standard Templates'}
          </button>
        </div>
      )}
    </div>
  )

  const renderRegisters = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <Settings size={20} style={{ marginRight: '0.5rem' }} />
          Modbus Register Configuration
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {selectedSource && (
            <>
              <button 
                className="btn"
                onClick={() => readRegistersMutation.mutate(selectedSource)}
                disabled={readRegistersMutation.isPending}
              >
                <Play size={16} /> {readRegistersMutation.isPending ? 'Reading...' : 'Read Values'}
              </button>
              <button className="btn btn-primary">
                <Plus size={16} /> Add Register
              </button>
            </>
          )}
        </div>
      </div>
      
      {!selectedSource ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Settings size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Select a Data Source</h3>
          <p style={{ color: '#64748b' }}>
            Choose a data source from the Data Sources tab to configure its registers
          </p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('sources')}>
            Go to Data Sources
          </button>
        </div>
      ) : loadingRegisters ? (
        <p>Loading registers...</p>
      ) : registers && registers.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Type</th>
              <th>Data Type</th>
              <th>Scale</th>
              <th>Unit</th>
              <th>Last Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {registers.map((reg: any) => (
              <tr key={reg.id}>
                <td style={{ fontWeight: 500 }}>{reg.name}</td>
                <td style={{ fontFamily: 'monospace' }}>{reg.register_address}</td>
                <td>
                  <span className="badge" style={{ background: '#334155' }}>
                    {reg.register_type}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{reg.data_type}</td>
                <td style={{ fontFamily: 'monospace' }}>{reg.scale_factor}</td>
                <td>{reg.unit || '-'}</td>
                <td style={{ fontFamily: 'monospace', color: '#10b981' }}>
                  {reg.last_value !== null ? reg.last_value.toFixed(2) : '-'}
                </td>
                <td>
                  {reg.is_active ? (
                    reg.last_error ? (
                      <span className="badge badge-warning">Error</span>
                    ) : (
                      <span className="badge badge-success">OK</span>
                    )
                  ) : (
                    <span className="badge" style={{ background: '#475569' }}>Disabled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Settings size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Registers Configured</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Add registers manually or apply a device template
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn btn-primary">
              <Plus size={16} /> Add Register
            </button>
            <button className="btn" onClick={() => setActiveTab('templates')}>
              <FileCode size={16} /> Apply Template
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Integrations</h1>
        <p style={{ color: '#64748b' }}>Manage gateways, data sources, and device configurations</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Active Sources</h3>
          <div className="stat-value">{dataSources?.filter((d: any) => d.is_active).length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Gateways Online</h3>
          <div className="stat-value">{gateways?.filter((g: any) => g.status === 'online').length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Device Templates</h3>
          <div className="stat-value">{templates?.length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>With Errors</h3>
          <div className="stat-value">{dataSources?.filter((d: any) => d.last_error).length || 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button 
          className={`btn ${activeTab === 'gateways' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('gateways')}
        >
          <Server size={16} /> Gateways
        </button>
        <button 
          className={`btn ${activeTab === 'sources' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          <Database size={16} /> Data Sources
        </button>
        <button 
          className={`btn ${activeTab === 'templates' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileCode size={16} /> Device Templates
        </button>
        <button 
          className={`btn ${activeTab === 'registers' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('registers')}
        >
          <Settings size={16} /> Registers
        </button>
        <button 
          className={`btn ${activeTab === 'health' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <Heart size={16} /> Health
        </button>
        <button 
          className={`btn ${activeTab === 'validation' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <AlertTriangle size={16} /> Validation
        </button>
        <button 
          className={`btn ${activeTab === 'groups' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <Database size={16} /> Groups
        </button>
        <button 
          className={`btn ${activeTab === 'retry' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('retry')}
        >
          <RefreshCw size={16} /> Retry
        </button>
        <button 
          className={`btn ${activeTab === 'firmware' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('firmware')}
        >
          <Cpu size={16} /> Firmware
        </button>
        <button 
          className={`btn ${activeTab === 'maintenance' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          <Settings size={16} /> Maintenance
        </button>
        <button 
          className={`btn ${activeTab === 'alerts' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <AlertTriangle size={16} /> Alerts
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn"
            onClick={() => setShowBulkImport(true)}
            style={{ backgroundColor: '#3b82f6', color: 'white' }}
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button 
            className="btn"
            onClick={() => setShowOnboardingWizard(true)}
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            <Wand2 size={16} /> Device Wizard
          </button>
        </div>
      </div>

      {activeTab === 'gateways' && renderGateways()}
      {activeTab === 'sources' && renderDataSources()}
      {activeTab === 'templates' && renderDeviceTemplates()}
      {activeTab === 'registers' && renderRegisters()}
      {activeTab === 'health' && <DeviceHealthDashboard siteId={currentSite || null} />}
      {activeTab === 'validation' && currentSite && <ValidationRulesManager siteId={currentSite} />}
      {activeTab === 'validation' && !currentSite && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle className="mx-auto mb-2" size={32} style={{ color: 'var(--warning)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Please select a site to manage validation rules</p>
        </div>
      )}
      {activeTab === 'groups' && currentSite && <DeviceGroupsManager siteId={currentSite} />}
      {activeTab === 'groups' && !currentSite && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Database className="mx-auto mb-2" size={32} style={{ color: 'var(--warning)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Please select a site to manage device groups</p>
        </div>
      )}
      {activeTab === 'retry' && currentSite && <RetryManager siteId={currentSite} />}
      {activeTab === 'retry' && !currentSite && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <RefreshCw className="mx-auto mb-2" size={32} style={{ color: 'var(--warning)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Please select a site to manage connection retries</p>
        </div>
      )}
      {activeTab === 'firmware' && currentSite && <FirmwareTracker siteId={currentSite} />}
      {activeTab === 'firmware' && !currentSite && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Cpu className="mx-auto mb-2" size={32} style={{ color: 'var(--warning)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Please select a site to view firmware information</p>
        </div>
      )}
      {activeTab === 'maintenance' && <MaintenanceManager siteId={currentSite} dataSources={dataSources || []} />}
      {activeTab === 'alerts' && <DeviceAlertsManager siteId={currentSite} dataSources={dataSources || []} />}

      {showConnectionTest && (
        <div className="modal-overlay" onClick={() => setShowConnectionTest(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Test Modbus Connection</h3>
              <button className="btn btn-sm" onClick={() => setShowConnectionTest(false)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Host/IP Address</label>
                <input 
                  type="text" 
                  value={testHost} 
                  onChange={e => setTestHost(e.target.value)}
                  placeholder="192.168.1.100"
                  style={{ width: '100%', padding: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: 'white' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Port</label>
                  <input 
                    type="number" 
                    value={testPort} 
                    onChange={e => setTestPort(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: 'white' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Slave ID</label>
                  <input 
                    type="number" 
                    value={testSlaveId} 
                    onChange={e => setTestSlaveId(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: 'white' }}
                  />
                </div>
              </div>
              
              {testResult && (
                <div style={{ 
                  padding: '1rem', 
                  borderRadius: '0.5rem', 
                  background: testResult.success ? '#064e3b' : '#7f1d1d',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {testResult.success ? <CheckCircle size={20} color="#10b981" /> : <XCircle size={20} color="#ef4444" />}
                    <strong>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</strong>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{testResult.message}</p>
                  {testResult.response_time_ms && (
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      Response time: {testResult.response_time_ms}ms
                    </p>
                  )}
                </div>
              )}
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => testConnectionMutation.mutate({ host: testHost, port: testPort, slave_id: testSlaveId })}
                disabled={testConnectionMutation.isPending || !testHost}
              >
                {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyTemplate && (
        <div className="modal-overlay" onClick={() => setShowApplyTemplate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Apply Device Template</h3>
              <button className="btn btn-sm" onClick={() => setShowApplyTemplate(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                Select a data source to apply this template's register configuration.
              </p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Data Source</label>
                <select 
                  value={applyDataSourceId || ''}
                  onChange={e => setApplyDataSourceId(parseInt(e.target.value) || null)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    background: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '0.375rem', 
                    color: 'white' 
                  }}
                >
                  <option value="">Select a data source...</option>
                  {dataSources?.filter((ds: any) => 
                    ds.source_type === 'modbus_tcp' || ds.source_type === 'modbus_rtu'
                  ).map((ds: any) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({sourceTypeLabels[ds.source_type]})
                    </option>
                  ))}
                </select>
              </div>
              
              {dataSources?.filter((ds: any) => 
                ds.source_type === 'modbus_tcp' || ds.source_type === 'modbus_rtu'
              ).length === 0 && (
                <div style={{ 
                  padding: '1rem', 
                  background: '#1e293b', 
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#94a3b8' }}>
                    No Modbus data sources available. Create a Modbus TCP or RTU data source first.
                  </p>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Link to Meter (Optional)</label>
                <select 
                  value={applyMeterId || ''}
                  onChange={e => setApplyMeterId(parseInt(e.target.value) || null)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    background: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '0.375rem', 
                    color: 'white' 
                  }}
                >
                  <option value="">No meter (create registers only)</option>
                  {meters?.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.meter_id})
                    </option>
                  ))}
                </select>
                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                  Link registers to a meter for data collection and reporting
                </small>
              </div>
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => {
                  if (applyTemplateId && applyDataSourceId) {
                    applyTemplateMutation.mutate({ 
                      template_id: applyTemplateId, 
                      data_source_id: applyDataSourceId,
                      meter_id: applyMeterId
                    })
                  }
                }}
                disabled={applyTemplateMutation.isPending || !applyDataSourceId || !applyTemplateId}
              >
                {applyTemplateMutation.isPending ? 'Applying...' : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportTemplate && (
        <div className="modal-overlay" onClick={() => setShowImportTemplate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Import Device Template</h3>
              <button className="btn btn-sm" onClick={() => setShowImportTemplate(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                Paste the JSON content from an exported template file to import it.
              </p>
              
              <div className="form-group">
                <label className="form-label">Template JSON</label>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  placeholder='{"version": "1.0", "template": {...}, "registers": [...]}'
                  rows={12}
                  style={{ 
                    width: '100%', 
                    background: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '0.375rem', 
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    padding: '0.75rem'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> Load from File
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          setImportJson(event.target?.result as string || '')
                        }
                        reader.readAsText(file)
                      }
                    }}
                  />
                </label>
                <button 
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => importTemplateMutation.mutate(importJson)}
                  disabled={importTemplateMutation.isPending || !importJson.trim()}
                >
                  {importTemplateMutation.isPending ? 'Importing...' : 'Import Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddSource && (
        <div className="modal-overlay" onClick={() => setShowAddSource(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Add Data Source</h3>
              <button className="btn btn-sm" onClick={() => setShowAddSource(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="e.g., Main Panel Modbus"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Site</label>
                <select
                  value={newSource.site_id}
                  onChange={e => setNewSource({ ...newSource, site_id: e.target.value })}
                >
                  <option value="">Select Site</option>
                  {sites?.map((site: any) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Protocol Type</label>
                <select
                  value={newSource.source_type}
                  onChange={e => setNewSource({ ...newSource, source_type: e.target.value })}
                >
                  <option value="modbus_tcp">Modbus TCP</option>
                  <option value="modbus_rtu">Modbus RTU</option>
                  <option value="mqtt">MQTT</option>
                  <option value="https_webhook">HTTPS Webhook</option>
                  <option value="csv_import">CSV Import</option>
                  <option value="external_api">External API</option>
                  <option value="direct_inverter">Direct Inverter</option>
                  <option value="direct_bess">Direct BESS</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Gateway (Optional)</label>
                <select
                  value={newSource.gateway_id}
                  onChange={e => setNewSource({ ...newSource, gateway_id: e.target.value })}
                >
                  <option value="">Direct Connection (No Gateway)</option>
                  {gateways?.filter((gw: any) => !newSource.site_id || gw.site_id === parseInt(newSource.site_id)).map((gw: any) => (
                    <option key={gw.id} value={gw.id}>{gw.name} ({gw.ip_address || 'No IP'})</option>
                  ))}
                </select>
                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  Connect through a gateway for aggregated data collection
                </small>
              </div>

              {(newSource.source_type === 'modbus_tcp' || newSource.source_type === 'modbus_rtu') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Host / IP Address</label>
                    <input
                      type="text"
                      value={newSource.host}
                      onChange={e => setNewSource({ ...newSource, host: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Port</label>
                      <input
                        type="number"
                        value={newSource.port}
                        onChange={e => setNewSource({ ...newSource, port: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Slave ID</label>
                      <input
                        type="number"
                        value={newSource.slave_id}
                        onChange={e => setNewSource({ ...newSource, slave_id: parseInt(e.target.value) })}
                        min={1} max={247}
                      />
                    </div>
                  </div>
                </>
              )}

              {newSource.source_type === 'mqtt' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Broker URL</label>
                    <input
                      type="text"
                      value={newSource.mqtt_broker_url}
                      onChange={e => setNewSource({ ...newSource, mqtt_broker_url: e.target.value })}
                      placeholder="mqtt://broker.example.com"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Port</label>
                      <input
                        type="number"
                        value={newSource.mqtt_port}
                        onChange={e => setNewSource({ ...newSource, mqtt_port: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Topic</label>
                      <input
                        type="text"
                        value={newSource.mqtt_topic}
                        onChange={e => setNewSource({ ...newSource, mqtt_topic: e.target.value })}
                        placeholder="devices/meter1/#"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Username (optional)</label>
                      <input
                        type="text"
                        value={newSource.mqtt_username}
                        onChange={e => setNewSource({ ...newSource, mqtt_username: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Password (optional)</label>
                      <input
                        type="password"
                        value={newSource.mqtt_password}
                        onChange={e => setNewSource({ ...newSource, mqtt_password: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={newSource.mqtt_use_tls}
                        onChange={e => setNewSource({ ...newSource, mqtt_use_tls: e.target.checked })}
                      />
                      Use TLS/SSL
                    </label>
                  </div>
                </>
              )}

              {newSource.source_type === 'https_webhook' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Webhook URL</label>
                    <input
                      type="text"
                      value={newSource.webhook_url}
                      onChange={e => setNewSource({ ...newSource, webhook_url: e.target.value })}
                      placeholder="https://api.example.com/webhook"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Auth Type</label>
                      <select
                        value={newSource.webhook_auth_type}
                        onChange={e => setNewSource({ ...newSource, webhook_auth_type: e.target.value })}
                      >
                        <option value="bearer">Bearer Token</option>
                        <option value="api_key">API Key</option>
                        <option value="basic">Basic Auth</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">API Key / Token</label>
                      <input
                        type="password"
                        value={newSource.webhook_api_key}
                        onChange={e => setNewSource({ ...newSource, webhook_api_key: e.target.value })}
                        placeholder="Your API key"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Polling Interval (seconds)</label>
                <input
                  type="number"
                  value={newSource.polling_interval_seconds}
                  onChange={e => setNewSource({ ...newSource, polling_interval_seconds: parseInt(e.target.value) })}
                  min={10}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddSource(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => createDataSourceMutation.mutate(newSource)}
                disabled={!newSource.name || !newSource.site_id || createDataSourceMutation.isPending}
              >
                {createDataSourceMutation.isPending ? 'Creating...' : 'Create Data Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddGateway && (
        <div className="modal-overlay" onClick={() => setShowAddGateway(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Gateway</h3>
              <button className="btn btn-sm" onClick={() => setShowAddGateway(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={newGateway.name}
                  onChange={e => setNewGateway({ ...newGateway, name: e.target.value })}
                  placeholder="e.g., Main Building Gateway"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Site</label>
                <select
                  value={newGateway.site_id}
                  onChange={e => setNewGateway({ ...newGateway, site_id: e.target.value })}
                >
                  <option value="">Select Site</option>
                  {sites?.map((site: any) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">IP Address</label>
                <input
                  type="text"
                  value={newGateway.ip_address}
                  onChange={e => setNewGateway({ ...newGateway, ip_address: e.target.value })}
                  placeholder="192.168.1.10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  value={newGateway.description}
                  onChange={e => setNewGateway({ ...newGateway, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Firmware Version</label>
                  <input
                    type="text"
                    value={newGateway.firmware_version}
                    onChange={e => setNewGateway({ ...newGateway, firmware_version: e.target.value })}
                    placeholder="v1.0.0"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Heartbeat Interval (s)</label>
                  <input
                    type="number"
                    value={newGateway.heartbeat_interval_seconds}
                    onChange={e => setNewGateway({ ...newGateway, heartbeat_interval_seconds: parseInt(e.target.value) })}
                    min={10}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddGateway(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => createGatewayMutation.mutate(newGateway)}
                disabled={!newGateway.name || !newGateway.site_id || createGatewayMutation.isPending}
              >
                {createGatewayMutation.isPending ? 'Creating...' : 'Create Gateway'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeviceOnboardingWizard
        isOpen={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        currentSite={currentSite}
        onComplete={(dataSourceId) => {
          setSelectedSource(dataSourceId)
          setActiveTab('registers')
        }}
      />

      <BulkDeviceImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        siteId={currentSite || null}
      />

      {showQRModal && qrData && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Device QR Code</h3>
              <button className="btn btn-sm" onClick={() => setShowQRModal(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '1.5rem', 
                backgroundColor: 'white', 
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                display: 'inline-block'
              }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qr_string)}`}
                  alt="Device QR Code"
                  style={{ display: 'block' }}
                />
              </div>
              <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Device Info</h4>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                  <div><strong>Name:</strong> {qrData.device_info.name}</div>
                  <div><strong>ID:</strong> {qrData.device_info.id}</div>
                  <div><strong>Type:</strong> {qrData.device_info.source_type || 'N/A'}</div>
                  {qrData.device_info.serial_number && <div><strong>Serial:</strong> {qrData.device_info.serial_number}</div>}
                  {qrData.device_info.firmware_version && <div><strong>Firmware:</strong> {qrData.device_info.firmware_version}</div>}
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button 
                  className="btn btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(qrData.qr_string)
                    alert('QR data copied to clipboard!')
                  }}
                >
                  Copy QR Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCloneModal && cloneSourceId && (
        <div className="modal-overlay" onClick={() => setShowCloneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Clone Device</h3>
              <button className="btn btn-sm" onClick={() => setShowCloneModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Create a copy of this device with all its register configurations.
              </p>
              <div className="form-group">
                <label className="form-label">New Device Name *</label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={e => setCloneName(e.target.value)}
                  placeholder="Enter name for cloned device"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Host (optional)</label>
                <input
                  type="text"
                  value={cloneHost}
                  onChange={e => setCloneHost(e.target.value)}
                  placeholder="Same as original if empty"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slave ID (optional)</label>
                <input
                  type="number"
                  value={cloneSlaveId || ''}
                  onChange={e => setCloneSlaveId(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Auto-increment from original"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCloneModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const result = await api.deviceClone.clone(
                      cloneSourceId,
                      cloneName,
                      cloneHost || undefined,
                      cloneSlaveId
                    )
                    if (result.success) {
                      setShowCloneModal(false)
                      queryClient.invalidateQueries({ queryKey: ['data-sources', currentSite] })
                      alert(`Device cloned successfully! ${result.registers_cloned} registers copied.`)
                    }
                  } catch (err) {
                    console.error('Failed to clone device:', err)
                    alert('Failed to clone device')
                  }
                }}
                disabled={!cloneName.trim()}
              >
                Clone Device
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscovery && (
        <DeviceDiscovery 
          onClose={() => setShowDiscovery(false)}
          onDeviceSelect={(device) => {
            setTestHost(device.ip)
            setTestPort(device.port)
            setShowDiscovery(false)
            setShowOnboardingWizard(true)
          }}
        />
      )}

      {showCommissioning && commissioningSourceId && (
        <DeviceCommissioning
          sourceId={commissioningSourceId}
          onClose={() => {
            setShowCommissioning(false)
            setCommissioningSourceId(null)
          }}
          onCommissioned={() => {
            queryClient.invalidateQueries({ queryKey: ['data-sources', currentSite] })
          }}
        />
      )}
    </div>
  )
}
