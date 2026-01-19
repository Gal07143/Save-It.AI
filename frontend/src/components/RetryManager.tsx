import { useState, useEffect } from 'react'
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Play, RotateCcw, Settings, XCircle } from 'lucide-react'
import { api, RetryQueueItem, RetryStatus, DataSource } from '../services/api'

interface RetryManagerProps {
  siteId: number
}

export default function RetryManager({ siteId }: RetryManagerProps) {
  const [retryQueue, setRetryQueue] = useState<RetryQueueItem[]>([])
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedSource, setSelectedSource] = useState<number | null>(null)
  const [retryStatus, setRetryStatus] = useState<RetryStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [configForm, setConfigForm] = useState({
    max_retries: 5,
    retry_delay_seconds: 30,
    backoff_multiplier: 2.0
  })

  useEffect(() => {
    loadData()
  }, [siteId])

  useEffect(() => {
    if (selectedSource) {
      loadRetryStatus(selectedSource)
    }
  }, [selectedSource])

  const loadData = async () => {
    setLoading(true)
    try {
      const [queueData, sourcesData] = await Promise.all([
        api.retryLogic.getQueue(siteId),
        api.dataSources.list(siteId)
      ])
      setRetryQueue(queueData)
      setDataSources(sourcesData)
    } catch (err) {
      console.error('Failed to load retry data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRetryStatus = async (sourceId: number) => {
    try {
      const status = await api.retryLogic.getStatus(sourceId)
      setRetryStatus(status)
      setConfigForm({
        max_retries: status.max_retries,
        retry_delay_seconds: status.retry_delay_seconds,
        backoff_multiplier: status.backoff_multiplier
      })
    } catch (err) {
      console.error('Failed to load retry status:', err)
    }
  }

  const handleForceRetry = async (sourceId: number) => {
    setActionLoading(sourceId)
    try {
      await api.retryLogic.forceRetry(sourceId)
      await loadData()
      if (selectedSource === sourceId) {
        await loadRetryStatus(sourceId)
      }
    } catch (err) {
      console.error('Failed to force retry:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetRetry = async (sourceId: number) => {
    setActionLoading(sourceId)
    try {
      await api.retryLogic.resetRetry(sourceId)
      await loadData()
      if (selectedSource === sourceId) {
        await loadRetryStatus(sourceId)
      }
    } catch (err) {
      console.error('Failed to reset retry:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSimulateFailure = async (sourceId: number) => {
    setActionLoading(sourceId)
    try {
      await api.retryLogic.simulateFailure(sourceId, 'Test failure simulation')
      await loadData()
      if (selectedSource === sourceId) {
        await loadRetryStatus(sourceId)
      }
    } catch (err) {
      console.error('Failed to simulate failure:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSimulateSuccess = async (sourceId: number) => {
    setActionLoading(sourceId)
    try {
      await api.retryLogic.simulateSuccess(sourceId)
      await loadData()
      if (selectedSource === sourceId) {
        await loadRetryStatus(sourceId)
      }
    } catch (err) {
      console.error('Failed to simulate success:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateConfig = async () => {
    if (!selectedSource) return
    try {
      await api.retryLogic.updateConfig(selectedSource, configForm)
      await loadRetryStatus(selectedSource)
      setShowConfig(false)
    } catch (err) {
      console.error('Failed to update config:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle size={16} style={{ color: 'var(--success)' }} />
      case 'retrying':
        return <RefreshCw size={16} style={{ color: 'var(--warning)' }} className="spin" />
      case 'error':
        return <XCircle size={16} style={{ color: 'var(--danger)' }} />
      case 'offline':
        return <AlertTriangle size={16} style={{ color: 'var(--text-muted)' }} />
      default:
        return <Clock size={16} style={{ color: 'var(--text-muted)' }} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'var(--success)'
      case 'retrying': return 'var(--warning)'
      case 'error': return 'var(--danger)'
      case 'offline': return 'var(--text-muted)'
      default: return 'var(--text-muted)'
    }
  }

  const formatTimeUntil = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    if (diff < 0) return 'Overdue'
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading retry data...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div className="card">
        <div className="card-header">
          <h3>Retry Queue</h3>
          <button className="btn btn-sm" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="card-body">
          {retryQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} style={{ marginBottom: '0.5rem', color: 'var(--success)' }} />
              <p>No devices pending retry</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {retryQueue.map(item => (
                <div
                  key={item.data_source_id}
                  onClick={() => setSelectedSource(item.data_source_id)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: selectedSource === item.data_source_id ? 'var(--primary-dark)' : 'var(--bg-secondary)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    border: selectedSource === item.data_source_id ? '1px solid var(--primary)' : '1px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getStatusIcon(item.connection_status)}
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.25rem',
                      backgroundColor: getStatusColor(item.connection_status),
                      color: 'white'
                    }}>
                      {item.connection_status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <span>Retries: {item.current_retry_count}/{item.max_retries}</span>
                    {item.next_retry_at && (
                      <span style={{ marginLeft: '1rem' }}>
                        Next: {formatTimeUntil(item.next_retry_at)}
                      </span>
                    )}
                  </div>
                  {item.last_error && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                      {item.last_error.substring(0, 50)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>All Data Sources</h4>
            <select
              value={selectedSource || ''}
              onChange={e => setSelectedSource(e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%' }}
            >
              <option value="">Select a data source...</option>
              {dataSources.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Retry Status</h3>
          {selectedSource && (
            <button className="btn btn-sm" onClick={() => setShowConfig(!showConfig)}>
              <Settings size={14} /> Config
            </button>
          )}
        </div>
        <div className="card-body">
          {!selectedSource ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ marginBottom: '0.5rem' }} />
              <p>Select a data source to view retry status</p>
            </div>
          ) : !retryStatus ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <RefreshCw className="spin" size={24} />
            </div>
          ) : (
            <>
              {showConfig ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label>Max Retries</label>
                    <input
                      type="number"
                      value={configForm.max_retries}
                      onChange={e => setConfigForm({ ...configForm, max_retries: Number(e.target.value) })}
                      min={1}
                      max={20}
                    />
                  </div>
                  <div>
                    <label>Initial Delay (seconds)</label>
                    <input
                      type="number"
                      value={configForm.retry_delay_seconds}
                      onChange={e => setConfigForm({ ...configForm, retry_delay_seconds: Number(e.target.value) })}
                      min={5}
                      max={3600}
                    />
                  </div>
                  <div>
                    <label>Backoff Multiplier</label>
                    <input
                      type="number"
                      value={configForm.backoff_multiplier}
                      onChange={e => setConfigForm({ ...configForm, backoff_multiplier: Number(e.target.value) })}
                      min={1}
                      max={5}
                      step={0.1}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={handleUpdateConfig}>Save Config</button>
                    <button className="btn" onClick={() => setShowConfig(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {getStatusIcon(retryStatus.connection_status)}
                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{retryStatus.connection_status}</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retry Count</div>
                      <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
                        {retryStatus.current_retry_count} / {retryStatus.max_retries}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delay / Backoff</div>
                      <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
                        {retryStatus.retry_delay_seconds}s / {retryStatus.backoff_multiplier}x
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Next Retry</div>
                      <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
                        {formatTimeUntil(retryStatus.next_retry_at)}
                      </div>
                    </div>
                  </div>

                  {retryStatus.last_error && (
                    <div style={{ 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid var(--danger)', 
                      borderRadius: '0.5rem', 
                      padding: '0.75rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 500 }}>Last Error</div>
                      <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{retryStatus.last_error}</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleForceRetry(selectedSource)}
                      disabled={actionLoading === selectedSource}
                    >
                      <Play size={14} /> Force Retry
                    </button>
                    <button 
                      className="btn"
                      onClick={() => handleResetRetry(selectedSource)}
                      disabled={actionLoading === selectedSource}
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                    <button 
                      className="btn"
                      onClick={() => handleSimulateFailure(selectedSource)}
                      disabled={actionLoading === selectedSource}
                      style={{ backgroundColor: 'var(--warning)', color: 'white' }}
                    >
                      <XCircle size={14} /> Sim Fail
                    </button>
                    <button 
                      className="btn"
                      onClick={() => handleSimulateSuccess(selectedSource)}
                      disabled={actionLoading === selectedSource}
                      style={{ backgroundColor: 'var(--success)', color: 'white' }}
                    >
                      <CheckCircle size={14} /> Sim Success
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
