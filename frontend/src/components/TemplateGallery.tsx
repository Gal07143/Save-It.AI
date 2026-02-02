/**
 * Template Gallery Component
 * Displays available dashboard templates with preview and instantiation.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutTemplate, Factory, Building2, ShoppingBag, Heart, GraduationCap,
  Plus, ChevronRight, Loader2, X, Check
} from 'lucide-react'
import { api } from '../services/api'

interface DashboardTemplate {
  id: string
  name: string
  description: string
  preview_image: string
  widget_count: number
}

interface TemplateDetail {
  id: string
  name: string
  description: string
  preview_image: string
  widgets: Array<{
    type: string
    title: string
    position_x: number
    position_y: number
    width: number
    height: number
  }>
}

interface Site {
  id: number
  name: string
}

interface TemplateGalleryProps {
  isOpen: boolean
  onClose: () => void
  onDashboardCreated?: (dashboardId: number) => void
}

const TEMPLATE_ICONS: Record<string, typeof Factory> = {
  manufacturing: Factory,
  commercial: Building2,
  retail: ShoppingBag,
  healthcare: Heart,
  education: GraduationCap,
}

export default function TemplateGallery({
  isOpen,
  onClose,
  onDashboardCreated,
}: TemplateGalleryProps) {
  const queryClient = useQueryClient()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  const [customName, setCustomName] = useState('')
  const [step, setStep] = useState<'select' | 'configure'>('select')

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['dashboard-templates'],
    queryFn: async () => {
      const response = await fetch('/api/v1/dashboards/templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      return response.json() as Promise<DashboardTemplate[]>
    },
    enabled: isOpen,
  })

  // Fetch template detail
  const { data: templateDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['dashboard-template', selectedTemplate],
    queryFn: async () => {
      const response = await fetch(`/api/v1/dashboards/templates/${selectedTemplate}`)
      if (!response.ok) throw new Error('Failed to fetch template detail')
      return response.json() as Promise<TemplateDetail>
    },
    enabled: !!selectedTemplate && step === 'configure',
  })

  // Fetch sites for selection
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.sites.list(),
    enabled: isOpen && step === 'configure',
  })

  // Create dashboard from template
  const createMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams()
      if (customName) params.append('name', customName)
      if (selectedSite) params.append('site_id', selectedSite.toString())

      const response = await fetch(
        `/api/v1/dashboards/templates/${selectedTemplate}/instantiate?${params}`,
        { method: 'POST' }
      )
      if (!response.ok) throw new Error('Failed to create dashboard')
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      onDashboardCreated?.(data.id)
      handleClose()
    },
  })

  const handleClose = () => {
    setSelectedTemplate(null)
    setSelectedSite(null)
    setCustomName('')
    setStep('select')
    onClose()
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    setStep('configure')
  }

  const handleBack = () => {
    setStep('select')
    setSelectedTemplate(null)
  }

  const handleCreate = () => {
    createMutation.mutate()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: step === 'select' ? '800px' : '600px', maxHeight: '80vh' }}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutTemplate size={20} />
            {step === 'select' ? 'Dashboard Templates' : 'Configure Dashboard'}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ overflow: 'auto' }}>
          {step === 'select' ? (
            <>
              <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Choose a template to quickly create a dashboard optimized for your industry.
              </p>

              {templatesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 size={32} className="spinning" style={{ color: '#10b981' }} />
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '1rem',
                }}>
                  {templates?.map(template => {
                    const Icon = TEMPLATE_ICONS[template.id] || LayoutTemplate
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '1.25rem',
                          background: 'rgba(15, 23, 42, 0.5)',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.borderColor = '#10b981'
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.borderColor = '#334155'
                          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)'
                        }}
                      >
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '0.75rem',
                          background: 'rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '1rem',
                        }}>
                          <Icon size={24} color="#10b981" />
                        </div>
                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
                          {template.name}
                        </div>
                        <div style={{ fontSize: '0.813rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                          {template.description}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                        }}>
                          <span>{template.widget_count} widgets</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 size={32} className="spinning" style={{ color: '#10b981' }} />
                </div>
              ) : templateDetail && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '0.75rem',
                  }}>
                    {(() => {
                      const Icon = TEMPLATE_ICONS[templateDetail.id] || LayoutTemplate
                      return <Icon size={32} color="#10b981" />
                    })()}
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{templateDetail.name}</div>
                      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{templateDetail.description}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#f1f5f9' }}>
                      Dashboard Name (optional)
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      placeholder={`${templateDetail.name} Dashboard`}
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        color: '#f1f5f9',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#f1f5f9' }}>
                      Select Site (optional)
                    </label>
                    <select
                      value={selectedSite || ''}
                      onChange={e => setSelectedSite(e.target.value ? Number(e.target.value) : null)}
                      className="form-select"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        color: '#f1f5f9',
                      }}
                    >
                      <option value="">All Sites</option>
                      {sites?.map((site: Site) => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '0.813rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Widgets will be configured to show data from the selected site.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500, color: '#f1f5f9' }}>
                      Included Widgets ({templateDetail.widgets.length})
                    </label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                    }}>
                      {templateDetail.widgets.map((widget, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(15, 23, 42, 0.3)',
                            borderRadius: '0.375rem',
                            fontSize: '0.813rem',
                          }}
                        >
                          <Check size={14} color="#10b981" />
                          <span style={{ color: '#e2e8f0' }}>{widget.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 'configure' && (
            <button className="btn" onClick={handleBack} disabled={createMutation.isPending}>
              Back
            </button>
          )}
          <button className="btn" onClick={handleClose} disabled={createMutation.isPending}>
            Cancel
          </button>
          {step === 'configure' && (
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{ minWidth: '140px' }}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Dashboard
                </>
              )}
            </button>
          )}
        </div>
      </div>

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

/**
 * Hook for using TemplateGallery
 */
export function useTemplateGallery(onDashboardCreated?: (dashboardId: number) => void) {
  const [isOpen, setIsOpen] = useState(false)

  const openGallery = () => setIsOpen(true)
  const closeGallery = () => setIsOpen(false)

  const TemplateGalleryModal = () => (
    <TemplateGallery
      isOpen={isOpen}
      onClose={closeGallery}
      onDashboardCreated={onDashboardCreated}
    />
  )

  return {
    isOpen,
    openGallery,
    closeGallery,
    TemplateGalleryModal,
  }
}
