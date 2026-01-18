import { useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Plus, Building2, MapPin, ArrowRight, Gauge, Zap, Sparkles } from 'lucide-react'
import SiteSetupWizard from '../components/SiteSetupWizard'

export default function Sites() {
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', country: '', timezone: 'UTC' })

  const { data: sites, isLoading } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const createMutation = useMutation({
    mutationFn: api.sites.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setShowForm(false)
      setFormData({ name: '', address: '', city: '', country: '', timezone: 'UTC' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
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
        <p>Loading sites...</p>
      ) : sites && sites.length > 0 ? (
        <div className="grid grid-3">
          {sites.map((site) => (
            <div 
              key={site.id} 
              className="card" 
              style={{ cursor: 'pointer', transition: 'all 0.2s', border: '2px solid transparent' }}
              onClick={() => navigate(`/site-dashboard/${site.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
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
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '0.5rem', 
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#10b981' }}>
                    <Gauge size={14} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>--</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Meters</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#3b82f6' }}>
                    <Zap size={14} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>--</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>kW Load</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f59e0b' }}>
                    <Building2 size={14} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>--</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Assets</div>
                </div>
              </div>
            </div>
          ))}
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
      
      <SiteSetupWizard 
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={(siteId) => {
          setShowWizard(false)
          queryClient.invalidateQueries({ queryKey: ['sites'] })
          navigate(`/site-dashboard/${siteId}`)
        }}
      />
    </div>
  )
}
