import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Cpu, Search, CheckCircle, Upload, Copy, QrCode, 
  Plus, RefreshCw, Wifi, WifiOff, MoreVertical, Trash2, Edit, Eye
} from 'lucide-react'
import { api } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import DeviceDiscovery from '../components/DeviceDiscovery'
import DeviceCommissioning from '../components/DeviceCommissioning'
import BulkDeviceImport from '../components/BulkDeviceImport'

interface DevicesProps {
  currentSite: number | null
}

export default function Devices({ currentSite }: DevicesProps) {
  const [activeTab, setActiveTab] = useState('all-devices')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data: dataSources, isLoading } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const tabs: Tab[] = [
    { id: 'all-devices', label: 'All Devices', icon: Cpu, badge: dataSources?.length || 0 },
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'commissioning', label: 'Commissioning', icon: CheckCircle },
    { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
    { id: 'cloning', label: 'Cloning', icon: Copy },
    { id: 'qr-codes', label: 'QR Codes', icon: QrCode }
  ]

  const handleCloneDevice = async (device: any) => {
    try {
      await api.dataSources.clone(device.id)
      showToast('Device cloned successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['dataSources'] })
    } catch (error: any) {
      showToast(error.message || 'Failed to clone device', 'error')
    }
  }

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return
    try {
      await api.dataSources.delete(deviceToDelete.id)
      showToast('Device deleted successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['dataSources'] })
      setShowDeleteConfirm(false)
      setDeviceToDelete(null)
    } catch (error: any) {
      showToast(error.message || 'Failed to delete device', 'error')
    }
  }

  const renderAllDevices = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'white' }}>Device Inventory</h3>
        <button
          onClick={() => setShowAddModal(true)}
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
          <Plus size={16} />
          Add Device
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading devices...</div>
      ) : !dataSources?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Cpu size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No devices configured yet</p>
          <button
            onClick={() => setActiveTab('discovery')}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Start Discovery
          </button>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  onClick={() => setSelectedDevice(device)}
                  style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleCloneDevice(device)}
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
                  onClick={() => handleCloneDevice(device)}
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

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'all-devices':
        return renderAllDevices()
      case 'discovery':
        return <DeviceDiscovery currentSite={currentSite} />
      case 'commissioning':
        return <DeviceCommissioning currentSite={currentSite} />
      case 'bulk-import':
        return <BulkDeviceImport currentSite={currentSite} />
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
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Manage data sources, discover and commission devices</p>
      </div>

      <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent}
      </TabPanel>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteDevice}
        title="Delete Device"
        message={`Are you sure you want to delete "${deviceToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
