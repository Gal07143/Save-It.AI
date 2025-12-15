import { useState } from 'react'
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, Database, Columns } from 'lucide-react'
import FileUpload from '../components/FileUpload'
import { getAuthToken } from '../contexts/AuthContext'

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

export default function DataIngestion() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number, errors: number } | null>(null)

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
    setImportProgress(0)
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
    setImportProgress(0)
    setError(null)
    setImportResult(null)
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
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Columns size={20} />
              Map Columns to Fields
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Found {parsedData.totalRows.toLocaleString()} rows. Map each column to the appropriate meter reading field.
            </p>

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
    </div>
  )
}
