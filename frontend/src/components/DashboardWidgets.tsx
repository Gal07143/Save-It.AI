/**
 * Dashboard Widgets Component
 * Provides drag-drop widget management with backend persistence.
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GripVertical, X, Plus, Maximize2, Minimize2, Edit, Save, RotateCcw,
  BarChart3, LineChart, PieChart, Activity, Gauge, DollarSign, AlertCircle,
  LayoutGrid, Settings, Loader2
} from 'lucide-react'
import { api } from '../services/api'

interface Widget {
  id: string | number
  type: string
  title: string
  size: 'small' | 'medium' | 'large'
  position: number
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  config?: Record<string, unknown>
  data_source?: Record<string, unknown>
}

interface DashboardWidgetsProps {
  dashboardId?: number
  widgets?: Widget[]
  onWidgetsChange?: (widgets: Widget[]) => void
  renderWidget: (widget: Widget) => React.ReactNode
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
}

const widgetTypes = [
  { type: 'energy-consumption', title: 'Energy Consumption', icon: BarChart3, backendType: 'line_chart' },
  { type: 'cost-analysis', title: 'Cost Analysis', icon: DollarSign, backendType: 'bar_chart' },
  { type: 'power-trend', title: 'Power Trend', icon: LineChart, backendType: 'line_chart' },
  { type: 'device-status', title: 'Device Status', icon: Activity, backendType: 'device_status' },
  { type: 'meter-readings', title: 'Meter Readings', icon: Gauge, backendType: 'gauge' },
  { type: 'energy-breakdown', title: 'Energy Breakdown', icon: PieChart, backendType: 'pie_chart' },
  { type: 'alarms', title: 'Active Alarms', icon: AlertCircle, backendType: 'alarm_list' },
  { type: 'kpi', title: 'KPI Card', icon: LayoutGrid, backendType: 'kpi_card' },
]

const WIDGETS_STORAGE_KEY = 'saveit_dashboard_widgets'

/**
 * Hook for managing dashboard widgets with backend persistence.
 * Falls back to localStorage when no dashboardId is provided.
 */
export function useDashboardWidgets(dashboardId?: number) {
  const queryClient = useQueryClient()
  const [localWidgets, setLocalWidgets] = useState<Widget[]>(() => {
    try {
      const stored = localStorage.getItem(WIDGETS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : getDefaultWidgets()
    } catch {
      return getDefaultWidgets()
    }
  })
  const [isEditing, setIsEditing] = useState(false)

  // Fetch dashboard with widgets from backend
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => api.dashboards.get(dashboardId!),
    enabled: !!dashboardId,
  })

  // Add widget mutation
  const addWidgetMutation = useMutation({
    mutationFn: async (widget: { type: string; title: string; position_x: number; position_y: number; width: number; height: number }) => {
      if (!dashboardId) throw new Error('No dashboard ID')
      return api.dashboards.addWidget(dashboardId, {
        widget_type: widget.type,
        title: widget.title,
        position_x: widget.position_x,
        position_y: widget.position_y,
        width: widget.width,
        height: widget.height,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
    },
  })

  // Update widget mutation
  const updateWidgetMutation = useMutation({
    mutationFn: async ({ widgetId, updates }: { widgetId: number; updates: Partial<Widget> }) => {
      return api.dashboards.updateWidget(widgetId, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
    },
  })

  // Delete widget mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: (widgetId: number) => api.dashboards.deleteWidget(widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
    },
  })

  // Convert backend widgets to local format
  const widgets: Widget[] = dashboardId && dashboard?.widgets
    ? dashboard.widgets.map((w: { id: number; widget_type: string; title: string; position_x: number; position_y: number; width: number; height: number; config?: Record<string, unknown>; data_source?: Record<string, unknown> }) => ({
        id: w.id,
        type: w.widget_type,
        title: w.title || w.widget_type,
        size: widthToSize(w.width),
        position: w.position_y * 12 + w.position_x,
        position_x: w.position_x,
        position_y: w.position_y,
        width: w.width,
        height: w.height,
        config: w.config,
        data_source: w.data_source,
      }))
    : localWidgets

  // Local storage save
  const saveLocalWidgets = useCallback((newWidgets: Widget[]) => {
    setLocalWidgets(newWidgets)
    localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(newWidgets))
  }, [])

  const addWidget = useCallback((type: string) => {
    const widgetType = widgetTypes.find(w => w.type === type || w.backendType === type)
    if (!widgetType) return

    if (dashboardId) {
      // Find next available position
      const maxY = widgets.reduce((max, w) => Math.max(max, (w.position_y || 0) + (w.height || 3)), 0)
      addWidgetMutation.mutate({
        type: widgetType.backendType || widgetType.type,
        title: widgetType.title,
        position_x: 0,
        position_y: maxY,
        width: 4,
        height: 3,
      })
    } else {
      const newWidget: Widget = {
        id: Date.now().toString(),
        type,
        title: widgetType.title,
        size: 'medium',
        position: localWidgets.length,
      }
      saveLocalWidgets([...localWidgets, newWidget])
    }
  }, [dashboardId, widgets, localWidgets, addWidgetMutation, saveLocalWidgets])

  const removeWidget = useCallback((id: string | number) => {
    if (dashboardId && typeof id === 'number') {
      deleteWidgetMutation.mutate(id)
    } else {
      saveLocalWidgets(localWidgets.filter(w => w.id !== id))
    }
  }, [dashboardId, localWidgets, deleteWidgetMutation, saveLocalWidgets])

  const updateWidget = useCallback((id: string | number, updates: Partial<Widget>) => {
    if (dashboardId && typeof id === 'number') {
      // Convert size to width/height for backend
      const backendUpdates: Partial<Widget> = { ...updates }
      if (updates.size) {
        backendUpdates.width = sizeToWidth(updates.size)
      }
      updateWidgetMutation.mutate({ widgetId: id, updates: backendUpdates })
    } else {
      saveLocalWidgets(localWidgets.map(w => w.id === id ? { ...w, ...updates } : w))
    }
  }, [dashboardId, localWidgets, updateWidgetMutation, saveLocalWidgets])

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    const newWidgets = [...widgets]
    const [moved] = newWidgets.splice(fromIndex, 1)
    newWidgets.splice(toIndex, 0, moved)

    if (dashboardId) {
      // Update positions in backend
      newWidgets.forEach((w, i) => {
        if (typeof w.id === 'number') {
          updateWidgetMutation.mutate({
            widgetId: w.id,
            updates: { position_y: Math.floor(i / 3), position_x: (i % 3) * 4 },
          })
        }
      })
    } else {
      saveLocalWidgets(newWidgets.map((w, i) => ({ ...w, position: i })))
    }
  }, [dashboardId, widgets, updateWidgetMutation, saveLocalWidgets])

  const resetWidgets = useCallback(() => {
    if (!dashboardId) {
      saveLocalWidgets(getDefaultWidgets())
    }
  }, [dashboardId, saveLocalWidgets])

  return {
    widgets,
    isLoading,
    error,
    isEditing,
    setIsEditing,
    addWidget,
    removeWidget,
    updateWidget,
    moveWidget,
    resetWidgets,
    setWidgets: saveLocalWidgets,
    isSaving: addWidgetMutation.isPending || updateWidgetMutation.isPending || deleteWidgetMutation.isPending,
  }
}

function getDefaultWidgets(): Widget[] {
  return [
    { id: '1', type: 'energy-consumption', title: 'Energy Consumption', size: 'large', position: 0 },
    { id: '2', type: 'cost-analysis', title: 'Cost Analysis', size: 'medium', position: 1 },
    { id: '3', type: 'device-status', title: 'Device Status', size: 'medium', position: 2 },
    { id: '4', type: 'energy-breakdown', title: 'Energy Breakdown', size: 'medium', position: 3 },
  ]
}

function widthToSize(width: number): 'small' | 'medium' | 'large' {
  if (width <= 3) return 'small'
  if (width <= 6) return 'medium'
  return 'large'
}

function sizeToWidth(size: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small': return 3
    case 'medium': return 4
    case 'large': return 6
  }
}

export default function DashboardWidgets({
  dashboardId,
  widgets: propWidgets,
  onWidgetsChange,
  renderWidget,
  isEditing: propIsEditing,
  onEditingChange,
}: DashboardWidgetsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [internalEditing, setInternalEditing] = useState(false)

  const isEditing = propIsEditing ?? internalEditing
  const setIsEditing = onEditingChange ?? setInternalEditing

  // Use hook for backend persistence when dashboardId is provided
  const {
    widgets: hookWidgets,
    addWidget: hookAddWidget,
    removeWidget: hookRemoveWidget,
    updateWidget: hookUpdateWidget,
    isSaving,
  } = useDashboardWidgets(dashboardId)

  const widgets = propWidgets ?? hookWidgets

  const handleDragStart = (index: number) => {
    if (!isEditing) return
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!isEditing) return
    if (draggedIndex === null || draggedIndex === index) return

    const newWidgets = [...widgets]
    const [moved] = newWidgets.splice(draggedIndex, 1)
    newWidgets.splice(index, 0, moved)

    if (onWidgetsChange) {
      onWidgetsChange(newWidgets.map((w, i) => ({ ...w, position: i })))
    }
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleRemove = (id: string | number) => {
    if (onWidgetsChange) {
      onWidgetsChange(widgets.filter(w => w.id !== id))
    } else {
      hookRemoveWidget(id)
    }
  }

  const handleResize = (id: string | number) => {
    const sizes: Widget['size'][] = ['small', 'medium', 'large']
    const widget = widgets.find(w => w.id === id)
    if (!widget) return

    const currentIndex = sizes.indexOf(widget.size)
    const nextSize = sizes[(currentIndex + 1) % sizes.length]

    if (onWidgetsChange) {
      onWidgetsChange(widgets.map(w => w.id === id ? { ...w, size: nextSize } : w))
    } else {
      hookUpdateWidget(id, { size: nextSize })
    }
  }

  const handleAdd = (type: string) => {
    const widgetType = widgetTypes.find(w => w.type === type)
    if (!widgetType) return

    if (onWidgetsChange) {
      const newWidget: Widget = {
        id: Date.now().toString(),
        type,
        title: widgetType.title,
        size: 'medium',
        position: widgets.length,
      }
      onWidgetsChange([...widgets, newWidget])
    } else {
      hookAddWidget(type)
    }
    setShowAddModal(false)
  }

  const getSizeClass = (size: Widget['size']) => {
    switch (size) {
      case 'small': return { gridColumn: 'span 1' }
      case 'medium': return { gridColumn: 'span 2' }
      case 'large': return { gridColumn: 'span 3' }
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEditing && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.813rem',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
            }}>
              <Edit size={14} />
              Edit Mode
              {isSaving && <Loader2 size={14} className="spinning" />}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`btn ${isEditing ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {isEditing ? (
              <>
                <Save size={16} />
                Done
              </>
            ) : (
              <>
                <Settings size={16} />
                Customize
              </>
            )}
          </button>
          {isEditing && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <Plus size={16} />
              Add Widget
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}
      className="dashboard-widgets-grid"
      >
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            draggable={isEditing}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="dashboard-widget"
            style={{
              ...getSizeClass(widget.size),
              background: '#1e293b',
              borderRadius: '0.75rem',
              border: isEditing
                ? (draggedIndex === index ? '2px solid #10b981' : '2px dashed #334155')
                : '1px solid #334155',
              overflow: 'hidden',
              opacity: draggedIndex === index ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            <div className="widget-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #334155',
              cursor: isEditing ? 'grab' : 'default',
              background: isEditing ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEditing && <GripVertical size={16} color="#64748b" />}
                <span className="widget-title" style={{ fontWeight: 500, fontSize: '0.875rem', color: '#f1f5f9' }}>
                  {widget.title}
                </span>
              </div>
              {isEditing && (
                <div className="widget-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    onClick={() => handleResize(widget.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.375rem',
                      color: '#64748b',
                      borderRadius: '0.25rem',
                    }}
                    title={`Resize widget (${widget.size})`}
                  >
                    {widget.size === 'large' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    onClick={() => handleRemove(widget.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.375rem',
                      color: '#ef4444',
                      borderRadius: '0.25rem',
                    }}
                    title="Remove widget"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="widget-body" style={{ padding: '1rem' }}>
              {renderWidget(widget)}
            </div>
          </div>
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="empty-state" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '0.75rem',
          border: '2px dashed #334155',
        }}>
          <LayoutGrid size={48} color="#64748b" style={{ marginBottom: '1rem' }} />
          <div style={{ color: '#f1f5f9', fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No widgets yet
          </div>
          <div style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Add widgets to customize your dashboard view.
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Add Your First Widget
          </button>
        </div>
      )}

      {showAddModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="modal"
            style={{
              background: '#1e293b',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="#10b981" />
                Add Widget
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost btn-sm"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
            }}>
              {widgetTypes.map(type => {
                const Icon = type.icon
                return (
                  <button
                    key={type.type}
                    onClick={() => handleAdd(type.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#f1f5f9',
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
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={20} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {type.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
