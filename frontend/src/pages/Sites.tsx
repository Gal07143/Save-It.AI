import { useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  Plus, Building2, MapPin, ArrowRight, Gauge, Zap, Sparkles,
  Search, Edit2, Trash2, X, AlertTriangle, Loader2, Bell
} from 'lucide-react'
import SiteSetupWizard from '../components/SiteSetupWizard'

interface SiteStats {
  site_id: number
  meters_count: number
  assets_count: number
  total_load_kw: number
  active_alarms: number
}

export default function Sites() {
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedSite, setSelectedSite] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({ name: '', address: '', city: '', country: '', timezone: 'UTC' })
  const [editFormData, setEditFormData] = useState({ name: '', address: '', city: '', country: '', timezone: 'UTC' })

  const { data: sites, isLoading } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  // Fetch stats for all sites
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
    mutationFn: api.sites.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowForm(false)
      setFormData({ name: '', address: '', city: '', country: '', timezone: 'UTC' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.sites.update(id, data),
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

  const handleEdit = (site: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSite(site)
    setEditFormData({
      name: site.name,
      address: site.address || '',
      city: site.city || '',
      country: site.country || '',
      timezone: site.timezone || 'UTC'
    })
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

  // Filter sites based on search query
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
            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Site Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                </select>
              </div>
            </div>
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
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      Timezone: {site.timezone}
                    </p>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Edit Site</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Site Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input
                      type="text"
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <select
                    value={editFormData.timezone}
                    onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="Australia/Sydney">Australia/Sydney</option>
                  </select>
                </div>
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
