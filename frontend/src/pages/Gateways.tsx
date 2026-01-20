import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { 
  Radio, Wifi, Plus, Trash2, XCircle, 
  RefreshCw, Clock, Activity, Key, Router, AlertCircle
} from 'lucide-react'
import { api, Gateway, GatewayRegistration } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import GatewayStatusBadge from '../components/GatewayStatusBadge'
import GatewayCredentialsCard from '../components/GatewayCredentialsCard'
import DeviceOnboardingWizard from './DeviceOnboardingWizard'

interface GatewaysProps {
  currentSite: number | null
}

export default function Gateways({ currentSite }: GatewaysProps) {
  const [showAddGateway, setShowAddGateway] = useState(false)
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState<GatewayRegistration | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [gatewayToDelete, setGatewayToDelete] = useState<Gateway | null>(null)
  const [showDeviceWizard, setShowDeviceWizard] = useState(false)
  const [_selectedGatewayForDevice, setSelectedGatewayForDevice] = useState<number | null>(null)
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [, _setLocation] = useLocation()

  const [newGateway, setNewGateway] = useState({
    name: '',
    ip_address: '',
    description: '',
  })

  const { data: gateways, isLoading } = useQuery({
    queryKey: ['gateways', currentSite],
    queryFn: () => api.gateways.list(currentSite || undefined)
  })

  const { data: dataSources } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Gateway>) => api.gateways.create({ ...data, site_id: currentSite || 1 }),
    onSuccess: () => {
      success('Gateway created successfully')
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
      setShowAddGateway(false)
      setNewGateway({ name: '', ip_address: '', description: '' })
    },
    onError: (err: any) => showError(err.message || 'Failed to create gateway')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.gateways.delete(id),
    onSuccess: () => {
      success('Gateway deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
      setShowDeleteConfirm(false)
      setGatewayToDelete(null)
    },
    onError: (err: any) => showError(err.message || 'Failed to delete gateway')
  })

  const registerMutation = useMutation({
    mutationFn: (id: number) => api.gateways.register(id),
    onSuccess: (data) => {
      success('Gateway registered - credentials generated')
      setCredentials(data)
      setShowCredentials(true)
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
    },
    onError: (err: any) => showError(err.message || 'Failed to register gateway')
  })

  const rotateMutation = useMutation({
    mutationFn: (id: number) => api.gateways.rotateCredentials(id),
    onSuccess: (data) => {
      success('Credentials rotated - update your gateway configuration')
      setCredentials(data)
      setShowCredentials(true)
    },
    onError: (err: any) => showError(err.message || 'Failed to rotate credentials')
  })

  const handleAddGateway = () => {
    if (!newGateway.name) return
    createMutation.mutate(newGateway)
  }

  const handleRegister = (gateway: Gateway) => {
    setSelectedGateway(gateway)
    registerMutation.mutate(gateway.id)
  }

  const handleRotateCredentials = (gateway: Gateway) => {
    setSelectedGateway(gateway)
    rotateMutation.mutate(gateway.id)
  }

  const handleViewCredentials = async (gateway: Gateway) => {
    try {
      const creds = await api.gateways.getCredentials(gateway.id)
      setSelectedGateway(gateway)
      setCredentials(creds)
      setShowCredentials(true)
    } catch (err: any) {
      if (err.message?.includes('not registered')) {
        handleRegister(gateway)
      } else {
        showError(err.message || 'Failed to get credentials')
      }
    }
  }

  const getDevicesForGateway = (gatewayId: number) => {
    return dataSources?.filter((ds: any) => ds.gateway_id === gatewayId) || []
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return '#10b981'
      case 'offline': return '#64748b'
      case 'configuring': return '#f59e0b'
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
            Gateways
          </h1>
          <p className="page-subtitle">Manage data collection gateways that connect to your meters and sensors</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddGateway(true)}>
          <Plus size={18} />
          Add Gateway
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <AlertCircle size={20} color="#3b82f6" style={{ marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#3b82f6', marginBottom: '0.25rem' }}>What is a Gateway?</div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              A gateway is a hardware device (like a Teltonika RUT200 router) that collects data from your energy meters and sensors, 
              then sends it to SAVE-IT.AI via MQTT or webhooks. After adding a gateway, register it to get connection credentials.
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading gateways...</div>
      ) : !gateways?.length ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Radio size={48} color="#64748b" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>No gateways configured</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Add your first gateway to start collecting data from your devices.</p>
          <button className="btn btn-primary" onClick={() => setShowAddGateway(true)}>
            <Plus size={16} />
            Add Your First Gateway
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {gateways.map((gateway: Gateway) => {
            const devices = getDevicesForGateway(gateway.id)
            return (
              <div key={gateway.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      background: `${getStatusColor(gateway.status || 'offline')}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Router size={24} color={getStatusColor(gateway.status || 'offline')} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: 'white', fontSize: '1rem' }}>{gateway.name}</span>
                        <GatewayStatusBadge status={gateway.status || 'offline'} size="sm" />
                      </div>
                      {gateway.ip_address && (
                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          {gateway.ip_address}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Activity size={12} />
                          {devices.length} device{devices.length !== 1 ? 's' : ''}
                        </span>
                        {gateway.last_seen_at && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} />
                            Last seen {new Date(gateway.last_seen_at).toLocaleString()}
                          </span>
                        )}
                        {gateway.firmware_version && (
                          <span>Firmware: {gateway.firmware_version}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleViewCredentials(gateway)}
                      className="btn btn-secondary btn-sm"
                      title="View Credentials"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                      <Key size={14} />
                      Credentials
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGatewayForDevice(gateway.id)
                        setShowDeviceWizard(true)
                      }}
                      className="btn btn-primary btn-sm"
                      title="Add Device to Gateway"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                    >
                      <Plus size={14} />
                      Add Device
                    </button>
                    <button
                      onClick={() => { setGatewayToDelete(gateway); setShowDeleteConfirm(true) }}
                      className="btn btn-ghost btn-sm"
                      title="Delete Gateway"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {devices.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Connected Devices
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {devices.slice(0, 5).map((device: any) => (
                        <span
                          key={device.id}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: device.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                            border: `1px solid ${device.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            color: device.is_active ? '#10b981' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem'
                          }}
                        >
                          {device.is_active ? <Wifi size={10} /> : <XCircle size={10} />}
                          {device.name}
                        </span>
                      ))}
                      {devices.length > 5 && (
                        <span style={{ padding: '0.25rem 0.75rem', color: '#64748b', fontSize: '0.75rem' }}>
                          +{devices.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddGateway && (
        <div className="modal-overlay" onClick={() => setShowAddGateway(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Gateway</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddGateway(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Gateway Name *</label>
                <input
                  type="text"
                  value={newGateway.name}
                  onChange={e => setNewGateway({ ...newGateway, name: e.target.value })}
                  placeholder="e.g., Main Building Gateway"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">IP Address (optional)</label>
                <input
                  type="text"
                  value={newGateway.ip_address}
                  onChange={e => setNewGateway({ ...newGateway, ip_address: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  value={newGateway.description}
                  onChange={e => setNewGateway({ ...newGateway, description: e.target.value })}
                  placeholder="Where is this gateway located?"
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddGateway(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddGateway}
                disabled={!newGateway.name || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Add Gateway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredentials && credentials && (
        <div className="modal-overlay" onClick={() => setShowCredentials(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Gateway Credentials: {credentials.gateway_name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCredentials(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <GatewayCredentialsCard 
                credentials={credentials} 
                onRotate={() => selectedGateway && handleRotateCredentials(selectedGateway)}
              />
              
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.5rem' }}>
                  <AlertCircle size={16} />
                  Important
                </div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  Save these credentials now - the password cannot be retrieved again. 
                  If lost, use "Rotate Credentials" to generate new ones.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => selectedGateway && handleRotateCredentials(selectedGateway)}
                disabled={rotateMutation.isPending}
              >
                <RefreshCw size={14} />
                Rotate Credentials
              </button>
              <button className="btn btn-primary" onClick={() => setShowCredentials(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => gatewayToDelete && deleteMutation.mutate(gatewayToDelete.id)}
        title="Delete Gateway"
        message={`Are you sure you want to delete "${gatewayToDelete?.name}"? Devices connected to this gateway will be disconnected.`}
        confirmLabel="Delete"
        variant="danger"
      />
      
      <DeviceOnboardingWizard
        isOpen={showDeviceWizard}
        onClose={() => {
          setShowDeviceWizard(false)
          setSelectedGatewayForDevice(null)
        }}
        currentSite={currentSite}
        onComplete={(_dataSourceId: number) => {
          setShowDeviceWizard(false)
          setSelectedGatewayForDevice(null)
          queryClient.invalidateQueries({ queryKey: ['dataSources'] })
          success('Device added to gateway successfully')
        }}
      />
    </div>
  )
}
