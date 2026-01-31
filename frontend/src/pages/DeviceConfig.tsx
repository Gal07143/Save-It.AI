import { useState, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  FileCode, Shield, FolderTree, Database, Download, Settings,
  Plus, Edit, Upload, Copy, RefreshCw, Trash2
} from 'lucide-react'
import { api, DeviceTemplate, DataSource, ModbusRegister, ModbusRegisterCreate, TemplateExport, RegisterReadResult } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import ValidationRulesManager from '../components/ValidationRulesManager'
import DeviceGroupsManager from '../components/DeviceGroupsManager'
import TemplateFormModal from '../components/TemplateFormModal'
import RegisterFormModal from '../components/RegisterFormModal'

interface DeviceConfigProps {
  currentSite: number | null
}

export default function DeviceConfig({ currentSite }: DeviceConfigProps) {
  const [activeTab, setActiveTab] = useState('templates')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null)
  const [selectedDataSource, setSelectedDataSource] = useState<number | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [editingRegister, setEditingRegister] = useState<ModbusRegister | null>(null)
  const [readResults, setReadResults] = useState<RegisterReadResult[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['deviceTemplates'],
    queryFn: api.deviceTemplates.list
  })

  const { data: dataSources } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const { data: registers, isLoading: registersLoading, refetch: refetchRegisters } = useQuery({
    queryKey: ['modbusRegisters', selectedDataSource],
    queryFn: () => api.modbusRegisters.list(selectedDataSource!),
    enabled: !!selectedDataSource
  })

  const createTemplateMutation = useMutation({
    mutationFn: (data: Partial<DeviceTemplate>) => api.deviceTemplates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
      success('Template created successfully')
    },
    onError: (e: Error) => showError(e.message)
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceTemplate> }) =>
      api.deviceTemplates.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
      success('Template updated successfully')
    },
    onError: (e: Error) => showError(e.message)
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.deviceTemplates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
      success('Template deleted')
    },
    onError: (e: Error) => showError(e.message)
  })

  const readRegistersMutation = useMutation({
    mutationFn: (dataSourceId: number) => api.modbusRegisters.read(dataSourceId),
    onSuccess: (data) => {
      setReadResults(data)
      refetchRegisters()
      success('Registers read successfully')
    },
    onError: (e: Error) => showError(e.message)
  })

  const createRegisterMutation = useMutation({
    mutationFn: (data: ModbusRegisterCreate) => api.modbusRegisters.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modbusRegisters', selectedDataSource] })
      success('Register added successfully')
    },
    onError: (e: Error) => showError(e.message)
  })

  const updateRegisterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ModbusRegisterCreate> }) =>
      api.modbusRegisters.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modbusRegisters', selectedDataSource] })
      success('Register updated successfully')
    },
    onError: (e: Error) => showError(e.message)
  })

  const deleteRegisterMutation = useMutation({
    mutationFn: (id: number) => api.modbusRegisters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modbusRegisters', selectedDataSource] })
      success('Register deleted')
    },
    onError: (e: Error) => showError(e.message)
  })

  const testConnectionMutation = useMutation({
    mutationFn: (data: { host: string; port: number; slave_id: number }) =>
      api.modbusRegisters.testConnection(data),
    onSuccess: (result) => {
      if (result.success) {
        success(`Connection successful! Response: ${result.response_time_ms}ms`)
      } else {
        showError(result.message)
      }
    },
    onError: (e: Error) => showError(e.message)
  })

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateModalOpen(true)
  }

  const handleEditTemplate = (template: DeviceTemplate) => {
    setEditingTemplate(template)
    setTemplateModalOpen(true)
  }

  const handleSaveTemplate = async (data: Partial<DeviceTemplate>) => {
    if (editingTemplate) {
      await updateTemplateMutation.mutateAsync({ id: editingTemplate.id, data })
    } else {
      await createTemplateMutation.mutateAsync(data)
    }
  }

  const handleCopyTemplate = async (template: DeviceTemplate) => {
    try {
      const exportData = await api.deviceTemplates.exportTemplate(template.id)
      const importData = {
        template: {
          ...exportData.template,
          name: `${exportData.template.name} (Copy)`,
        },
        registers: exportData.registers
      }
      await api.deviceTemplates.importTemplate(importData)
      queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
      success('Template copied successfully')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to copy template')
    }
  }

  const handleDeleteTemplate = async (template: DeviceTemplate) => {
    if (template.is_system_template) {
      showError('Cannot delete system templates')
      return
    }
    if (confirm(`Delete template "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id)
    }
  }

  const handleExportTemplate = async (template: DeviceTemplate) => {
    try {
      const data = await api.deviceTemplates.exportTemplate(template.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${template.manufacturer}_${template.model}_template.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      success('Template exported')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to export template')
    }
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as TemplateExport
      if (!data.template || !data.registers) {
        throw new Error('Invalid template format')
      }
      await api.deviceTemplates.importTemplate({
        template: data.template,
        registers: data.registers
      })
      queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
      success('Template imported successfully')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to import template')
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImportFile(file)
      e.target.value = ''
    }
  }

  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.json')) {
      handleImportFile(file)
    } else {
      showError('Please drop a JSON file')
    }
  }

  const handleAddRegister = () => {
    setEditingRegister(null)
    setRegisterModalOpen(true)
  }

  const handleEditRegister = (register: ModbusRegister) => {
    setEditingRegister(register)
    setRegisterModalOpen(true)
  }

  const handleSaveRegister = async (data: ModbusRegisterCreate) => {
    if (editingRegister) {
      await updateRegisterMutation.mutateAsync({ id: editingRegister.id, data })
    } else {
      await createRegisterMutation.mutateAsync(data)
    }
  }

  const handleDeleteRegister = async (register: ModbusRegister) => {
    if (confirm(`Delete register "${register.name}" at address ${register.register_address}?`)) {
      deleteRegisterMutation.mutate(register.id)
    }
  }

  const handleTestConnection = () => {
    if (!selectedDataSource || !dataSources) return
    const ds = dataSources.find((d: DataSource) => d.id === selectedDataSource)
    if (!ds?.host) {
      showError('Data source has no host configured')
      return
    }
    testConnectionMutation.mutate({
      host: ds.host,
      port: ds.port || 502,
      slave_id: ds.slave_id || 1
    })
  }

  const getReadResult = (registerId: number): RegisterReadResult | undefined => {
    return readResults?.find(r => r.register_id === registerId)
  }

  const tabs: Tab[] = [
    { id: 'templates', label: 'Templates', icon: FileCode, badge: templates?.length || 0 },
    { id: 'validation-rules', label: 'Validation Rules', icon: Shield },
    { id: 'device-groups', label: 'Device Groups', icon: FolderTree },
    { id: 'register-browser', label: 'Register Browser', icon: Database },
    { id: 'import-export', label: 'Import/Export', icon: Download },
    { id: 'default-values', label: 'Default Values', icon: Settings }
  ]

  const renderTemplates = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'white' }}>Device Templates</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={async () => {
              try {
                await api.deviceTemplates.seed()
                queryClient.invalidateQueries({ queryKey: ['deviceTemplates'] })
                success('Standard templates seeded')
              } catch (e: unknown) {
                showError(e instanceof Error ? e.message : 'Failed to seed templates')
              }
            }}
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
            <Database size={14} />
            Seed Standards
          </button>
          <button
            onClick={handleCreateTemplate}
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
            <Plus size={14} />
            Create Template
          </button>
        </div>
      </div>

      {templatesLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading templates...</div>
      ) : !templates?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <FileCode size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No templates configured yet</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {templates.map((template: DeviceTemplate) => (
            <div key={template.id} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ color: 'white', margin: '0 0 0.5rem 0' }}>{template.name}</h4>
                    {template.is_system_template && (
                      <span style={{
                        fontSize: '0.625rem',
                        padding: '0.125rem 0.375rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6',
                        borderRadius: '4px',
                      }}>
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                    {template.manufacturer} • {template.model}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {!template.is_system_template && (
                    <button
                      onClick={() => handleEditTemplate(template)}
                      title="Edit template"
                      style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyTemplate(template)}
                    title="Duplicate template"
                    style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <Copy size={14} />
                  </button>
                  {!template.is_system_template && (
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      title="Delete template"
                      style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {template.register_count || 0} registers • {template.protocol || 'Modbus'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateFormModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />
    </div>
  )

  const renderRegisterBrowser = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ color: 'white', margin: 0 }}>Register Browser</h3>
          <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
            Browse, add, edit, and read Modbus registers from connected devices (TCP/IP or RS-485 via gateway).
          </p>
        </div>
        {selectedDataSource && (
          <button
            onClick={handleAddRegister}
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
            <Plus size={14} />
            Add Register
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Select Device (Data Source)
            </label>
            <select
              value={selectedDataSource || ''}
              onChange={e => {
                setSelectedDataSource(e.target.value ? parseInt(e.target.value) : null)
                setReadResults(null)
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(51, 65, 85, 0.5)',
                borderRadius: '6px',
                color: 'white'
              }}
            >
              <option value="">Choose a device...</option>
              {dataSources?.map((ds: DataSource) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} {ds.host ? `(${ds.host}:${ds.port || 502})` : ds.gateway_id ? '(via Gateway)' : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedDataSource && (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  cursor: testConnectionMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: testConnectionMutation.isPending ? 0.7 : 1,
                }}
              >
                {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => readRegistersMutation.mutate(selectedDataSource)}
                disabled={readRegistersMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: readRegistersMutation.isPending ? '#065f46' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: readRegistersMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: readRegistersMutation.isPending ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} className={readRegistersMutation.isPending ? 'animate-spin' : ''} />
                {readRegistersMutation.isPending ? 'Reading...' : 'Read All Registers'}
              </button>
            </>
          )}
        </div>

        {!selectedDataSource ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '8px',
            color: '#94a3b8'
          }}>
            <Database size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Select a device to browse its Modbus registers</p>
          </div>
        ) : registersLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            Loading registers...
          </div>
        ) : !registers?.length ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '8px',
            color: '#94a3b8'
          }}>
            <Database size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p>No registers configured for this device</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#64748b' }}>
              Click "Add Register" to manually add registers, or apply a template from the Templates tab.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Address</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Data Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Scale</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Unit</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Value</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Quality</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registers.map((reg: ModbusRegister) => {
                  const readResult = getReadResult(reg.id)
                  const displayValue = readResult?.scaled_value ?? reg.last_value
                  const quality = readResult?.quality || (reg.last_value !== undefined ? 'good' : 'unknown')

                  return (
                    <tr key={reg.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <td style={{ padding: '0.75rem', color: '#10b981', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {reg.register_address}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'white', fontSize: '0.875rem' }}>
                        {reg.name}
                        {reg.description && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{reg.description}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6',
                          borderRadius: '4px',
                        }}>
                          {reg.register_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {reg.data_type}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'right' }}>
                        {reg.scale_factor !== 1 ? reg.scale_factor : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                        {reg.unit || '-'}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        color: quality === 'good' ? '#10b981' : quality === 'bad' ? '#ef4444' : '#64748b',
                        fontSize: '0.875rem',
                        textAlign: 'right',
                        fontFamily: 'monospace'
                      }}>
                        {displayValue !== undefined && displayValue !== null ? displayValue.toFixed(2) : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '4px',
                          background: quality === 'good' ? 'rgba(16, 185, 129, 0.1)' :
                                     quality === 'bad' ? 'rgba(239, 68, 68, 0.1)' :
                                     quality === 'stale' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                          color: quality === 'good' ? '#10b981' :
                                 quality === 'bad' ? '#ef4444' :
                                 quality === 'stale' ? '#f59e0b' : '#64748b',
                        }}>
                          {quality}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditRegister(reg)}
                            title="Edit register"
                            style={{ padding: '0.375rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteRegister(reg)}
                            title="Delete register"
                            style={{ padding: '0.375rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDataSource && (
        <RegisterFormModal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          onSave={handleSaveRegister}
          register={editingRegister}
          dataSourceId={selectedDataSource}
        />
      )}
    </div>
  )

  const renderImportExport = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Template Import/Export</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Share device templates between sites or organizations.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={18} />
            Import Template
          </h4>
          <div
            onClick={handleDropZoneClick}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{
              padding: '2rem',
              border: '2px dashed rgba(51, 65, 85, 0.5)',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.5)')}
          >
            <Upload size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Drop JSON file here or click to upload</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Supports exported template JSON files
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} />
            Export Template
          </h4>
          {!templates?.length ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>
              No templates available to export
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
              {templates.map((template: DeviceTemplate) => (
                <div
                  key={template.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '6px'
                  }}
                >
                  <div>
                    <span style={{ color: 'white', display: 'block' }}>{template.name}</span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      {template.manufacturer} • {template.register_count || 0} registers
                    </span>
                  </div>
                  <button
                    onClick={() => handleExportTemplate(template)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Export
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderDefaultValues = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Default Values</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Configure fallback values for missing or invalid data points.
      </p>
      
      <div className="card" style={{ padding: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Data Point</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Default Value</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Condition</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <td style={{ padding: '0.75rem', color: 'white' }}>Power Factor</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>0.95</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When null or out of range</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Power Factor default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <td style={{ padding: '0.75rem', color: 'white' }}>Voltage</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>230</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When communication fails</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Voltage default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', color: 'white' }}>Frequency</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>50</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When null</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Frequency default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <button
          onClick={() => success('Add default value', 'Default value editor coming soon')}
          style={{
            marginTop: '1rem',
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
          <Plus size={14} />
          Add Default Value
        </button>
      </div>
    </div>
  )

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'templates':
        return renderTemplates()
      case 'validation-rules':
        return <ValidationRulesManager siteId={currentSite || undefined} />
      case 'device-groups':
        return <DeviceGroupsManager siteId={currentSite || undefined} />
      case 'register-browser':
        return renderRegisterBrowser()
      case 'import-export':
        return renderImportExport()
      case 'default-values':
        return renderDefaultValues()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', margin: 0 }}>Device Configuration</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Templates, validation rules, and device organization</p>
      </div>

      <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
