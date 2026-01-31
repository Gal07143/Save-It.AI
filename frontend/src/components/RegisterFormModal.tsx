import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ModbusRegister, ModbusRegisterCreate } from '../services/api'

interface RegisterFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ModbusRegisterCreate) => Promise<void>
  register?: ModbusRegister | null
  dataSourceId: number
}

export default function RegisterFormModal({ isOpen, onClose, onSave, register, dataSourceId }: RegisterFormModalProps) {
  const [formData, setFormData] = useState<ModbusRegisterCreate>({
    data_source_id: dataSourceId,
    name: '',
    register_address: 0,
    register_type: 'holding',
    data_type: 'uint16',
    byte_order: 'big_endian',
    register_count: 1,
    scale_factor: 1,
    offset: 0,
    unit: '',
    is_writable: false,
    is_active: true,
    poll_priority: 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (register) {
      setFormData({
        data_source_id: register.data_source_id,
        meter_id: register.meter_id,
        name: register.name || '',
        description: register.description || '',
        register_address: register.register_address || 0,
        register_type: (register.register_type as ModbusRegisterCreate['register_type']) || 'holding',
        data_type: (register.data_type as ModbusRegisterCreate['data_type']) || 'uint16',
        byte_order: (register.byte_order as ModbusRegisterCreate['byte_order']) || 'big_endian',
        register_count: register.register_count || 1,
        scale_factor: register.scale_factor || 1,
        offset: register.offset || 0,
        unit: register.unit || '',
        is_writable: register.is_writable || false,
        is_active: register.is_active !== false,
        poll_priority: register.poll_priority || 1,
      })
    } else {
      setFormData({
        data_source_id: dataSourceId,
        name: '',
        register_address: 0,
        register_type: 'holding',
        data_type: 'uint16',
        byte_order: 'big_endian',
        register_count: 1,
        scale_factor: 1,
        offset: 0,
        unit: '',
        is_writable: false,
        is_active: true,
        poll_priority: 1,
      })
    }
    setError(null)
  }, [register, dataSourceId, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name?.trim()) {
      setError('Register name is required')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save register')
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
          maxWidth: '600px',
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
            {register ? 'Edit Register' : 'Add Register'}
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Register Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Voltage L1-N"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Address *</label>
                <input
                  type="number"
                  value={formData.register_address}
                  onChange={e => setFormData({ ...formData, register_address: parseInt(e.target.value) || 0 })}
                  min={0}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Register Type</label>
                <select
                  value={formData.register_type}
                  onChange={e => setFormData({ ...formData, register_type: e.target.value as ModbusRegisterCreate['register_type'] })}
                  style={inputStyle}
                >
                  <option value="holding">Holding (4xxxx)</option>
                  <option value="input">Input (3xxxx)</option>
                  <option value="coil">Coil (0xxxx)</option>
                  <option value="discrete">Discrete Input (1xxxx)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Data Type</label>
                <select
                  value={formData.data_type}
                  onChange={e => setFormData({ ...formData, data_type: e.target.value as ModbusRegisterCreate['data_type'] })}
                  style={inputStyle}
                >
                  <option value="uint16">Unsigned 16-bit (uint16)</option>
                  <option value="int16">Signed 16-bit (int16)</option>
                  <option value="uint32">Unsigned 32-bit (uint32)</option>
                  <option value="int32">Signed 32-bit (int32)</option>
                  <option value="float32">32-bit Float (float32)</option>
                  <option value="float64">64-bit Float (float64)</option>
                  <option value="bool">Boolean</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Byte Order</label>
                <select
                  value={formData.byte_order || 'big_endian'}
                  onChange={e => setFormData({ ...formData, byte_order: e.target.value as ModbusRegisterCreate['byte_order'] })}
                  style={inputStyle}
                >
                  <option value="big_endian">Big Endian (AB CD)</option>
                  <option value="little_endian">Little Endian (CD AB)</option>
                  <option value="big_endian_swap">Big Endian Swap (BA DC)</option>
                  <option value="little_endian_swap">Little Endian Swap (DC BA)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Register Count</label>
                <input
                  type="number"
                  value={formData.register_count || 1}
                  onChange={e => setFormData({ ...formData, register_count: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={125}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Scale Factor</label>
                <input
                  type="number"
                  step="any"
                  value={formData.scale_factor || 1}
                  onChange={e => setFormData({ ...formData, scale_factor: parseFloat(e.target.value) || 1 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Offset</label>
                <input
                  type="number"
                  step="any"
                  value={formData.offset || 0}
                  onChange={e => setFormData({ ...formData, offset: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <input
                  type="text"
                  value={formData.unit || ''}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g., V, A, kWh"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_writable || false}
                  onChange={e => setFormData({ ...formData, is_writable: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                Writable
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active !== false}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                Active (poll this register)
              </label>
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
              {saving ? 'Saving...' : register ? 'Update Register' : 'Add Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
