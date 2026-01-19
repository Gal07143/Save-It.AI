import { useState } from 'react'
import { Search, Wifi, WifiOff, Plus, RefreshCw } from 'lucide-react'
import { api, DiscoveredDevice } from '../services/api'

interface DeviceDiscoveryProps {
  onDeviceSelect?: (device: DiscoveredDevice) => void
  onClose: () => void
}

export default function DeviceDiscovery({ onDeviceSelect, onClose }: DeviceDiscoveryProps) {
  const [startIp, setStartIp] = useState('192.168.1.1')
  const [endIp, setEndIp] = useState('192.168.1.254')
  const [port, setPort] = useState(502)
  const [timeout, setTimeout] = useState(0.5)
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<DiscoveredDevice[]>([])
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    setResults([])
    try {
      const result = await api.deviceDiscovery.scan(startIp, endIp, port, timeout)
      setResults(result.discovered)
      setScanned(result.scanned)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={20} />
            Device Discovery
          </h3>
          <button className="btn btn-sm" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            padding: '1rem', 
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Start IP</label>
                <input
                  type="text"
                  className="form-input"
                  value={startIp}
                  onChange={e => setStartIp(e.target.value)}
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="form-label">End IP</label>
                <input
                  type="text"
                  className="form-input"
                  value={endIp}
                  onChange={e => setEndIp(e.target.value)}
                  placeholder="192.168.1.254"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Port</label>
                <input
                  type="number"
                  className="form-input"
                  value={port}
                  onChange={e => setPort(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="form-label">Timeout (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={timeout}
                  onChange={e => setTimeout(Number(e.target.value))}
                />
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleScan}
              disabled={scanning}
              style={{ width: '100%' }}
            >
              {scanning ? (
                <>
                  <RefreshCw size={16} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                  Scanning...
                </>
              ) : (
                <>
                  <Search size={16} style={{ marginRight: '0.5rem' }} />
                  Start Scan
                </>
              )}
            </button>
          </div>

          {error && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              padding: '0.75rem', 
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {scanned > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Scanned {scanned} addresses, found {results.length} device(s)
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {results.map((device, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Wifi size={20} style={{ color: '#10b981' }} />
                    <div>
                      <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{device.ip}:{device.port}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {device.protocol.toUpperCase()} - {device.status}
                      </div>
                    </div>
                  </div>
                  {onDeviceSelect && (
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => onDeviceSelect(device)}
                    >
                      <Plus size={14} style={{ marginRight: '0.25rem' }} />
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {scanned > 0 && results.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: '#64748b'
            }}>
              <WifiOff size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No devices found in the specified range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
