import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, OCRBillResult } from '../services/api'
import {
  Receipt, CheckCircle, AlertTriangle, XCircle, FileCheck,
  Upload, Camera, Loader2, FileImage, X, Plus, List, ScanLine,
  Scale, AlertCircle, TrendingUp, Paperclip, Edit2, Trash2, Filter
} from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

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

interface BillsProps {
  currentSite?: number | null
}

export default function Bills({ currentSite }: BillsProps) {
  const queryClient = useQueryClient()
  const { info, success } = useToast()
  const [activeTab, setActiveTab] = useState('all-bills')
  const [validatingId, setValidatingId] = useState<number | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [showOCRModal, setShowOCRModal] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRBillResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedBill, setSelectedBill] = useState<any>(null)
  const [siteFilter, setSiteFilter] = useState<number | 'all'>(currentSite || 'all')
  const [newBillForm, setNewBillForm] = useState<NewBillForm>({
    site_id: currentSite || 1,
    bill_date: '',
    period_start: '',
    period_end: '',
    total_kwh: 0,
    total_amount: 0,
  })
  const [editBillForm, setEditBillForm] = useState<NewBillForm>({
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

  // Filter bills by site
  const filteredBills = useMemo(() => {
    if (!bills) return []
    if (siteFilter === 'all') return bills
    return bills.filter(b => b.site_id === siteFilter)
  }, [bills, siteFilter])

  // Calculate trends data
  const trendsData = useMemo(() => {
    if (!filteredBills || filteredBills.length === 0) return []
    return filteredBills
      .sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime())
      .slice(-12)
      .map(bill => ({
        date: new Date(bill.bill_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: bill.total_amount,
        kwh: bill.total_kwh,
        rate: bill.total_kwh > 0 ? (bill.total_amount / bill.total_kwh).toFixed(3) : 0
      }))
  }, [filteredBills])

  const validateMutation = useMutation({
    mutationFn: api.bills.validate,
    onSuccess: (result) => {
      setValidationResult(result)
      setActiveTab('validation')
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
      resetOCRState()
      setNewBillForm({
        site_id: currentSite || 1,
        bill_date: '',
        period_start: '',
        period_end: '',
        total_kwh: 0,
        total_amount: 0,
      })
      success('Bill Created', 'Bill has been added successfully')
    },
  })

  const updateBillMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NewBillForm> }) =>
      fetch(`/api/v1/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setShowEditModal(false)
      setSelectedBill(null)
      success('Bill Updated', 'Bill has been updated successfully')
    },
  })

  const deleteBillMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/v1/bills/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setShowDeleteConfirm(false)
      setSelectedBill(null)
      success('Bill Deleted', 'Bill has been deleted successfully')
    },
  })

  const handleEdit = (bill: any) => {
    setSelectedBill(bill)
    setEditBillForm({
      site_id: bill.site_id,
      bill_date: bill.bill_date?.split('T')[0] || '',
      period_start: bill.period_start?.split('T')[0] || '',
      period_end: bill.period_end?.split('T')[0] || '',
      total_kwh: bill.total_kwh,
      total_amount: bill.total_amount,
      supplier_name: bill.supplier_name,
      account_number: bill.account_number,
    })
    setShowEditModal(true)
  }

  const handleDelete = (bill: any) => {
    setSelectedBill(bill)
    setShowDeleteConfirm(true)
  }

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

  const resetOCRState = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setOcrResult(null)
  }

  const resetOCRModal = () => {
    setShowOCRModal(false)
    resetOCRState()
  }

  const tabs: Tab[] = [
    { id: 'all-bills', label: 'All Bills', icon: List, badge: filteredBills?.length },
    { id: 'ocr-scanner', label: 'OCR Scanner', icon: ScanLine },
    { id: 'validation', label: 'Validation', icon: Scale },
    { id: 'disputes', label: 'Disputes', icon: AlertCircle },
    { id: 'trends', label: 'Trends', icon: TrendingUp, badge: trendsData.length > 0 ? trendsData.length : undefined },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
  ]

  const renderAllBillsTab = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="#64748b" />
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '0.875rem',
              minWidth: '150px'
            }}
          >
            <option value="all">All Sites</option>
            {sites?.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
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

      <div className="card">
        {isLoading ? (
          <p>Loading bills...</p>
        ) : filteredBills && filteredBills.length > 0 ? (
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
              {filteredBills.map((bill) => (
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
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        onClick={() => handleValidate(bill.id)}
                        disabled={validatingId === bill.id}
                        title="Validate against meter readings"
                      >
                        <FileCheck size={14} />
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        onClick={() => handleEdit(bill)}
                        title="Edit bill"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', color: '#ef4444', borderColor: '#ef4444' }}
                        onClick={() => handleDelete(bill)}
                        title="Delete bill"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
            <button className="btn btn-primary" onClick={() => setActiveTab('ocr-scanner')}>
              <Camera size={16} style={{ marginRight: '0.5rem' }} />
              Scan Your First Bill
            </button>
          </div>
        )}
      </div>
    </>
  )

  const renderOCRScannerTab = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>Scan Utility Bill with AI</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Upload a bill image or PDF and our AI will automatically extract the billing data.
      </p>

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
              
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={resetOCRState}
                  style={{ flex: 1 }}
                >
                  Scan Another
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveBill}
                  disabled={createBillMutation.isPending}
                  style={{ flex: 1 }}
                >
                  {createBillMutation.isPending ? 'Saving...' : 'Save Bill'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="alert alert-error">
                <XCircle size={16} style={{ marginRight: '0.5rem' }} />
                {ocrResult.error || 'Failed to extract bill data. Please try again.'}
              </div>
              <button 
                className="btn btn-outline" 
                onClick={resetOCRState}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )

  const renderValidationTab = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>Bill vs Meter Validation</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Compare utility bill charges against actual meter readings to detect discrepancies.
      </p>

      {validationResult ? (
        <div>
          <div className={`alert alert-${validationResult.is_valid ? 'success' : 'warning'}`} style={{ marginBottom: '1.5rem' }}>
            <strong>{validationResult.message}</strong>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Bill Total</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{validationResult.bill_total_kwh.toLocaleString()} kWh</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Meter Total</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{validationResult.meter_total_kwh.toLocaleString()} kWh</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Variance</div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                color: Math.abs(validationResult.variance_percentage) <= 2 ? '#10b981' : '#f59e0b'
              }}>
                {validationResult.variance_percentage.toFixed(2)}%
              </div>
            </div>
          </div>
          
          <button 
            className="btn btn-outline" 
            onClick={() => setValidationResult(null)}
          >
            Clear Results
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Scale size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h4 style={{ marginBottom: '0.5rem' }}>No Validation Results</h4>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Go to the All Bills tab and click "Validate" on a bill to compare it against meter readings.
          </p>
          <button className="btn btn-outline" onClick={() => setActiveTab('all-bills')}>
            View Bills
          </button>
        </div>
      )}
    </div>
  )

  const renderDisputesTab = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>Disputed Charges</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Track and manage disputed utility charges and their resolution status.
      </p>
      
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
        <h4 style={{ marginBottom: '0.5rem' }}>No Active Disputes</h4>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          When you identify discrepancies during validation, you can create disputes here to track their resolution.
        </p>
        <button className="btn btn-outline" onClick={() => info('Coming Soon', 'Dispute creation will be available in a future update')}>
          <Plus size={16} style={{ marginRight: '0.5rem' }} />
          Create Dispute
        </button>
      </div>
    </div>
  )

  const renderTrendsTab = () => {
    // Calculate summary stats
    const totalAmount = filteredBills.reduce((sum, b) => sum + b.total_amount, 0)
    const totalKwh = filteredBills.reduce((sum, b) => sum + b.total_kwh, 0)
    const avgRate = totalKwh > 0 ? (totalAmount / totalKwh) : 0

    if (trendsData.length < 2) {
      return (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Cost Trend Analysis</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Analyze your utility costs over time to identify patterns and optimization opportunities.
          </p>

          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <TrendingUp size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ marginBottom: '0.5rem' }}>Not Enough Data</h4>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Add at least 2 bills to view trend analysis, including month-over-month comparisons and cost tracking.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', minWidth: '120px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Bills Tracked</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{filteredBills.length}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '0.5rem', minWidth: '120px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Required</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>2+</div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Cost</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
              ${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Consumption</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
              {totalKwh.toLocaleString()} kWh
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Avg. Rate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
              ${avgRate.toFixed(3)}/kWh
            </div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Bills Analyzed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {trendsData.length}
            </div>
          </div>
        </div>

        {/* Cost Over Time Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Cost Over Time</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumption vs Cost Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Consumption vs Cost</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis yAxisId="left" stroke="#3b82f6" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v} kWh`} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Line yAxisId="left" type="monotone" dataKey="kwh" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Consumption (kWh)" />
                <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Cost ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rate Trend Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Rate Trend ($/kWh)</h3>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `$${v}`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [`$${Number(value).toFixed(3)}/kWh`, 'Rate']}
                />
                <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  const renderAttachmentsTab = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>Bill Attachments</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Store and organize PDF copies and images of your utility bills for reference.
      </p>
      
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Paperclip size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
        <h4 style={{ marginBottom: '0.5rem' }}>No Attachments</h4>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          When you scan bills using OCR, the original files will be stored here for future reference.
        </p>
        <button className="btn btn-outline" onClick={() => setActiveTab('ocr-scanner')}>
          <Upload size={16} style={{ marginRight: '0.5rem' }} />
          Upload a Bill
        </button>
      </div>
    </div>
  )

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'all-bills':
        return renderAllBillsTab()
      case 'ocr-scanner':
        return renderOCRScannerTab()
      case 'validation':
        return renderValidationTab()
      case 'disputes':
        return renderDisputesTab()
      case 'trends':
        return renderTrendsTab()
      case 'attachments':
        return renderAttachmentsTab()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Utility Bills</h1>
        <p style={{ color: '#64748b' }}>Track and validate utility bills against meter readings</p>
      </div>

      <TabPanel 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        variant="default"
      >
        {renderTabContent}
      </TabPanel>

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

      {showEditModal && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Bill</h2>
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Site</label>
                  <select
                    value={editBillForm.site_id}
                    onChange={(e) => setEditBillForm({ ...editBillForm, site_id: Number(e.target.value) })}
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
                    value={editBillForm.supplier_name || ''}
                    onChange={(e) => setEditBillForm({ ...editBillForm, supplier_name: e.target.value })}
                    placeholder="Utility company"
                  />
                </div>

                <div className="form-group">
                  <label>Bill Date</label>
                  <input
                    type="date"
                    value={editBillForm.bill_date}
                    onChange={(e) => setEditBillForm({ ...editBillForm, bill_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Account Number</label>
                  <input
                    type="text"
                    value={editBillForm.account_number || ''}
                    onChange={(e) => setEditBillForm({ ...editBillForm, account_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Period Start</label>
                  <input
                    type="date"
                    value={editBillForm.period_start}
                    onChange={(e) => setEditBillForm({ ...editBillForm, period_start: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Period End</label>
                  <input
                    type="date"
                    value={editBillForm.period_end}
                    onChange={(e) => setEditBillForm({ ...editBillForm, period_end: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Total kWh</label>
                  <input
                    type="number"
                    value={editBillForm.total_kwh}
                    onChange={(e) => setEditBillForm({ ...editBillForm, total_kwh: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Total Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBillForm.total_amount}
                    onChange={(e) => setEditBillForm({ ...editBillForm, total_amount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => updateBillMutation.mutate({ id: selectedBill.id, data: editBillForm })}
                disabled={updateBillMutation.isPending}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {updateBillMutation.isPending ? 'Updating...' : 'Update Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Bill</h2>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete this bill?</p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Bill dated {selectedBill.bill_date ? new Date(selectedBill.bill_date).toLocaleDateString() : 'N/A'}
                {' '}for ${selectedBill.total_amount?.toLocaleString() || 0}
              </p>
              <p style={{ color: '#f59e0b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => deleteBillMutation.mutate(selectedBill.id)}
                  disabled={deleteBillMutation.isPending}
                >
                  {deleteBillMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
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
        
        .alert-warning {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid #f59e0b;
          color: #f59e0b;
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
