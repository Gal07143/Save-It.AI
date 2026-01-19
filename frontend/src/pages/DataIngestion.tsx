import { useState } from 'react'
import { 
  Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, Database, Columns,
  Clock, History, RotateCcw, Calendar, Play, Settings, Eye, Trash2, RefreshCw
} from 'lucide-react'
import FileUpload from '../components/FileUpload'
import { getAuthToken } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

interface ColumnMapping {
  sourceColumn: string
  targetField: string
  dataType: string
}

interface ParsedData {
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
}

interface ImportHistoryItem {
  id: number
  filename: string
  importedAt: string
  rowsImported: number
  rowsError: number
  status: 'success' | 'partial' | 'failed'
  canRollback: boolean
}

interface ScheduledImport {
  id: number
  name: string
  source: string
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
  nextRun: string
  lastRun?: string
  enabled: boolean
}

interface ValidationRule {
  id: string
  field: string
  rule: 'required' | 'range' | 'format' | 'unique'
  params?: { min?: number; max?: number; pattern?: string }
  enabled: boolean
}

const TARGET_FIELDS = [
  { value: 'timestamp', label: 'Timestamp', type: 'datetime', required: true },
  { value: 'meter_id', label: 'Meter ID', type: 'string', required: true },
  { value: 'reading_kwh', label: 'Energy Reading (kWh)', type: 'number', required: true },
  { value: 'power_kw', label: 'Power (kW)', type: 'number', required: false },
  { value: 'voltage', label: 'Voltage (V)', type: 'number', required: false },
  { value: 'current', label: 'Current (A)', type: 'number', required: false },
  { value: 'power_factor', label: 'Power Factor', type: 'number', required: false },
  { value: 'demand_kw', label: 'Demand (kW)', type: 'number', required: false },
  { value: 'ignore', label: '-- Ignore this column --', type: 'ignore', required: false },
]

const MOCK_HISTORY: ImportHistoryItem[] = [
  { id: 1, filename: 'meter_readings_dec_2025.csv', importedAt: '2025-12-15 10:30:00', rowsImported: 8640, rowsError: 0, status: 'success', canRollback: true },
  { id: 2, filename: 'building_a_readings.xlsx', importedAt: '2025-12-14 14:15:00', rowsImported: 4320, rowsError: 12, status: 'partial', canRollback: true },
  { id: 3, filename: 'solar_data_nov.csv', importedAt: '2025-12-10 09:00:00', rowsImported: 2880, rowsError: 0, status: 'success', canRollback: false },
]

const MOCK_SCHEDULES: ScheduledImport[] = [
  { id: 1, name: 'Main Meter Daily', source: 'SFTP: /data/main_meter/', frequency: 'daily', nextRun: '2025-12-16 00:00:00', lastRun: '2025-12-15 00:00:00', enabled: true },
  { id: 2, name: 'Solar Inverter Hourly', source: 'API: SolarEdge', frequency: 'hourly', nextRun: '2025-12-15 21:00:00', lastRun: '2025-12-15 20:00:00', enabled: true },
  { id: 3, name: 'Tenant Meters Weekly', source: 'Email: meters@tenant.com', frequency: 'weekly', nextRun: '2025-12-22 08:00:00', lastRun: '2025-12-15 08:00:00', enabled: false },
]

export default function DataIngestion() {
  const { success, info, warning } = useToast()
  const [activeTab, setActiveTab] = useState<'import' | 'history' | 'schedule' | 'rules'>('import')
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number, errors: number } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [history] = useState<ImportHistoryItem[]>(MOCK_HISTORY)
  const [schedules, setSchedules] = useState<ScheduledImport[]>(MOCK_SCHEDULES)
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([
    { id: '1', field: 'reading_kwh', rule: 'range', params: { min: 0, max: 1000000 }, enabled: true },
    { id: '2', field: 'power_factor', rule: 'range', params: { min: 0, max: 1 }, enabled: true },
    { id: '3', field: 'timestamp', rule: 'format', params: { pattern: 'ISO8601' }, enabled: true },
    { id: '4', field: 'meter_id', rule: 'required', enabled: true },
  ])

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setError(null)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const token = getAuthToken()
      const response = await fetch('/api/v1/data-ingestion/parse', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to parse file')
      }
      
      const data = await response.json()
      setParsedData(data)
      
      const initialMappings: ColumnMapping[] = data.headers.map((header: string) => {
        const matched = TARGET_FIELDS.find(f => 
          header.toLowerCase().includes(f.value.replace('_', ' ')) ||
          header.toLowerCase().includes(f.value.replace('_', ''))
        )
        return {
          sourceColumn: header,
          targetField: matched?.value || 'ignore',
          dataType: matched?.type || 'string'
        }
      })
      setColumnMappings(initialMappings)
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }

  const updateMapping = (index: number, targetField: string) => {
    const field = TARGET_FIELDS.find(f => f.value === targetField)
    setColumnMappings(prev => prev.map((m, i) => 
      i === index ? { ...m, targetField, dataType: field?.type || 'string' } : m
    ))
  }

  const validateMappings = (): boolean => {
    const requiredFields = TARGET_FIELDS.filter(f => f.required).map(f => f.value)
    const mappedFields = columnMappings.map(m => m.targetField)
    
    for (const required of requiredFields) {
      if (!mappedFields.includes(required)) {
        setError(`Required field "${required}" is not mapped`)
        return false
      }
    }
    
    const nonIgnored = mappedFields.filter(f => f !== 'ignore')
    if (new Set(nonIgnored).size !== nonIgnored.length) {
      setError('Each target field can only be mapped once')
      return false
    }
    
    return true
  }

  const handleStartImport = async () => {
    if (!validateMappings()) return
    
    setStep('importing')
    setError(null)
    
    try {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', selectedFile!)
      formData.append('mappings', JSON.stringify(columnMappings))
      
      const response = await fetch('/api/v1/data-ingestion/import', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Import failed')
      }
      
      const result = await response.json()
      setImportResult(result)
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep('mapping')
    }
  }

  const resetImport = () => {
    setStep('upload')
    setSelectedFile(null)
    setParsedData(null)
    setColumnMappings([])
    setError(null)
    setImportResult(null)
  }

  const handleRollback = (id: number) => {
    if (confirm('Are you sure you want to rollback this import? This will delete all imported readings.')) {
      alert(`Rollback initiated for import #${id}`)
    }
  }

  const toggleSchedule = (id: number) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const toggleRule = (id: string) => {
    setValidationRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSpreadsheet size={28} color="#10b981" />
          Data Ingestion
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
          Import meter readings from CSV or Excel files with intelligent column mapping
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'import', label: 'Import Data', icon: Upload },
          { id: 'history', label: 'Import History', icon: History },
          { id: 'schedule', label: 'Scheduled Imports', icon: Calendar },
          { id: 'rules', label: 'Validation Rules', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {['upload', 'mapping', 'preview', 'importing', 'complete'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: step === s ? '#10b981' : 
                             ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > i ? '#10b981' : '#334155',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}>
                  {['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > i ? <Check size={16} /> : i + 1}
                </div>
                <span style={{ 
                  fontSize: '0.875rem', 
                  color: step === s ? '#10b981' : '#64748b',
                  fontWeight: step === s ? 500 : 400
                }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
                {i < 4 && <ArrowRight size={16} color="#64748b" style={{ marginLeft: '0.5rem' }} />}
              </div>
            ))}
          </div>

          <div className="card">
            {step === 'upload' && (
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                  Upload Your Data File
                </h2>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  accept=".csv,.xlsx,.xls"
                  maxSize={50 * 1024 * 1024}
                  label="Drop your CSV or Excel file here"
                  description="Supports .csv, .xlsx, and .xls files up to 50MB"
                />
                {error && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#ef4444'
                  }}>
                    <AlertCircle size={20} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {step === 'mapping' && parsedData && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Columns size={20} />
                      Map Columns to Fields
                    </h2>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                      Found {parsedData.totalRows.toLocaleString()} rows. Map each column to the appropriate meter reading field.
                    </p>
                  </div>
                  <button className="btn btn-outline" onClick={() => setShowPreview(!showPreview)}>
                    <Eye size={18} />
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>

                {showPreview && (
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0f172a', borderRadius: '8px', overflowX: 'auto' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#94a3b8' }}>
                      Data Preview (First 5 Rows)
                    </h3>
                    <table style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr>
                          {parsedData.headers.map(h => (
                            <th key={h} style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.preview.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {parsedData.headers.map(h => (
                              <td key={h} style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                                {row[h] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Source Column</th>
                        <th>Sample Data</th>
                        <th>Map To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columnMappings.map((mapping, index) => (
                        <tr key={mapping.sourceColumn}>
                          <td style={{ fontWeight: 500 }}>{mapping.sourceColumn}</td>
                          <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {parsedData.preview[0]?.[mapping.sourceColumn] || '-'}
                          </td>
                          <td>
                            <select
                              value={mapping.targetField}
                              onChange={(e) => updateMapping(index, e.target.value)}
                              style={{ maxWidth: '200px' }}
                            >
                              {TARGET_FIELDS.map(field => (
                                <option key={field.value} value={field.value}>
                                  {field.label} {field.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {error && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#ef4444'
                  }}>
                    <AlertCircle size={20} />
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-outline" onClick={resetImport}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleStartImport}>
                    <Database size={18} />
                    Start Import
                  </button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '4px solid #334155',
                  borderTopColor: '#10b981',
                  margin: '0 auto 1.5rem',
                  animation: 'spin 1s linear infinite'
                }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Importing Data...
                </h2>
                <p style={{ color: '#64748b' }}>
                  Processing {parsedData?.totalRows.toLocaleString()} rows. Please wait.
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {step === 'complete' && importResult && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <Check size={40} color="white" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Import Complete!
                </h2>
                <p style={{ color: '#64748b', marginBottom: '1rem' }}>
                  Successfully imported {importResult.imported.toLocaleString()} meter readings.
                  {importResult.errors > 0 && ` ${importResult.errors} rows had errors.`}
                </p>
                <button className="btn btn-primary" onClick={resetImport}>
                  Import Another File
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} />
              Import History
            </h2>
            <button className="btn btn-outline btn-sm" onClick={() => success('Import history refreshed')}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Imported At</th>
                <th>Rows Imported</th>
                <th>Errors</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.filename}</td>
                  <td style={{ color: '#64748b' }}>{item.importedAt}</td>
                  <td>{item.rowsImported.toLocaleString()}</td>
                  <td style={{ color: item.rowsError > 0 ? '#f59e0b' : '#10b981' }}>
                    {item.rowsError}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      background: item.status === 'success' ? 'rgba(16, 185, 129, 0.2)' :
                                 item.status === 'partial' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: item.status === 'success' ? '#10b981' :
                             item.status === 'partial' ? '#f59e0b' : '#ef4444'
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.canRollback && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => handleRollback(item.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <RotateCcw size={16} />
                        Rollback
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} />
              Scheduled Imports
            </h2>
            <button className="btn btn-primary btn-sm" onClick={() => info('Add schedule', 'Schedule configuration coming soon')}>
              <Clock size={16} />
              Add Schedule
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {schedules.map(schedule => (
              <div key={schedule.id} style={{
                padding: '1rem',
                background: '#1e293b',
                borderRadius: '8px',
                border: `1px solid ${schedule.enabled ? '#10b981' : '#334155'}`,
                opacity: schedule.enabled ? 1 : 0.7
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{schedule.name}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{schedule.source}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => success('Import started', `Running ${schedule.name} manually...`)}>
                      <Play size={16} />
                      Run Now
                    </button>
                    <button 
                      className={`btn btn-sm ${schedule.enabled ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleSchedule(schedule.id)}
                    >
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => warning('Delete schedule', `Are you sure you want to delete ${schedule.name}?`)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Frequency: </span>
                    <span style={{ textTransform: 'capitalize' }}>{schedule.frequency}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Next Run: </span>
                    <span>{schedule.nextRun}</span>
                  </div>
                  {schedule.lastRun && (
                    <div>
                      <span style={{ color: '#64748b' }}>Last Run: </span>
                      <span>{schedule.lastRun}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} />
              Validation Rules
            </h2>
            <button className="btn btn-primary btn-sm" onClick={() => info('Add validation rule', 'Rule configuration coming soon')}>
              Add Rule
            </button>
          </div>

          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Configure validation rules to ensure data quality during imports.
          </p>

          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Rule Type</th>
                <th>Parameters</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {validationRules.map(rule => (
                <tr key={rule.id}>
                  <td style={{ fontWeight: 500 }}>{rule.field}</td>
                  <td style={{ textTransform: 'capitalize' }}>{rule.rule}</td>
                  <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {rule.params ? JSON.stringify(rule.params) : '-'}
                  </td>
                  <td>
                    <button 
                      className={`btn btn-sm ${rule.enabled ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => warning('Delete rule', `Are you sure you want to delete the ${rule.field} validation rule?`)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
