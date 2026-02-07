import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  X, Check, Building2, Zap, Gauge, ChevronLeft, ChevronRight,
  Plus, Trash2, Factory, Warehouse, Server, ShoppingBag, Heart, ClipboardList
} from 'lucide-react'

interface SiteSetupWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (siteId: number) => void
}

// ---------------------------------------------------------------------------
// Site type templates with smart defaults
// ---------------------------------------------------------------------------

interface SiteTemplate {
  key: string
  label: string
  description: string
  icon: typeof Building2
  gridKva: number
  operatingHours: string
  operatingStart: string
  operatingEnd: string
  suggestedAssets: { name: string; type: string; capacity: number }[]
  suggestedMeters: { name: string; assetIndex: number }[]
}

const SITE_TEMPLATES: SiteTemplate[] = [
  {
    key: 'commercial_office',
    label: 'Commercial Office',
    description: 'Typical 300 kVA, business hours',
    icon: Building2,
    gridKva: 300,
    operatingHours: 'business_hours',
    operatingStart: '08:00',
    operatingEnd: '18:00',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 300 },
      { name: 'HVAC Panel', type: 'sub_panel', capacity: 120 },
      { name: 'Lighting Panel', type: 'sub_panel', capacity: 60 },
      { name: 'Server Room UPS', type: 'sub_panel', capacity: 40 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
      { name: 'HVAC Sub-Meter', assetIndex: 1 },
    ],
  },
  {
    key: 'industrial_factory',
    label: 'Industrial Factory',
    description: 'Typical 1500 kVA, 24/7 operation',
    icon: Factory,
    gridKva: 1500,
    operatingHours: '24_7',
    operatingStart: '00:00',
    operatingEnd: '23:59',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 1500 },
      { name: 'Production Line Panel', type: 'sub_panel', capacity: 800 },
      { name: 'Compressor Panel', type: 'sub_panel', capacity: 300 },
      { name: 'Lighting Panel', type: 'sub_panel', capacity: 100 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
      { name: 'Production Meter', assetIndex: 1 },
      { name: 'Compressor Meter', assetIndex: 2 },
    ],
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    description: 'Typical 500 kVA, extended hours',
    icon: Warehouse,
    gridKva: 500,
    operatingHours: 'extended',
    operatingStart: '06:00',
    operatingEnd: '22:00',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 500 },
      { name: 'Lighting Panel', type: 'sub_panel', capacity: 150 },
      { name: 'Loading Dock Panel', type: 'sub_panel', capacity: 100 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
      { name: 'Lighting Sub-Meter', assetIndex: 1 },
    ],
  },
  {
    key: 'data_center',
    label: 'Data Center',
    description: 'Typical 2000 kVA, 24/7 critical',
    icon: Server,
    gridKva: 2000,
    operatingHours: '24_7',
    operatingStart: '00:00',
    operatingEnd: '23:59',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 2000 },
      { name: 'UPS System', type: 'sub_panel', capacity: 1000 },
      { name: 'Cooling System', type: 'sub_panel', capacity: 600 },
      { name: 'IT Load Panel', type: 'sub_panel', capacity: 800 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
      { name: 'UPS Meter', assetIndex: 1 },
      { name: 'Cooling Meter', assetIndex: 2 },
    ],
  },
  {
    key: 'retail',
    label: 'Retail',
    description: 'Typical 200 kVA, business hours',
    icon: ShoppingBag,
    gridKva: 200,
    operatingHours: 'business_hours',
    operatingStart: '09:00',
    operatingEnd: '21:00',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 200 },
      { name: 'HVAC Panel', type: 'sub_panel', capacity: 80 },
      { name: 'Lighting Panel', type: 'sub_panel', capacity: 50 },
      { name: 'POS Panel', type: 'sub_panel', capacity: 20 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
    ],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    description: 'Typical 1000 kVA, 24/7 critical',
    icon: Heart,
    gridKva: 1000,
    operatingHours: '24_7',
    operatingStart: '00:00',
    operatingEnd: '23:59',
    suggestedAssets: [
      { name: 'Main Breaker', type: 'main_breaker', capacity: 1000 },
      { name: 'Emergency Panel', type: 'sub_panel', capacity: 300 },
      { name: 'HVAC Panel', type: 'sub_panel', capacity: 350 },
      { name: 'Medical Equipment', type: 'sub_panel', capacity: 200 },
    ],
    suggestedMeters: [
      { name: 'Main Meter', assetIndex: 0 },
      { name: 'Emergency Meter', assetIndex: 1 },
      { name: 'Medical Meter', assetIndex: 3 },
    ],
  },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  'US': 'USD', 'USA': 'USD', 'United States': 'USD',
  'IL': 'ILS', 'Israel': 'ILS',
  'UK': 'GBP', 'United Kingdom': 'GBP', 'GB': 'GBP',
  'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR', 'Netherlands': 'EUR',
  'UAE': 'AED', 'United Arab Emirates': 'AED',
  'JP': 'JPY', 'Japan': 'JPY',
  'AU': 'AUD', 'Australia': 'AUD',
  'CA': 'CAD', 'Canada': 'CAD',
  'SG': 'SGD', 'Singapore': 'SGD',
}

const COUNTRY_TIMEZONE: Record<string, string> = {
  'US': 'America/New_York', 'USA': 'America/New_York', 'United States': 'America/New_York',
  'IL': 'Asia/Jerusalem', 'Israel': 'Asia/Jerusalem',
  'UK': 'Europe/London', 'United Kingdom': 'Europe/London', 'GB': 'Europe/London',
  'Germany': 'Europe/Berlin', 'France': 'Europe/Paris', 'Italy': 'Europe/Paris',
  'UAE': 'Asia/Dubai', 'United Arab Emirates': 'Asia/Dubai',
  'JP': 'Asia/Tokyo', 'Japan': 'Asia/Tokyo',
  'AU': 'Australia/Sydney', 'Australia': 'Australia/Sydney',
  'CA': 'America/New_York', 'Canada': 'America/New_York',
  'SG': 'Asia/Singapore', 'Singapore': 'Asia/Singapore',
}

const TIMEZONE_OPTIONS = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Jerusalem', 'Asia/Dubai', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
  'Australia/Sydney',
]

const STEPS = [
  { id: 1, title: 'Site Type', icon: ClipboardList },
  { id: 2, title: 'Details', icon: Building2 },
  { id: 3, title: 'Assets', icon: Zap },
  { id: 4, title: 'Meters', icon: Gauge },
  { id: 5, title: 'Review', icon: Check },
]

interface AssetEntry {
  name: string
  type: string
  capacity: number
  enabled: boolean
}

interface MeterEntry {
  id: string
  name: string
  assetIndex: number
  enabled: boolean
}

export default function SiteSetupWizard({ isOpen, onClose, onComplete }: SiteSetupWizardProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Step 1: selected template
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Step 2: site details
  const [siteForm, setSiteForm] = useState({
    name: '', address: '', city: '', country: '', timezone: 'UTC',
    grid_capacity_kva: '', operating_hours: '', currency: '',
  })

  // Step 3: assets
  const [assets, setAssets] = useState<AssetEntry[]>([])

  // Step 4: meters
  const [meters, setMeters] = useState<MeterEntry[]>([])

  const createSiteMutation = useMutation({ mutationFn: api.sites.create })
  const createAssetMutation = useMutation({ mutationFn: api.assets.create })
  const createMeterMutation = useMutation({ mutationFn: api.meters.create })

  const getTemplate = (): SiteTemplate | undefined => SITE_TEMPLATES.find(t => t.key === selectedType)

  // When user selects a type, pre-fill everything
  const handleSelectType = (key: string) => {
    setSelectedType(key)
    const tpl = SITE_TEMPLATES.find(t => t.key === key)!
    setSiteForm(prev => ({
      ...prev,
      grid_capacity_kva: String(tpl.gridKva),
      operating_hours: tpl.operatingHours,
    }))
    setAssets(tpl.suggestedAssets.map(a => ({ ...a, enabled: true })))
    setMeters(tpl.suggestedMeters.map((m) => ({
      id: '', // will be auto-generated
      name: m.name,
      assetIndex: m.assetIndex,
      enabled: true,
    })))
    setError(null)
  }

  const handleCountryChange = (country: string) => {
    const currency = COUNTRY_CURRENCY[country] || siteForm.currency
    const timezone = COUNTRY_TIMEZONE[country] || siteForm.timezone
    setSiteForm(prev => ({ ...prev, country, currency, timezone }))
  }

  const handleNext = () => {
    setError(null)
    if (currentStep === 1) {
      if (!selectedType) { setError('Please select a site type'); return }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (!siteForm.name.trim()) { setError('Site name is required'); return }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setCurrentStep(4)
    } else if (currentStep === 4) {
      setCurrentStep(5)
    } else if (currentStep === 5) {
      handleCreate()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleCreate = async () => {
    setError(null)
    setIsCreating(true)
    try {
      // 1) Create site
      const sitePayload: Record<string, any> = {
        name: siteForm.name,
        timezone: siteForm.timezone,
        site_type: selectedType,
      }
      if (siteForm.address) sitePayload.address = siteForm.address
      if (siteForm.city) sitePayload.city = siteForm.city
      if (siteForm.country) sitePayload.country = siteForm.country
      if (siteForm.grid_capacity_kva) sitePayload.grid_capacity_kva = parseFloat(siteForm.grid_capacity_kva)
      if (siteForm.operating_hours) sitePayload.operating_hours = siteForm.operating_hours
      if (siteForm.currency) sitePayload.currency = siteForm.currency

      const site = await createSiteMutation.mutateAsync(sitePayload)

      // 2) Create enabled assets
      const enabledAssets = assets.filter(a => a.enabled && a.name.trim())
      const createdAssets: { id: number; name: string }[] = []
      for (const asset of enabledAssets) {
        const created = await createAssetMutation.mutateAsync({
          site_id: site.id,
          name: asset.name,
          asset_type: asset.type,
          rated_capacity_kw: asset.capacity || undefined,
          is_critical: false,
          requires_metering: true,
        })
        createdAssets.push({ id: created.id, name: created.name })
      }

      // 3) Create enabled meters
      const enabledMeters = meters.filter(m => m.enabled && m.name.trim())
      for (let i = 0; i < enabledMeters.length; i++) {
        const meter = enabledMeters[i]
        const linkedAsset = createdAssets[meter.assetIndex]
        const meterId = meter.id || `MTR-${siteForm.name.replace(/\s+/g, '-').substring(0, 10)}-${String(i + 1).padStart(3, '0')}`
        await createMeterMutation.mutateAsync({
          site_id: site.id,
          meter_id: meterId,
          name: meter.name,
          asset_id: linkedAsset?.id,
          is_active: true,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['meters'] })

      onComplete(site.id)
      handleReset()
    } catch (err: any) {
      setError(err.message || 'Failed to create site')
    } finally {
      setIsCreating(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setSelectedType(null)
    setSiteForm({ name: '', address: '', city: '', country: '', timezone: 'UTC', grid_capacity_kva: '', operating_hours: '', currency: '' })
    setAssets([])
    setMeters([])
    setError(null)
    setIsCreating(false)
  }

  const addCustomAsset = () => {
    setAssets([...assets, { name: '', type: 'sub_panel', capacity: 0, enabled: true }])
  }

  const addCustomMeter = () => {
    setMeters([...meters, { id: '', name: '', assetIndex: -1, enabled: true }])
  }

  if (!isOpen) return null

  const template = getTemplate()
  const enabledAssetCount = assets.filter(a => a.enabled).length
  const enabledMeterCount = meters.filter(m => m.enabled).length

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155',
          width: '100%', maxWidth: '800px', maxHeight: '90vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9' }}>Quick Setup Wizard</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Step Indicators */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#0f172a', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', left: '40px', right: '40px', height: '2px', background: '#334155', zIndex: 0 }} />
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              const Icon = step.icon
              return (
                <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCompleted ? '#10b981' : isCurrent ? '#10b981' : '#334155',
                    border: isCurrent ? '3px solid #34d399' : 'none', transition: 'all 0.2s',
                  }}>
                    {isCompleted ? <Check size={18} color="white" /> : <Icon size={18} color={isCurrent ? 'white' : '#94a3b8'} />}
                  </div>
                  <span style={{
                    marginTop: '0.5rem', fontSize: '0.75rem',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? '#10b981' : isCompleted ? '#34d399' : '#94a3b8',
                    textAlign: 'center',
                  }}>
                    {step.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.3)', padding: '0.75rem 1rem',
              borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* STEP 1: Choose Site Type */}
          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f1f5f9' }}>
                What type of site are you setting up?
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Pick a type and we'll pre-fill smart defaults for grid capacity, assets, and meters.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {SITE_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon
                  const isSelected = selectedType === tpl.key
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleSelectType(tpl.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '1rem', borderRadius: '0.5rem', textAlign: 'left',
                        background: isSelected ? 'rgba(16,185,129,0.1)' : '#0f172a',
                        border: isSelected ? '2px solid #10b981' : '2px solid #334155',
                        cursor: 'pointer', color: '#f1f5f9', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '0.5rem', flexShrink: 0,
                        background: isSelected ? '#10b981' : '#334155',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={22} color={isSelected ? 'white' : '#94a3b8'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tpl.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tpl.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Site Details */}
          {currentStep === 2 && template && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Site Details</h3>
                <span style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem',
                  background: 'rgba(16,185,129,0.15)', color: '#34d399',
                }}>
                  {template.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Site Name *</label>
                  <input
                    type="text"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                    placeholder="e.g., Main Office Building"
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
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    value={siteForm.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    placeholder="e.g., Israel"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Grid Capacity (kVA)</label>
                  <input
                    type="number"
                    value={siteForm.grid_capacity_kva}
                    onChange={(e) => setSiteForm({ ...siteForm, grid_capacity_kva: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Operating Hours</label>
                  <select
                    value={siteForm.operating_hours}
                    onChange={(e) => setSiteForm({ ...siteForm, operating_hours: e.target.value })}
                  >
                    <option value="24_7">24/7</option>
                    <option value="business_hours">Business Hours (08-18)</option>
                    <option value="extended">Extended (06-22)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <input
                    type="text"
                    value={siteForm.currency}
                    onChange={(e) => setSiteForm({ ...siteForm, currency: e.target.value })}
                    placeholder="e.g., USD"
                    maxLength={10}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <select
                    value={siteForm.timezone}
                    onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })}
                  >
                    {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Suggested Assets */}
          {currentStep === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Suggested Assets</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Pre-populated based on your site type. Uncheck to skip, or add custom assets.
                  </p>
                </div>
                <button type="button" onClick={addCustomAsset} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem' }}>
                  <Plus size={16} /> Add Custom
                </button>
              </div>
              {assets.map((asset, index) => (
                <div key={index} style={{
                  background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '0.5rem',
                  marginBottom: '0.5rem', border: '1px solid #334155',
                  opacity: asset.enabled ? 1 : 0.5, transition: 'opacity 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={asset.enabled}
                      onChange={(e) => {
                        const updated = [...assets]
                        updated[index] = { ...updated[index], enabled: e.target.checked }
                        setAssets(updated)
                      }}
                      style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 120px 100px', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={asset.name}
                        onChange={(e) => {
                          const updated = [...assets]
                          updated[index] = { ...updated[index], name: e.target.value }
                          setAssets(updated)
                        }}
                        placeholder="Asset name"
                        disabled={!asset.enabled}
                        style={{ fontSize: '0.85rem' }}
                      />
                      <span style={{
                        fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem',
                        background: 'rgba(59,130,246,0.15)', color: '#60a5fa', textAlign: 'center',
                      }}>
                        {asset.type.replace('_', ' ')}
                      </span>
                      <input
                        type="number"
                        value={asset.capacity || ''}
                        onChange={(e) => {
                          const updated = [...assets]
                          updated[index] = { ...updated[index], capacity: parseFloat(e.target.value) || 0 }
                          setAssets(updated)
                        }}
                        placeholder="kW"
                        disabled={!asset.enabled}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                    {index >= (template?.suggestedAssets.length || 0) && (
                      <button
                        type="button"
                        onClick={() => setAssets(assets.filter((_, i) => i !== index))}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {assets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No assets yet. Click "Add Custom" to create one.
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Suggested Meters */}
          {currentStep === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Suggested Meters</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Meters linked to your assets. Meter IDs will be auto-generated.
                  </p>
                </div>
                <button type="button" onClick={addCustomMeter} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem' }}>
                  <Plus size={16} /> Add Meter
                </button>
              </div>
              {meters.map((meter, index) => {
                const enabledAssets = assets.filter(a => a.enabled)
                return (
                  <div key={index} style={{
                    background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '0.5rem',
                    marginBottom: '0.5rem', border: '1px solid #334155',
                    opacity: meter.enabled ? 1 : 0.5, transition: 'opacity 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={meter.enabled}
                        onChange={(e) => {
                          const updated = [...meters]
                          updated[index] = { ...updated[index], enabled: e.target.checked }
                          setMeters(updated)
                        }}
                        style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={meter.id}
                          onChange={(e) => {
                            const updated = [...meters]
                            updated[index] = { ...updated[index], id: e.target.value }
                            setMeters(updated)
                          }}
                          placeholder="Auto-generated"
                          disabled={!meter.enabled}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <input
                          type="text"
                          value={meter.name}
                          onChange={(e) => {
                            const updated = [...meters]
                            updated[index] = { ...updated[index], name: e.target.value }
                            setMeters(updated)
                          }}
                          placeholder="Meter name"
                          disabled={!meter.enabled}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <select
                          value={meter.assetIndex}
                          onChange={(e) => {
                            const updated = [...meters]
                            updated[index] = { ...updated[index], assetIndex: parseInt(e.target.value) }
                            setMeters(updated)
                          }}
                          disabled={!meter.enabled}
                          style={{ fontSize: '0.85rem' }}
                        >
                          <option value={-1}>-- No asset --</option>
                          {enabledAssets.map((a, ai) => (
                            <option key={ai} value={assets.indexOf(a)}>{a.name || `Asset ${assets.indexOf(a) + 1}`}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMeters(meters.filter((_, i) => i !== index))}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {meters.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No meters yet. Click "Add Meter" to create one.
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Review */}
          {currentStep === 5 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#f1f5f9' }}>Review & Confirm</h3>

              {/* Site Summary */}
              <div style={{
                background: '#0f172a', padding: '1rem', borderRadius: '0.5rem',
                border: '1px solid #334155', marginBottom: '0.75rem',
              }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Site
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Name:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.name}</span></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Type:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{template?.label}</span></div>
                  {siteForm.city && <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>City:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.city}</span></div>}
                  {siteForm.country && <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Country:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.country}</span></div>}
                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Grid:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.grid_capacity_kva} kVA</span></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Hours:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.operating_hours?.replace('_', ' ')}</span></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Timezone:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.timezone}</span></div>
                  {siteForm.currency && <div><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Currency:</span> <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{siteForm.currency}</span></div>}
                </div>
              </div>

              {/* Assets Summary */}
              <div style={{
                background: '#0f172a', padding: '1rem', borderRadius: '0.5rem',
                border: '1px solid #334155', marginBottom: '0.75rem',
              }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Assets ({enabledAssetCount})
                </h4>
                {assets.filter(a => a.enabled).map((asset, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{asset.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{asset.type.replace('_', ' ')} / {asset.capacity} kW</span>
                  </div>
                ))}
                {enabledAssetCount === 0 && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No assets selected</span>}
              </div>

              {/* Meters Summary */}
              <div style={{
                background: '#0f172a', padding: '1rem', borderRadius: '0.5rem',
                border: '1px solid #334155',
              }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Meters ({enabledMeterCount})
                </h4>
                {meters.filter(m => m.enabled).map((meter, i) => {
                  const linkedAsset = meter.assetIndex >= 0 ? assets[meter.assetIndex] : null
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{meter.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {linkedAsset ? `linked to ${linkedAsset.name}` : 'no asset link'}
                      </span>
                    </div>
                  )
                })}
                {enabledMeterCount === 0 && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No meters selected</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a',
        }}>
          <div>
            {currentStep > 1 && (
              <button type="button" onClick={handleBack} className="btn btn-outline" disabled={isCreating}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="btn btn-primary"
            disabled={isCreating}
          >
            {isCreating ? (
              'Creating...'
            ) : currentStep === 5 ? (
              <><Check size={16} /> Create Site</>
            ) : (
              <>Next <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
