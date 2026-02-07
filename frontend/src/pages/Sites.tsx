import { useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  Plus, Building2, MapPin, ArrowRight, Gauge, Zap, Sparkles,
  Search, Edit2, Trash2, X, AlertTriangle, Loader2, Bell,
  ChevronDown, ChevronUp
} from 'lucide-react'
import SiteSetupWizard from '../components/SiteSetupWizard'

interface SiteStats {
  site_id: number
  meters_count: number
  assets_count: number
  total_load_kw: number
  active_alarms: number
}

const SITE_TYPES = [
  { value: 'commercial_office', label: 'Commercial Office' },
  { value: 'industrial_factory', label: 'Industrial Factory' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'data_center', label: 'Data Center' },
  { value: 'retail', label: 'Retail' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'residential_complex', label: 'Residential Complex' },
  { value: 'mixed_use', label: 'Mixed Use' },
]

const OPERATING_HOURS_OPTIONS = [
  { value: '24_7', label: '24/7' },
  { value: 'business_hours', label: 'Business Hours (08:00-18:00)' },
  { value: 'extended', label: 'Extended (06:00-22:00)' },
  { value: 'custom', label: 'Custom' },
]

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
]

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  'US': 'USD', 'USA': 'USD', 'United States': 'USD',
  'IL': 'ILS', 'Israel': 'ILS',
  'UK': 'GBP', 'United Kingdom': 'GBP', 'GB': 'GBP',
  'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR', 'Netherlands': 'EUR',
  'UAE': 'AED', 'United Arab Emirates': 'AED',
  'JP': 'JPY', 'Japan': 'JPY',
  'CN': 'CNY', 'China': 'CNY',
  'AU': 'AUD', 'Australia': 'AUD',
  'CA': 'CAD', 'Canada': 'CAD',
  'SG': 'SGD', 'Singapore': 'SGD',
}

const EMPTY_FORM = {
  name: '', address: '', city: '', country: '', timezone: 'UTC',
  site_type: '', industry: '', area_sqm: '', grid_capacity_kva: '',
  operating_hours: '', operating_hours_start: '08:00', operating_hours_end: '18:00',
  currency: '', electricity_rate: '', utility_provider: '',
  contact_name: '', contact_phone: '',
}

type FormData = typeof EMPTY_FORM

export default function Sites() {
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedSite, setSelectedSite] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM })
  const [editFormData, setEditFormData] = useState<FormData>({ ...EMPTY_FORM })
  const [gridSectionOpen, setGridSectionOpen] = useState(true)
  const [contactSectionOpen, setContactSectionOpen] = useState(false)
  const [editGridSectionOpen, setEditGridSectionOpen] = useState(true)
  const [editContactSectionOpen, setEditContactSectionOpen] = useState(false)

  const { data: sites, isLoading } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const { data: allSiteStats } = useQuery({
    queryKey: ['site-stats', sites?.map(s => s.id)],
    queryFn: async () => {
      if (!sites || sites.length === 0) return {}
      const statsPromises = sites.map(site =>
        api.sites.getStats(site.id).catch(() => ({
          site_id: site.id,
          meters_count: 0,
          assets_count: 0,
          total_load_kw: 0,
          active_alarms: 0
        }))
      )
      const statsArray = await Promise.all(statsPromises)
      return statsArray.reduce((acc, stat) => {
        acc[stat.site_id] = stat
        return acc
      }, {} as Record<number, SiteStats>)
    },
    enabled: !!sites && sites.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, any> = { name: data.name, timezone: data.timezone }
      if (data.address) payload.address = data.address
      if (data.city) payload.city = data.city
      if (data.country) payload.country = data.country
      if (data.site_type) payload.site_type = data.site_type
      if (data.industry) payload.industry = data.industry
      if (data.area_sqm) payload.area_sqm = parseFloat(data.area_sqm)
      if (data.grid_capacity_kva) payload.grid_capacity_kva = parseFloat(data.grid_capacity_kva)
      if (data.operating_hours) payload.operating_hours = data.operating_hours
      if (data.operating_hours === 'custom') {
        payload.operating_hours_start = data.operating_hours_start
        payload.operating_hours_end = data.operating_hours_end
      }
      if (data.currency) payload.currency = data.currency
      if (data.electricity_rate) payload.electricity_rate = parseFloat(data.electricity_rate)
      if (data.utility_provider) payload.utility_provider = data.utility_provider
      if (data.contact_name) payload.contact_name = data.contact_name
      if (data.contact_phone) payload.contact_phone = data.contact_phone
      return api.sites.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowForm(false)
      setFormData({ ...EMPTY_FORM })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => {
      const payload: Record<string, any> = {}
      payload.name = data.name
      payload.address = data.address || null
      payload.city = data.city || null
      payload.country = data.country || null
      payload.timezone = data.timezone
      payload.site_type = data.site_type || null
      payload.industry = data.industry || null
      payload.area_sqm = data.area_sqm ? parseFloat(data.area_sqm) : null
      payload.grid_capacity_kva = data.grid_capacity_kva ? parseFloat(data.grid_capacity_kva) : null
      payload.operating_hours = data.operating_hours || null
      payload.operating_hours_start = data.operating_hours === 'custom' ? data.operating_hours_start : null
      payload.operating_hours_end = data.operating_hours === 'custom' ? data.operating_hours_end : null
      payload.currency = data.currency || null
      payload.electricity_rate = data.electricity_rate ? parseFloat(data.electricity_rate) : null
      payload.utility_provider = data.utility_provider || null
      payload.contact_name = data.contact_name || null
      payload.contact_phone = data.contact_phone || null
      return api.sites.update(id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowEditModal(false)
      setSelectedSite(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.sites.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowDeleteConfirm(false)
      setSelectedSite(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleCountryChange = (country: string, setter: (data: FormData) => void, current: FormData) => {
    const suggestedCurrency = CURRENCY_BY_COUNTRY[country] || ''
    setter({ ...current, country, currency: current.currency || suggestedCurrency })
  }

  const handleEdit = (site: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSite(site)
    setEditFormData({
      name: site.name || '',
      address: site.address || '',
      city: site.city || '',
      country: site.country || '',
      timezone: site.timezone || 'UTC',
      site_type: site.site_type || '',
      industry: site.industry || '',
      area_sqm: site.area_sqm ? String(site.area_sqm) : '',
      grid_capacity_kva: site.grid_capacity_kva ? String(site.grid_capacity_kva) : '',
      operating_hours: site.operating_hours || '',
      operating_hours_start: site.operating_hours_start || '08:00',
      operating_hours_end: site.operating_hours_end || '18:00',
      currency: site.currency || '',
      electricity_rate: site.electricity_rate ? String(site.electricity_rate) : '',
      utility_provider: site.utility_provider || '',
      contact_name: site.contact_name || '',
      contact_phone: site.contact_phone || '',
    })
    setEditGridSectionOpen(true)
    setEditContactSectionOpen(!!(site.contact_name || site.contact_phone))
    setShowEditModal(true)
  }

  const handleDelete = (site: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSite(site)
    setShowDeleteConfirm(true)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSite) {
      updateMutation.mutate({ id: selectedSite.id, data: editFormData })
    }
  }

  const handleConfirmDelete = () => {
    if (selectedSite) {
      deleteMutation.mutate(selectedSite.id)
    }
  }

  const filteredSites = sites?.filter(site => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      site.name.toLowerCase().includes(query) ||
      site.city?.toLowerCase().includes(query) ||
      site.country?.toLowerCase().includes(query) ||
      site.address?.toLowerCase().includes(query)
    )
  })

  const getSiteStats = (siteId: number): SiteStats | null => {
    return allSiteStats?.[siteId] || null
  }

  const renderSiteFormFields = (
    data: FormData,
    setData: (d: FormData) => void,
    gridOpen: boolean,
    setGridOpen: (v: boolean) => void,
    contactOpen: boolean,
    setContactOpen: (v: boolean) => void,
  ) => (
    <>
      {/* Section 1: Basic Info */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Basic Info
        </h4>
        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Site Name *</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Site Type</label>
            <select value={data.site_type} onChange={(e) => setData({ ...data, site_type: e.target.value })}>
              <option value="">-- Select --</option>
              {SITE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <input
              type="text"
              value={data.industry}
              onChange={(e) => setData({ ...data, industry: e.target.value })}
              placeholder="e.g. Manufacturing"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Area (sqm)</label>
            <input
              type="number"
              value={data.area_sqm}
              onChange={(e) => setData({ ...data, area_sqm: e.target.value })}
              placeholder="e.g. 5000"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Location */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Location
        </h4>
        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Address</label>
            <input
              type="text"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input
              type="text"
              value={data.country}
              onChange={(e) => handleCountryChange(e.target.value, setData, data)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select value={data.timezone} onChange={(e) => setData({ ...data, timezone: e.target.value })}>
              {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Grid & Utility (collapsible) */}
      <div style={{ marginBottom: '1.25rem', border: '1px solid #334155', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setGridOpen(!gridOpen)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1rem', background: '#0f172a', border: 'none', cursor: 'pointer', color: '#f1f5f9'
          }}
        >
          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Grid & Utility
          </h4>
          {gridOpen ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </button>
        {gridOpen && (
          <div style={{ padding: '1rem' }}>
            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Grid Capacity (kVA)</label>
                <input
                  type="number"
                  value={data.grid_capacity_kva}
                  onChange={(e) => setData({ ...data, grid_capacity_kva: e.target.value })}
                  placeholder="e.g. 300"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Operating Hours</label>
                <select value={data.operating_hours} onChange={(e) => setData({ ...data, operating_hours: e.target.value })}>
                  <option value="">-- Select --</option>
                  {OPERATING_HOURS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {data.operating_hours === 'custom' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      value={data.operating_hours_start}
                      onChange={(e) => setData({ ...data, operating_hours_start: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      value={data.operating_hours_end}
                      onChange={(e) => setData({ ...data, operating_hours_end: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input
                  type="text"
                  value={data.currency}
                  onChange={(e) => setData({ ...data, currency: e.target.value })}
                  placeholder="e.g. USD"
                  maxLength={10}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Avg Electricity Rate ($/kWh)</label>
                <input
                  type="number"
                  step="0.001"
                  value={data.electricity_rate}
                  onChange={(e) => setData({ ...data, electricity_rate: e.target.value })}
                  placeholder="e.g. 0.12"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Utility Provider</label>
                <input
                  type="text"
                  value={data.utility_provider}
                  onChange={(e) => setData({ ...data, utility_provider: e.target.value })}
                  placeholder="e.g. Israel Electric Corp"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Contact (collapsible) */}
      <div style={{ marginBottom: '0.5rem', border: '1px solid #334155', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setContactOpen(!contactOpen)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1rem', background: '#0f172a', border: 'none', cursor: 'pointer', color: '#f1f5f9'
          }}
        >
          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Contact
          </h4>
          {contactOpen ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </button>
        {contactOpen && (
          <div style={{ padding: '1rem' }}>
            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input
                  type="text"
                  value={data.contact_name}
                  onChange={(e) => setData({ ...data, contact_name: e.target.value })}
                  placeholder="Site manager name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="tel"
                  value={data.contact_phone}
                  onChange={(e) => setData({ ...data, contact_phone: e.target.value })}
                  placeholder="+1 555-0123"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Sites</h1>
          <p style={{ color: '#64748b' }}>Manage your facilities and locations</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn"
            onClick={() => setShowWizard(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Sparkles size={18} />
            Quick Setup
          </button>
          <button className="btn btn-outline" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} />
            Add Site
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {sites && sites.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b'
              }}
            />
            <input
              type="text"
              placeholder="Search sites by name, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '2.5rem',
                paddingRight: '0.75rem',
                paddingTop: '0.625rem',
                paddingBottom: '0.625rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f1f5f9',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>New Site</h3>
          <form onSubmit={handleSubmit}>
            {renderSiteFormFields(formData, setFormData, gridSectionOpen, setGridSectionOpen, contactSectionOpen, setContactSectionOpen)}
            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Site'}
              </button>
              <button type="button" className="btn btn-outline" style={{ marginLeft: '0.5rem' }} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
          <Loader2 size={32} className="spinning" style={{ color: '#10b981' }} />
        </div>
      ) : filteredSites && filteredSites.length > 0 ? (
        <div className="grid grid-3">
          {filteredSites.map((site) => {
            const stats = getSiteStats(site.id)
            return (
              <div
                key={site.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '2px solid transparent', position: 'relative' }}
                onClick={() => navigate(`/site-dashboard/${site.id}`)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Action buttons */}
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  display: 'flex',
                  gap: '0.25rem',
                  opacity: 0.7,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                  <button
                    onClick={(e) => handleEdit(site, e)}
                    className="btn btn-ghost btn-sm"
                    title="Edit site"
                    style={{ padding: '0.25rem' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(site, e)}
                    className="btn btn-ghost btn-sm"
                    title="Delete site"
                    style={{ padding: '0.25rem', color: '#ef4444' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Building2 size={24} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{site.name}</h3>
                    {(site.city || site.country) && (
                      <p style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={14} />
                        {[site.city, site.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      {site.site_type && (
                        <span style={{
                          fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
                          background: 'rgba(16,185,129,0.15)', color: '#34d399'
                        }}>
                          {SITE_TYPES.find(t => t.value === site.site_type)?.label || site.site_type}
                        </span>
                      )}
                      {site.grid_capacity_kva && (
                        <span style={{
                          fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
                          background: 'rgba(59,130,246,0.15)', color: '#60a5fa'
                        }}>
                          {site.grid_capacity_kva} kVA
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={20} color="#10b981" />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #334155'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#10b981' }}>
                      <Gauge size={14} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {stats ? stats.meters_count : <Loader2 size={12} className="spinning" />}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Meters</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#3b82f6' }}>
                      <Zap size={14} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {stats ? (stats.total_load_kw > 0 ? stats.total_load_kw.toFixed(0) : '0') : <Loader2 size={12} className="spinning" />}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>kW Load</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f59e0b' }}>
                      <Building2 size={14} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {stats ? stats.assets_count : <Loader2 size={12} className="spinning" />}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Assets</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: stats?.active_alarms ? '#ef4444' : '#64748b' }}>
                      <Bell size={14} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {stats ? stats.active_alarms : <Loader2 size={12} className="spinning" />}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Alarms</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : sites && sites.length > 0 && filteredSites?.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Search size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Sites Found</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>No sites match your search "{searchQuery}"</p>
          <button className="btn btn-outline" onClick={() => setSearchQuery('')}>
            Clear Search
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Building2 size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Sites Yet</h3>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>Create your first site to get started</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={() => setShowWizard(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Sparkles size={18} />
              Quick Setup
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(true)}>
              <Plus size={18} />
              Add Site
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSite && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Edit Site</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                {renderSiteFormFields(editFormData, setEditFormData, editGridSectionOpen, setEditGridSectionOpen, editContactSectionOpen, setEditContactSectionOpen)}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedSite && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: '#ef4444' }}>Delete Site</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <AlertTriangle size={32} color="#ef4444" />
                </div>
                <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  Are you sure you want to delete <strong>{selectedSite.name}</strong>?
                </p>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  This will remove the site and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Site'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteSetupWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={(siteId) => {
          setShowWizard(false)
          queryClient.invalidateQueries({ queryKey: ['sites'] })
          navigate(`/site-dashboard/${siteId}`)
        }}
      />

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
