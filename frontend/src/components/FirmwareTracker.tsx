import { useState, useEffect } from 'react'
import { Cpu, Edit2, Save, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { api, FirmwareInfo, FirmwareSummary, FirmwareUpdate } from '../services/api'

interface FirmwareTrackerProps {
  siteId: number
}

export default function FirmwareTracker({ siteId }: FirmwareTrackerProps) {
  const [devices, setDevices] = useState<FirmwareInfo[]>([])
  const [summary, setSummary] = useState<FirmwareSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FirmwareUpdate>({})
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all')

  useEffect(() => {
    loadData()
  }, [siteId, filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const hasFirmware = filter === 'all' ? undefined : filter === 'with'
      const [devicesData, summaryData] = await Promise.all([
        api.firmware.list(siteId, hasFirmware),
        api.firmware.summary(siteId)
      ])
      setDevices(devicesData)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to load firmware data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (device: FirmwareInfo) => {
    setEditingId(device.data_source_id)
    setEditForm({
      firmware_version: device.firmware_version || '',
      hardware_version: device.hardware_version || '',
      serial_number: device.serial_number || '',
      manufacturer: device.manufacturer || '',
      model: device.model || ''
    })
  }

  const handleSave = async () => {
    if (!editingId) return
    try {
      await api.firmware.update(editingId, editForm)
      setEditingId(null)
      await loadData()
    } catch (err) {
      console.error('Failed to update firmware:', err)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading firmware data...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{summary.total_devices}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Devices</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{summary.devices_with_firmware}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>With Firmware</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{summary.total_devices - summary.devices_with_firmware}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Unknown</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--info)' }}>{summary.unique_firmware_versions}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Unique Versions</div>
          </div>
        </div>
      )}

      {summary && summary.firmware_breakdown.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Firmware Version Distribution</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {summary.firmware_breakdown.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: item.version === 'Unknown' ? 'var(--bg-tertiary)' : 'var(--primary-dark)',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Cpu size={14} />
                  <span style={{ fontWeight: 500 }}>{item.version}</span>
                  <span style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    padding: '0.125rem 0.5rem', 
                    borderRadius: '1rem',
                    fontSize: '0.75rem'
                  }}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Device Firmware Details</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ minWidth: '120px' }}>
              <option value="all">All Devices</option>
              <option value="with">With Firmware</option>
              <option value="without">Unknown</option>
            </select>
            <button className="btn btn-sm" onClick={loadData}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        <div className="card-body">
          {devices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Cpu size={32} style={{ marginBottom: '0.5rem' }} />
              <p>No devices found</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Firmware</th>
                    <th>Hardware</th>
                    <th>Serial</th>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(device => (
                    <tr key={device.data_source_id}>
                      <td style={{ fontWeight: 500 }}>{device.name}</td>
                      <td>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'var(--bg-tertiary)', 
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem'
                        }}>
                          {device.source_type}
                        </span>
                      </td>
                      {editingId === device.data_source_id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editForm.firmware_version || ''}
                              onChange={e => setEditForm({ ...editForm, firmware_version: e.target.value })}
                              placeholder="v1.0.0"
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editForm.hardware_version || ''}
                              onChange={e => setEditForm({ ...editForm, hardware_version: e.target.value })}
                              placeholder="Rev A"
                              style={{ width: '60px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editForm.serial_number || ''}
                              onChange={e => setEditForm({ ...editForm, serial_number: e.target.value })}
                              placeholder="SN123"
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editForm.manufacturer || ''}
                              onChange={e => setEditForm({ ...editForm, manufacturer: e.target.value })}
                              placeholder="Acme"
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editForm.model || ''}
                              onChange={e => setEditForm({ ...editForm, model: e.target.value })}
                              placeholder="Pro 100"
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-sm btn-primary" onClick={handleSave}>
                                <Save size={14} />
                              </button>
                              <button className="btn btn-sm" onClick={handleCancel}>
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {device.firmware_version ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                                {device.firmware_version}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <AlertCircle size={14} />
                                Unknown
                              </span>
                            )}
                          </td>
                          <td style={{ color: device.hardware_version ? 'inherit' : 'var(--text-muted)' }}>
                            {device.hardware_version || '-'}
                          </td>
                          <td style={{ color: device.serial_number ? 'inherit' : 'var(--text-muted)' }}>
                            {device.serial_number || '-'}
                          </td>
                          <td style={{ color: device.manufacturer ? 'inherit' : 'var(--text-muted)' }}>
                            {device.manufacturer || '-'}
                          </td>
                          <td style={{ color: device.model ? 'inherit' : 'var(--text-muted)' }}>
                            {device.model || '-'}
                          </td>
                          <td>
                            <button className="btn btn-sm" onClick={() => handleEdit(device)}>
                              <Edit2 size={14} /> Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
