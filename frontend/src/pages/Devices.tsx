import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { 
  Cpu, Search, CheckCircle, Upload, Copy, QrCode, 
  Plus, Wifi, WifiOff, Trash2, Eye, Settings, Router, X,
  Activity, RefreshCw, ExternalLink
} from 'lucide-react'
import { api } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import GatewayStatusBadge from '../components/GatewayStatusBadge'
import DeviceOnboardingWizard from './DeviceOnboardingWizard'

interface DevicesProps {
  currentSite: number | null
}

export default function Devices({ currentSite }: DevicesProps) {
  const [activeTab, setActiveTab] = useState('all-devices')
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [showDeviceDetails, setShowDeviceDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null)
  const [showDeviceWizard, setShowDeviceWizard] = useState(false)
  const [_editDeviceId, setEditDeviceId] = useState<number | null>(null)
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [, setLocation] = useLocation()

  const { data: dataSources, isLoading } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.dataSources.delete(id),
    onSuccess: () => {
      success('Device deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['dataSources'] })
      setShowDeleteConfirm(false)
      setDeviceToDelete(null)
    },
    onError: (err: any) => showError(err.message || 'Failed to delete device')
  })

  const cloneMutation = useMutation({
    mutationFn: (id: number) => api.dataSources.clone(id),
    onSuccess: () => {
      success('Device cloned successfully')
      queryClient.invalidateQueries({ queryKey: ['dataSources'] })
    },
    onError: (err: any) => showError(err.message || 'Failed to clone device')
  })

  const testConnectionMutation = useMutation({
    mutationFn: (device: any) => api.dataSources.testConnection({
      host: device.host,
      port: device.port,
      slave_id: device.slave_id || 1
    }),
    onSuccess: (data) => {
      if (data.success) {
        success('Connection successful!')
      } else {
        showError(data.error || 'Connection failed')
      }
    },
    onError: (err: any) => showError(err.message || 'Connection test failed')
  })

  const tabs: Tab[] = [
    { id: 'all-devices', label: 'All Devices', icon: Cpu, badge: dataSources?.length || 0 },
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'commissioning', label: 'Commissioning', icon: CheckCircle },
    { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
    { id: 'cloning', label: 'Cloning', icon: Copy },
    { id: 'qr-codes', label: 'QR Codes', icon: QrCode }
  ]

  const handleViewDevice = (device: any) => {
    setSelectedDevice(device)
    setShowDeviceDetails(true)
  }

  const handleEditDevice = (device: any) => {
    setEditDeviceId(device.id)
    setShowDeviceWizard(true)
  }
  
  const handleAddDevice = () => {
    setEditDeviceId(null)
    setShowDeviceWizard(true)
  }
  
  const handleWizardComplete = (_dataSourceId: number) => {
    setShowDeviceWizard(false)
    setEditDeviceId(null)
    queryClient.invalidateQueries({ queryKey: ['dataSources'] })
    success('Device configured successfully')
  }

  const renderAllDevices = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'white' }}>Device Inventory</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setLocation('/gateways')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Router size={16} />
            Manage Gateways
          </button>
          <button
            onClick={handleAddDevice}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            Add Device
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading devices...</div>
      ) : !dataSources?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Cpu size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No devices configured yet</p>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Devices are energy meters, sensors, and equipment that your gateways collect data from.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={handleAddDevice}
              className="btn btn-primary"
            >
              <Plus size={16} />
              Add Your First Device
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className="btn btn-secondary"
            >
              <Search size={16} />
              Start Discovery
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {dataSources.map((device: any) => (
            <div
              key={device.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: device.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {device.is_active ? <Wifi size={20} color="#10b981" /> : <WifiOff size={20} color="#ef4444" />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'white' }}>{device.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    {device.source_type} • {device.host}:{device.port}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {device.gateway && (
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    onClick={() => setLocation('/gateways')}
                    title="View gateway"
                  >
                    <Router size={14} color="#64748b" />
                    <GatewayStatusBadge 
                      status={device.gateway.status} 
                      gatewayName={device.gateway.name}
                      size="sm"
                    />
                  </div>
                )}
                
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  background: device.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: device.is_active ? '#10b981' : '#ef4444'
                }}>
                  {device.is_active ? 'Online' : 'Offline'}
                </span>
                <button
                  onClick={() => handleViewDevice(device)}
                  style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleEditDevice(device)}
                  style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  title="Configure Device"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => cloneMutation.mutate(device.id)}
                  style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  title="Clone Device"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => { setDeviceToDelete(device); setShowDeleteConfirm(true) }}
                  style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  title="Delete Device"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderCloning = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Device Cloning</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Clone existing device configurations to quickly set up similar devices.
      </p>
      
      {!dataSources?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Copy size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No devices available to clone</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '1rem' }}>Select Device to Clone</h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {dataSources.map((device: any) => (
              <div
                key={device.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(51, 65, 85, 0.5)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, color: 'white' }}>{device.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{device.source_type}</div>
                </div>
                <button
                  onClick={() => cloneMutation.mutate(device.id)}
                  disabled={cloneMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={14} />
                  Clone
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderQRCodes = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>QR Code Labels</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Generate and print QR code labels for device identification and quick access.
      </p>
      
      {!dataSources?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <QrCode size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No devices available</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ color: 'white', margin: 0 }}>Generate QR Codes</h4>
            <button
              onClick={() => success('QR codes generated', 'All device QR codes are ready for printing')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <QrCode size={14} />
              Generate All
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {dataSources.map((device: any) => (
              <div
                key={device.id}
                style={{
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  width: '100px',
                  height: '100px',
                  margin: '0 auto 1rem',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <QrCode size={60} color="#0f172a" />
                </div>
                <div style={{ fontWeight: 500, color: 'white', marginBottom: '0.25rem' }}>{device.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {device.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderDiscovery = () => (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <Search size={48} color="#3b82f6" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Network Device Discovery</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
        Scan your network to automatically discover compatible energy meters, inverters, and BMS devices.
      </p>
      <button className="btn btn-primary" onClick={() => success('Network scan initiated', 'Scanning for devices on the local network...')}>
        <Search size={16} />
        Start Network Scan
      </button>
    </div>
  )

  const renderCommissioning = () => (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <Settings size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Device Commissioning</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
        Configure and commission newly discovered devices. Set up communication parameters and validate connections.
      </p>
      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Select a device from "All Devices" to start commissioning.</p>
    </div>
  )

  const renderBulkImport = () => (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <Upload size={48} color="#8b5cf6" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Bulk Device Import</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
        Import multiple devices from a CSV or Excel file. Download the template to get started.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={() => success('Template downloaded', 'Check your downloads folder for device_import_template.csv')}>Download Template</button>
        <button className="btn btn-primary" onClick={() => success('Import started', 'Select a CSV file with device data to import')}>
          <Upload size={16} />
          Import Devices
        </button>
      </div>
    </div>
  )

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'all-devices':
        return renderAllDevices()
      case 'discovery':
        return renderDiscovery()
      case 'commissioning':
        return renderCommissioning()
      case 'bulk-import':
        return renderBulkImport()
      case 'cloning':
        return renderCloning()
      case 'qr-codes':
        return renderQRCodes()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', margin: 0 }}>Devices</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Manage meters, sensors, and energy equipment connected through your gateways</p>
      </div>

      <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent}
      </TabPanel>

      {showDeviceDetails && selectedDevice && (
        <div className="modal-overlay" onClick={() => setShowDeviceDetails(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={20} />
                {selectedDevice.name}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeviceDetails(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    background: selectedDevice.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedDevice.is_active ? <Wifi size={24} color="#10b981" /> : <WifiOff size={24} color="#ef4444" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'white' }}>{selectedDevice.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      {selectedDevice.is_active ? 'Online and collecting data' : 'Offline - check connection'}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.375rem 0.875rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: selectedDevice.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: selectedDevice.is_active ? '#10b981' : '#ef4444'
                  }}>
                    {selectedDevice.is_active ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Protocol</div>
                    <div style={{ color: 'white', fontWeight: 500 }}>{selectedDevice.source_type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Address</div>
                    <div style={{ color: 'white', fontWeight: 500, fontFamily: 'monospace' }}>{selectedDevice.host}:{selectedDevice.port}</div>
                  </div>
                  {selectedDevice.slave_id && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Slave ID</div>
                      <div style={{ color: 'white', fontWeight: 500 }}>{selectedDevice.slave_id}</div>
                    </div>
                  )}
                  {selectedDevice.poll_interval_seconds && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Poll Interval</div>
                      <div style={{ color: 'white', fontWeight: 500 }}>{selectedDevice.poll_interval_seconds}s</div>
                    </div>
                  )}
                </div>

                {selectedDevice.gateway && (
                  <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Router size={18} color="#3b82f6" />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Connected via Gateway</div>
                          <div style={{ color: 'white', fontWeight: 500 }}>{selectedDevice.gateway.name}</div>
                        </div>
                      </div>
                      <GatewayStatusBadge status={selectedDevice.gateway.status} size="sm" />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => testConnectionMutation.mutate(selectedDevice)}
                    disabled={testConnectionMutation.isPending}
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {testConnectionMutation.isPending ? <RefreshCw size={16} className="spin" /> : <Activity size={16} />}
                    {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={() => { setShowDeviceDetails(false); handleEditDevice(selectedDevice) }}
                    className="btn btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Settings size={16} />
                    Configure
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setLocation(`/device-health`)}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ExternalLink size={14} />
                View Health Metrics
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeviceDetails(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deviceToDelete && deleteMutation.mutate(deviceToDelete.id)}
        title="Delete Device"
        message={`Are you sure you want to delete "${deviceToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
      
      <DeviceOnboardingWizard
        isOpen={showDeviceWizard}
        onClose={() => {
          setShowDeviceWizard(false)
          setEditDeviceId(null)
        }}
        currentSite={currentSite}
        onComplete={handleWizardComplete}
      />
    </div>
  )
}
