import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, X, Download, CheckCircle, XCircle, FileText } from 'lucide-react'
import { api, BulkDeviceImportResponse } from '../services/api'

interface BulkDeviceImportProps {
  siteId: number | null
  isOpen: boolean
  onClose: () => void
}

export default function BulkDeviceImport({ siteId, isOpen, onClose }: BulkDeviceImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<BulkDeviceImportResponse | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file')
        return
      }
      setFile(selectedFile)
      setError(null)
      setImportResult(null)
    }
  }

  const handleImport = async () => {
    if (!file || !siteId) return
    
    setIsImporting(true)
    setError(null)
    
    try {
      const result = await api.dataSources.bulkImportCSV(siteId, file)
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['data-sources'] })
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = 'name,protocol,host,port,slave_id,location,template_name,gateway_name,description'
    const exampleRow = 'Meter-001,modbus_tcp,192.168.1.100,502,1,Building A,Eastron SDM630,Gateway-1,Main distribution board'
    const csv = `${headers}\n${exampleRow}\n`
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'device_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    setFile(null)
    setImportResult(null)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#1e293b', borderRadius: '12px', width: '600px',
        maxHeight: '80vh', overflow: 'auto', border: '1px solid #334155'
      }}>
        <div style={{
          padding: '1.5rem', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.25rem' }}>
            Bulk Device Import
          </h2>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {!importResult ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
                  Upload a CSV file to import multiple devices at once. Each row represents one device.
                </p>
                <button onClick={downloadTemplate} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', backgroundColor: '#0f172a',
                  border: '1px solid #334155', borderRadius: '6px',
                  color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem'
                }}>
                  <Download size={16} />
                  Download CSV Template
                </button>
              </div>

              <div style={{
                border: '2px dashed #334155', borderRadius: '8px',
                padding: '2rem', textAlign: 'center', marginBottom: '1rem',
                backgroundColor: file ? '#1e3a5f' : '#0f172a'
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <FileText size={24} style={{ color: '#10b981' }} />
                    <span style={{ color: '#f1f5f9' }}>{file.name}</span>
                    <button onClick={() => setFile(null)} style={{
                      background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'
                    }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={40} style={{ color: '#64748b', marginBottom: '1rem' }} />
                    <p style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>
                      Drag & drop your CSV file here, or
                    </p>
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      padding: '0.5rem 1rem', backgroundColor: '#3b82f6',
                      border: 'none', borderRadius: '6px', color: 'white',
                      cursor: 'pointer', fontWeight: 500
                    }}>
                      Browse Files
                    </button>
                  </>
                )}
              </div>

              {error && (
                <div style={{
                  padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                  color: '#ef4444', marginBottom: '1rem'
                }}>
                  {error}
                </div>
              )}

              <div style={{
                backgroundColor: '#0f172a', borderRadius: '8px',
                padding: '1rem', marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                  CSV Format
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
                  Required columns: <strong>name</strong><br />
                  Optional: protocol, host, port, slave_id, location, template_name, gateway_name, description
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={handleClose} style={{
                  padding: '0.75rem 1.5rem', backgroundColor: '#334155',
                  border: 'none', borderRadius: '6px', color: '#f1f5f9',
                  cursor: 'pointer'
                }}>
                  Cancel
                </button>
                <button onClick={handleImport} disabled={!file || isImporting} style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: file && !isImporting ? '#10b981' : '#334155',
                  border: 'none', borderRadius: '6px', color: 'white',
                  cursor: file && !isImporting ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}>
                  {isImporting ? 'Importing...' : 'Import Devices'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem', backgroundColor: '#0f172a',
                borderRadius: '8px', marginBottom: '1.5rem'
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  backgroundColor: importResult.failed === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {importResult.failed === 0 ? (
                    <CheckCircle size={30} style={{ color: '#10b981' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>!</span>
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#f1f5f9' }}>Import Complete</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8' }}>
                    {importResult.successful} of {importResult.total} devices imported successfully
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    flex: 1, padding: '1rem', backgroundColor: 'rgba(16,185,129,0.1)',
                    borderRadius: '8px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                      {importResult.successful}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Successful</div>
                  </div>
                  <div style={{
                    flex: 1, padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)',
                    borderRadius: '8px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
                      {importResult.failed}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Failed</div>
                  </div>
                </div>
              </div>

              {importResult.results.length > 0 && (
                <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem' }}>Row</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem' }}>Device</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results.map((row) => (
                        <tr key={row.row_number} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                            {row.row_number}
                          </td>
                          <td style={{ padding: '0.5rem', color: '#f1f5f9', fontSize: '0.875rem' }}>
                            {row.name}
                            {row.error && (
                              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>{row.error}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            {row.success ? (
                              <CheckCircle size={16} style={{ color: '#10b981' }} />
                            ) : (
                              <XCircle size={16} style={{ color: '#ef4444' }} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleClose} style={{
                  padding: '0.75rem 1.5rem', backgroundColor: '#10b981',
                  border: 'none', borderRadius: '6px', color: 'white',
                  cursor: 'pointer', fontWeight: 600
                }}>
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
