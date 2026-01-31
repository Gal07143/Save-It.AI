import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DeviceTemplate } from '../services/api'

interface TemplateFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<DeviceTemplate>) => Promise<void>
  template?: DeviceTemplate | null
}

export default function TemplateFormModal({ isOpen, onClose, onSave, template }: TemplateFormModalProps) {
  const [formData, setFormData] = useState<Partial<DeviceTemplate>>({
    name: '',
    manufacturer: '',
    model: '',
    protocol: 'modbus_tcp',
    default_port: 502,
    default_slave_id: 1,
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        manufacturer: template.manufacturer || '',
        model: template.model || '',
        protocol: template.protocol || 'modbus_tcp',
        default_port: template.default_port || 502,
        default_slave_id: template.default_slave_id || 1,
        description: template.description || '',
      })
    } else {
      setFormData({
        name: '',
        manufacturer: '',
        model: '',
        protocol: 'modbus_tcp',
        default_port: 502,
        default_slave_id: 1,
        description: '',
      })
    }
    setError(null)
  }, [template, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name?.trim()) {
      setError('Template name is required')
      return
    }
    if (!formData.manufacturer?.trim()) {
      setError('Manufacturer is required')
      return
    }
    if (!formData.model?.trim()) {
      setError('Model is required')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(51, 65, 85, 0.5)',
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.875rem',
  }

  const labelStyle = {
    display: 'block',
    color: '#94a3b8',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.5rem',
            borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
          }}
        >
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.5rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1rem',
                color: '#ef4444',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Template Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Schneider PM5560 Energy Meter"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Manufacturer *</label>
                <input
                  type="text"
                  value={formData.manufacturer || ''}
                  onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., Schneider Electric"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Model *</label>
                <input
                  type="text"
                  value={formData.model || ''}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., PM5560"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Protocol</label>
              <select
                value={formData.protocol || 'modbus_tcp'}
                onChange={e => setFormData({ ...formData, protocol: e.target.value })}
                style={inputStyle}
              >
                <option value="modbus_tcp">Modbus TCP</option>
                <option value="modbus_rtu">Modbus RTU</option>
                <option value="mqtt">MQTT</option>
                <option value="http">HTTP/REST</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Default Port</label>
                <input
                  type="number"
                  value={formData.default_port || 502}
                  onChange={e => setFormData({ ...formData, default_port: parseInt(e.target.value) || 502 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Default Slave ID</label>
                <input
                  type="number"
                  value={formData.default_slave_id || 1}
                  onChange={e => setFormData({ ...formData, default_slave_id: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={247}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this device template..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid rgba(51, 65, 85, 0.5)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.75rem 1.5rem',
                background: saving ? '#065f46' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
