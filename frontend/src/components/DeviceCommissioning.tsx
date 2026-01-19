import { useState, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, Award, X } from 'lucide-react'
import { api, CommissioningStatus } from '../services/api'

interface DeviceCommissioningProps {
  sourceId: number
  onClose: () => void
  onCommissioned?: () => void
}

export default function DeviceCommissioning({ sourceId, onClose, onCommissioned }: DeviceCommissioningProps) {
  const [status, setStatus] = useState<CommissioningStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [commissioning, setCommissioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [sourceId])

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.commissioning.getStatus(sourceId)
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }

  const handleCommission = async () => {
    setCommissioning(true)
    setError(null)
    try {
      await api.commissioning.complete(sourceId)
      await loadStatus()
      onCommissioned?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commission device')
    } finally {
      setCommissioning(false)
    }
  }

  const getStepIcon = (completed: boolean, required: boolean) => {
    if (completed) {
      return <CheckCircle size={20} style={{ color: '#10b981' }} />
    }
    if (required) {
      return <Circle size={20} style={{ color: '#f59e0b' }} />
    }
    return <Circle size={20} style={{ color: '#475569' }} />
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: '#10b981' }} />
            Device Commissioning
          </h3>
          <button className="btn btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              padding: '0.75rem', 
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {status && (
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0.5rem'
              }}>
                <div>
                  <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{status.device_name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {status.is_commissioned ? 'Commissioned' : 'Pending Commissioning'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 700, 
                    color: status.progress_percent === 100 ? '#10b981' : '#f59e0b'
                  }}>
                    {status.progress_percent}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {status.required_complete}/{status.required_total} required
                  </div>
                </div>
              </div>

              <div style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#334155', 
                borderRadius: '4px',
                marginBottom: '1.5rem',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${status.progress_percent}%`, 
                  height: '100%', 
                  backgroundColor: status.progress_percent === 100 ? '#10b981' : '#f59e0b',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {status.checklist.map(item => (
                  <div
                    key={item.step}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: item.completed ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                      borderRadius: '0.5rem',
                      border: `1px solid ${item.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`
                    }}
                  >
                    {getStepIcon(item.completed, item.required)}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: item.completed ? '#10b981' : '#f1f5f9', 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        {item.name}
                        {!item.required && (
                          <span style={{ 
                            fontSize: '0.625rem', 
                            color: '#64748b',
                            backgroundColor: '#334155',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem'
                          }}>
                            Optional
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {status.is_commissioned ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '0.5rem',
                  color: '#10b981'
                }}>
                  <CheckCircle size={24} style={{ marginBottom: '0.5rem' }} />
                  <div>Device has been commissioned</div>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleCommission}
                  disabled={status.progress_percent < 100 || commissioning}
                >
                  {commissioning ? 'Commissioning...' : 'Complete Commissioning'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
