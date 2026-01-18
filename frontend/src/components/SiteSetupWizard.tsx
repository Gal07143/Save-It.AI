import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Asset } from '../services/api'
import { X, Check, Building2, Zap, Gauge, FileText, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

interface SiteSetupWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (siteId: number) => void
}

interface AssetForm {
  name: string
  asset_type: string
  rated_capacity_kw: string
}

interface MeterForm {
  meter_id: string
  name: string
  asset_id: string
}

interface BillForm {
  bill_date: string
  period_start: string
  period_end: string
  total_kwh: string
  total_amount: string
}

const STEPS = [
  { id: 1, title: 'Create Site', icon: Building2, required: true },
  { id: 2, title: 'Add Assets', icon: Zap, required: false },
  { id: 3, title: 'Add Meters', icon: Gauge, required: false },
  { id: 4, title: 'Upload Bill', icon: FileText, required: false },
]

const ASSET_TYPES = [
  { value: 'main_breaker', label: 'Main Breaker' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'sub_panel', label: 'Sub-Panel' },
  { value: 'distribution_board', label: 'Distribution Board' },
]

export default function SiteSetupWizard({ isOpen, onClose, onComplete }: SiteSetupWizardProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  
  const [siteForm, setSiteForm] = useState({ name: '', address: '', city: '', country: '', timezone: 'UTC' })
  const [createdSiteId, setCreatedSiteId] = useState<number | null>(null)
  
  const [assets, setAssets] = useState<AssetForm[]>([{ name: '', asset_type: 'main_breaker', rated_capacity_kw: '' }])
  const [createdAssets, setCreatedAssets] = useState<Asset[]>([])
  
  const [meters, setMeters] = useState<MeterForm[]>([{ meter_id: '', name: '', asset_id: '' }])
  
  const [billForm, setBillForm] = useState<BillForm>({
    bill_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    total_kwh: '',
    total_amount: '',
  })

  const createSiteMutation = useMutation({
    mutationFn: api.sites.create,
    onSuccess: (site) => {
      setCreatedSiteId(site.id)
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setCurrentStep(2)
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const createAssetMutation = useMutation({
    mutationFn: api.assets.create,
    onSuccess: (asset) => {
      setCreatedAssets((prev) => [...prev, asset])
    },
    onError: (err: Error) => setError(err.message),
  })

  const createMeterMutation = useMutation({
    mutationFn: api.meters.create,
    onError: (err: Error) => setError(err.message),
  })

  const createBillMutation = useMutation({
    mutationFn: api.bills.create,
    onError: (err: Error) => setError(err.message),
  })

  const handleNext = async () => {
    setError(null)
    
    if (currentStep === 1) {
      if (!siteForm.name.trim()) {
        setError('Site name is required')
        return
      }
      createSiteMutation.mutate(siteForm)
    } else if (currentStep === 2) {
      if (!createdSiteId) return
      
      const validAssets = assets.filter((a) => a.name.trim())
      if (validAssets.length > 0) {
        for (const asset of validAssets) {
          await createAssetMutation.mutateAsync({
            site_id: createdSiteId,
            name: asset.name,
            asset_type: asset.asset_type,
            rated_capacity_kw: asset.rated_capacity_kw ? parseFloat(asset.rated_capacity_kw) : undefined,
            is_critical: false,
            requires_metering: true,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['assets'] })
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      if (!createdSiteId) return
      
      const validMeters = meters.filter((m) => m.meter_id.trim() && m.name.trim())
      if (validMeters.length > 0) {
        for (const meter of validMeters) {
          await createMeterMutation.mutateAsync({
            site_id: createdSiteId,
            meter_id: meter.meter_id,
            name: meter.name,
            asset_id: meter.asset_id ? parseInt(meter.asset_id) : undefined,
            is_active: true,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['meters'] })
      }
      setCurrentStep(4)
    } else if (currentStep === 4) {
      if (!createdSiteId) return
      
      if (billForm.total_kwh && billForm.total_amount && billForm.period_start && billForm.period_end) {
        await createBillMutation.mutateAsync({
          site_id: createdSiteId,
          bill_date: billForm.bill_date,
          period_start: billForm.period_start,
          period_end: billForm.period_end,
          total_kwh: parseFloat(billForm.total_kwh),
          total_amount: parseFloat(billForm.total_amount),
          is_validated: false,
        })
        queryClient.invalidateQueries({ queryKey: ['bills'] })
      }
      
      handleComplete()
    }
  }

  const handleSkip = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (createdSiteId) {
      onComplete(createdSiteId)
    }
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setCurrentStep(1)
    setSiteForm({ name: '', address: '', city: '', country: '', timezone: 'UTC' })
    setCreatedSiteId(null)
    setAssets([{ name: '', asset_type: 'main_breaker', rated_capacity_kw: '' }])
    setCreatedAssets([])
    setMeters([{ meter_id: '', name: '', asset_id: '' }])
    setBillForm({
      bill_date: new Date().toISOString().split('T')[0],
      period_start: '',
      period_end: '',
      total_kwh: '',
      total_amount: '',
    })
    setError(null)
  }

  const addAsset = () => {
    setAssets([...assets, { name: '', asset_type: 'sub_panel', rated_capacity_kw: '' }])
  }

  const removeAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index))
  }

  const updateAsset = (index: number, field: keyof AssetForm, value: string) => {
    const updated = [...assets]
    updated[index] = { ...updated[index], [field]: value }
    setAssets(updated)
  }

  const addMeter = () => {
    setMeters([...meters, { meter_id: '', name: '', asset_id: '' }])
  }

  const removeMeter = (index: number) => {
    setMeters(meters.filter((_, i) => i !== index))
  }

  const updateMeter = (index: number, field: keyof MeterForm, value: string) => {
    const updated = [...meters]
    updated[index] = { ...updated[index], [field]: value }
    setMeters(updated)
  }

  if (!isOpen) return null

  const isLoading = createSiteMutation.isPending || createAssetMutation.isPending || 
                    createMeterMutation.isPending || createBillMutation.isPending

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0f172a',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9' }}>Site Setup Wizard</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', background: '#0f172a', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '40px',
                right: '40px',
                height: '2px',
                background: '#334155',
                zIndex: 0,
              }}
            />
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              const Icon = step.icon

              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 1,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCompleted ? '#10b981' : isCurrent ? '#10b981' : '#334155',
                      border: isCurrent ? '3px solid #34d399' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isCompleted ? (
                      <Check size={18} color="white" />
                    ) : (
                      <Icon size={18} color={isCurrent ? 'white' : '#94a3b8'} />
                    )}
                  </div>
                  <span
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? '#10b981' : isCompleted ? '#34d399' : '#94a3b8',
                      textAlign: 'center',
                    }}
                  >
                    {step.title}
                    {!step.required && <span style={{ color: '#64748b' }}> (optional)</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                Site Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Site Name *</label>
                  <input
                    type="text"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                    placeholder="e.g., Main Office Building"
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                    placeholder="e.g., 123 Energy Street"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    placeholder="e.g., Dubai"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    value={siteForm.country}
                    onChange={(e) => setSiteForm({ ...siteForm, country: e.target.value })}
                    placeholder="e.g., UAE"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Electrical Assets
                </h3>
                <button
                  type="button"
                  onClick={addAsset}
                  className="btn btn-outline"
                  style={{ padding: '0.375rem 0.75rem' }}
                >
                  <Plus size={16} />
                  Add Asset
                </button>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Add main electrical assets like main breaker, transformer, and sub-panels.
              </p>
              
              {assets.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    background: '#0f172a',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.75rem',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#10b981' }}>
                      Asset {index + 1}
                    </span>
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Name</label>
                      <input
                        type="text"
                        value={asset.name}
                        onChange={(e) => updateAsset(index, 'name', e.target.value)}
                        placeholder="e.g., Main Breaker"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Type</label>
                      <select
                        value={asset.asset_type}
                        onChange={(e) => updateAsset(index, 'asset_type', e.target.value)}
                      >
                        {ASSET_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Capacity (kW)</label>
                      <input
                        type="number"
                        value={asset.rated_capacity_kw}
                        onChange={(e) => updateAsset(index, 'rated_capacity_kw', e.target.value)}
                        placeholder="100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Energy Meters
                </h3>
                <button
                  type="button"
                  onClick={addMeter}
                  className="btn btn-outline"
                  style={{ padding: '0.375rem 0.75rem' }}
                >
                  <Plus size={16} />
                  Add Meter
                </button>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Add energy meters to track consumption. Link them to assets for better monitoring.
              </p>
              
              {meters.map((meter, index) => (
                <div
                  key={index}
                  style={{
                    background: '#0f172a',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.75rem',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#10b981' }}>
                      Meter {index + 1}
                    </span>
                    {meters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMeter(index)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Meter ID</label>
                      <input
                        type="text"
                        value={meter.meter_id}
                        onChange={(e) => updateMeter(index, 'meter_id', e.target.value)}
                        placeholder="e.g., MTR-001"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Name</label>
                      <input
                        type="text"
                        value={meter.name}
                        onChange={(e) => updateMeter(index, 'name', e.target.value)}
                        placeholder="e.g., Main Meter"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Linked Asset</label>
                      <select
                        value={meter.asset_id}
                        onChange={(e) => updateMeter(index, 'asset_id', e.target.value)}
                      >
                        <option value="">-- No asset --</option>
                        {createdAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>
                First Utility Bill
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Enter your first utility bill to establish a baseline for energy tracking.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Bill Date</label>
                  <input
                    type="date"
                    value={billForm.bill_date}
                    onChange={(e) => setBillForm({ ...billForm, bill_date: e.target.value })}
                  />
                </div>
                <div></div>
                <div className="form-group">
                  <label className="form-label">Period Start</label>
                  <input
                    type="date"
                    value={billForm.period_start}
                    onChange={(e) => setBillForm({ ...billForm, period_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Period End</label>
                  <input
                    type="date"
                    value={billForm.period_end}
                    onChange={(e) => setBillForm({ ...billForm, period_end: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Consumption (kWh)</label>
                  <input
                    type="number"
                    value={billForm.total_kwh}
                    onChange={(e) => setBillForm({ ...billForm, total_kwh: e.target.value })}
                    placeholder="e.g., 15000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={billForm.total_amount}
                    onChange={(e) => setBillForm({ ...billForm, total_amount: e.target.value })}
                    placeholder="e.g., 1500.00"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0f172a',
          }}
        >
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-outline"
                disabled={isLoading}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleSkip}
                className="btn btn-ghost"
                disabled={isLoading}
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                'Processing...'
              ) : currentStep === 4 ? (
                <>
                  <Check size={16} />
                  Finish Setup
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
