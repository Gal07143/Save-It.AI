import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, OCRBillResult } from '../services/api'
import { 
  Receipt, CheckCircle, AlertTriangle, XCircle, FileCheck,
  Upload, Camera, Loader2, FileImage, X, Plus
} from 'lucide-react'

interface NewBillForm {
  site_id: number
  bill_date: string
  period_start: string
  period_end: string
  total_kwh: number
  total_amount: number
  supplier_name?: string
  account_number?: string
}

export default function Bills() {
  const queryClient = useQueryClient()
  const [validatingId, setValidatingId] = useState<number | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [showOCRModal, setShowOCRModal] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRBillResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newBillForm, setNewBillForm] = useState<NewBillForm>({
    site_id: 1,
    bill_date: '',
    period_start: '',
    period_end: '',
    total_kwh: 0,
    total_amount: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: bills, isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => api.bills.list() })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => api.sites.list() })

  const validateMutation = useMutation({
    mutationFn: api.bills.validate,
    onSuccess: (result) => {
      setValidationResult(result)
      queryClient.invalidateQueries({ queryKey: ['bills'] })
    },
    onSettled: () => setValidatingId(null),
  })

  const createBillMutation = useMutation({
    mutationFn: api.bills.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setShowAddModal(false)
      setShowOCRModal(false)
      setOcrResult(null)
      setNewBillForm({
        site_id: 1,
        bill_date: '',
        period_start: '',
        period_end: '',
        total_kwh: 0,
        total_amount: 0,
      })
    },
  })

  const handleValidate = (billId: number) => {
    setValidatingId(billId)
    setValidationResult(null)
    validateMutation.mutate(billId)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setOcrResult(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setOcrResult(null)
    }
  }

  const handleOCRScan = async () => {
    if (!selectedFile) return
    
    setOcrLoading(true)
    try {
      const result = await api.bills.ocrScan(selectedFile)
      setOcrResult(result)
      
      if (result.success) {
        setNewBillForm({
          site_id: 1,
          bill_date: result.bill_date || '',
          period_start: result.period_start || '',
          period_end: result.period_end || '',
          total_kwh: result.total_kwh || 0,
          total_amount: result.total_amount || 0,
          supplier_name: result.supplier_name,
          account_number: result.account_number,
        })
      }
    } catch (error) {
      setOcrResult({
        success: false,
        error: error instanceof Error ? error.message : 'OCR scan failed'
      })
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSaveBill = () => {
    if (newBillForm.bill_date && newBillForm.period_start && newBillForm.period_end) {
      createBillMutation.mutate(newBillForm)
    }
  }

  const resetOCRModal = () => {
    setShowOCRModal(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setOcrResult(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Utility Bills</h1>
          <p style={{ color: '#64748b' }}>Track and validate utility bills against meter readings</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowAddModal(true)}>
            <Plus size={16} style={{ marginRight: '0.5rem' }} />
            Add Bill
          </button>
          <button className="btn btn-primary" onClick={() => setShowOCRModal(true)}>
            <Camera size={16} style={{ marginRight: '0.5rem' }} />
            Scan Bill
          </button>
        </div>
      </div>

      {validationResult && (
        <div className={`alert alert-${validationResult.is_valid ? 'success' : 'warning'}`} style={{ marginBottom: '1.5rem' }}>
          <strong>{validationResult.message}</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Bill Total: {validationResult.bill_total_kwh.toLocaleString()} kWh | 
            Meter Total: {validationResult.meter_total_kwh.toLocaleString()} kWh | 
            Variance: {validationResult.variance_percentage.toFixed(2)}%
          </div>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <p>Loading bills...</p>
        ) : bills && bills.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Bill Date</th>
                <th>Period</th>
                <th>Total kWh</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{new Date(bill.bill_date).toLocaleDateString()}</td>
                  <td>
                    {new Date(bill.period_start).toLocaleDateString()} - {new Date(bill.period_end).toLocaleDateString()}
                  </td>
                  <td>{bill.total_kwh.toLocaleString()} kWh</td>
                  <td>${bill.total_amount.toLocaleString()}</td>
                  <td>
                    {bill.is_validated ? (
                      bill.validation_variance_pct !== undefined && Math.abs(bill.validation_variance_pct) <= 2 ? (
                        <span className="badge badge-success">
                          <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                          Valid ({bill.validation_variance_pct.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} />
                          Variance ({bill.validation_variance_pct?.toFixed(1)}%)
                        </span>
                      )
                    ) : (
                      <span className="badge badge-info">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                      onClick={() => handleValidate(bill.id)}
                      disabled={validatingId === bill.id}
                    >
                      <FileCheck size={14} />
                      {validatingId === bill.id ? 'Validating...' : 'Validate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Receipt size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Bills Found</h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Upload a bill image to automatically extract data using AI
            </p>
            <button className="btn btn-primary" onClick={() => setShowOCRModal(true)}>
              <Camera size={16} style={{ marginRight: '0.5rem' }} />
              Scan Your First Bill
            </button>
          </div>
        )}
      </div>

      {showOCRModal && (
        <div className="modal-overlay" onClick={resetOCRModal}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scan Utility Bill</h2>
              <button className="btn btn-ghost" onClick={resetOCRModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {!ocrResult?.success && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: '2px dashed #374151',
                    borderRadius: '0.5rem',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: '1rem',
                    background: selectedFile ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  
                  {previewUrl && selectedFile?.type.startsWith('image/') ? (
                    <img 
                      src={previewUrl} 
                      alt="Bill preview" 
                      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '0.5rem' }}
                    />
                  ) : selectedFile ? (
                    <div>
                      <FileImage size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                      <p style={{ fontWeight: '500' }}>{selectedFile.name}</p>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
                      <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                        Drop your bill image here or click to browse
                      </p>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        Supports PNG, JPG, and PDF files
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {selectedFile && !ocrResult?.success && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleOCRScan}
                  disabled={ocrLoading}
                  style={{ width: '100%', marginBottom: '1rem' }}
                >
                  {ocrLoading ? (
                    <>
                      <Loader2 size={16} style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
                      Scanning with AI...
                    </>
                  ) : (
                    <>
                      <Camera size={16} style={{ marginRight: '0.5rem' }} />
                      Extract Bill Data
                    </>
                  )}
                </button>
              )}
              
              {ocrResult && (
                <div style={{ marginTop: '1rem' }}>
                  {ocrResult.success ? (
                    <>
                      <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                        <CheckCircle size={16} style={{ marginRight: '0.5rem' }} />
                        Bill data extracted successfully! Review and save below.
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label>Site</label>
                          <select
                            value={newBillForm.site_id}
                            onChange={(e) => setNewBillForm({ ...newBillForm, site_id: Number(e.target.value) })}
                          >
                            {sites?.map(site => (
                              <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label>Supplier</label>
                          <input
                            type="text"
                            value={newBillForm.supplier_name || ''}
                            onChange={(e) => setNewBillForm({ ...newBillForm, supplier_name: e.target.value })}
                            placeholder="Utility company"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Bill Date</label>
                          <input
                            type="date"
                            value={newBillForm.bill_date}
                            onChange={(e) => setNewBillForm({ ...newBillForm, bill_date: e.target.value })}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Account Number</label>
                          <input
                            type="text"
                            value={newBillForm.account_number || ''}
                            onChange={(e) => setNewBillForm({ ...newBillForm, account_number: e.target.value })}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Period Start</label>
                          <input
                            type="date"
                            value={newBillForm.period_start}
                            onChange={(e) => setNewBillForm({ ...newBillForm, period_start: e.target.value })}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Period End</label>
                          <input
                            type="date"
                            value={newBillForm.period_end}
                            onChange={(e) => setNewBillForm({ ...newBillForm, period_end: e.target.value })}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Total kWh</label>
                          <input
                            type="number"
                            value={newBillForm.total_kwh}
                            onChange={(e) => setNewBillForm({ ...newBillForm, total_kwh: Number(e.target.value) })}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Total Amount ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newBillForm.total_amount}
                            onChange={(e) => setNewBillForm({ ...newBillForm, total_amount: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      
                      {ocrResult.line_items && ocrResult.line_items.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
                            Line Items Detected
                          </label>
                          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                            {ocrResult.line_items.map((item, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                <span>{item.description}</span>
                                <span>${item.amount?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button 
                        className="btn btn-primary" 
                        onClick={handleSaveBill}
                        disabled={createBillMutation.isPending}
                        style={{ width: '100%', marginTop: '1.5rem' }}
                      >
                        {createBillMutation.isPending ? 'Saving...' : 'Save Bill'}
                      </button>
                    </>
                  ) : (
                    <div className="alert alert-error">
                      <XCircle size={16} style={{ marginRight: '0.5rem' }} />
                      {ocrResult.error || 'Failed to extract bill data. Please try again.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Bill</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Site</label>
                  <select
                    value={newBillForm.site_id}
                    onChange={(e) => setNewBillForm({ ...newBillForm, site_id: Number(e.target.value) })}
                  >
                    {sites?.map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Bill Date</label>
                  <input
                    type="date"
                    value={newBillForm.bill_date}
                    onChange={(e) => setNewBillForm({ ...newBillForm, bill_date: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Period Start</label>
                  <input
                    type="date"
                    value={newBillForm.period_start}
                    onChange={(e) => setNewBillForm({ ...newBillForm, period_start: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Period End</label>
                  <input
                    type="date"
                    value={newBillForm.period_end}
                    onChange={(e) => setNewBillForm({ ...newBillForm, period_end: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Total kWh</label>
                  <input
                    type="number"
                    value={newBillForm.total_kwh}
                    onChange={(e) => setNewBillForm({ ...newBillForm, total_kwh: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Total Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBillForm.total_amount}
                    onChange={(e) => setNewBillForm({ ...newBillForm, total_amount: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <button 
                className="btn btn-primary" 
                onClick={handleSaveBill}
                disabled={createBillMutation.isPending}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {createBillMutation.isPending ? 'Saving...' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal {
          background: #1e293b;
          border-radius: 0.75rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #334155;
        }
        
        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .modal-body {
          padding: 1.5rem;
        }
        
        .form-group {
          margin-bottom: 0.75rem;
        }
        
        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #0f172a;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          color: #f8fafc;
        }
        
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #10b981;
        }
        
        .alert {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
        }
        
        .alert-success {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          color: #10b981;
        }
        
        .alert-error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          color: #ef4444;
        }
      `}</style>
    </div>
  )
}
