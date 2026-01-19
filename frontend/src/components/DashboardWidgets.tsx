import { useState, useCallback } from 'react'
import { 
  GripVertical, X, Plus, Maximize2,
  BarChart3, LineChart, PieChart, Activity, Gauge, DollarSign
} from 'lucide-react'

interface Widget {
  id: string
  type: string
  title: string
  size: 'small' | 'medium' | 'large'
  position: number
}

interface DashboardWidgetsProps {
  widgets: Widget[]
  onWidgetsChange: (widgets: Widget[]) => void
  renderWidget: (widget: Widget) => React.ReactNode
}

const widgetTypes = [
  { type: 'energy-consumption', title: 'Energy Consumption', icon: BarChart3 },
  { type: 'cost-analysis', title: 'Cost Analysis', icon: DollarSign },
  { type: 'power-trend', title: 'Power Trend', icon: LineChart },
  { type: 'device-status', title: 'Device Status', icon: Activity },
  { type: 'meter-readings', title: 'Meter Readings', icon: Gauge },
  { type: 'energy-breakdown', title: 'Energy Breakdown', icon: PieChart },
]

const WIDGETS_STORAGE_KEY = 'saveit_dashboard_widgets'

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    try {
      const stored = localStorage.getItem(WIDGETS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : getDefaultWidgets()
    } catch {
      return getDefaultWidgets()
    }
  })

  const saveWidgets = useCallback((newWidgets: Widget[]) => {
    setWidgets(newWidgets)
    localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(newWidgets))
  }, [])

  const addWidget = useCallback((type: string) => {
    const widgetType = widgetTypes.find(w => w.type === type)
    if (!widgetType) return

    const newWidget: Widget = {
      id: Date.now().toString(),
      type,
      title: widgetType.title,
      size: 'medium',
      position: widgets.length,
    }
    saveWidgets([...widgets, newWidget])
  }, [widgets, saveWidgets])

  const removeWidget = useCallback((id: string) => {
    saveWidgets(widgets.filter(w => w.id !== id))
  }, [widgets, saveWidgets])

  const updateWidget = useCallback((id: string, updates: Partial<Widget>) => {
    saveWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w))
  }, [widgets, saveWidgets])

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    const newWidgets = [...widgets]
    const [moved] = newWidgets.splice(fromIndex, 1)
    newWidgets.splice(toIndex, 0, moved)
    saveWidgets(newWidgets.map((w, i) => ({ ...w, position: i })))
  }, [widgets, saveWidgets])

  const resetWidgets = useCallback(() => {
    saveWidgets(getDefaultWidgets())
  }, [saveWidgets])

  return { 
    widgets, 
    addWidget, 
    removeWidget, 
    updateWidget, 
    moveWidget, 
    resetWidgets,
    setWidgets: saveWidgets,
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

export default function DashboardWidgets({ widgets, onWidgetsChange, renderWidget }: DashboardWidgetsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newWidgets = [...widgets]
    const [moved] = newWidgets.splice(draggedIndex, 1)
    newWidgets.splice(index, 0, moved)
    onWidgetsChange(newWidgets.map((w, i) => ({ ...w, position: i })))
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleRemove = (id: string) => {
    onWidgetsChange(widgets.filter(w => w.id !== id))
  }

  const handleResize = (id: string) => {
    const sizes: Widget['size'][] = ['small', 'medium', 'large']
    const widget = widgets.find(w => w.id === id)
    if (!widget) return

    const currentIndex = sizes.indexOf(widget.size)
    const nextSize = sizes[(currentIndex + 1) % sizes.length]
    onWidgetsChange(widgets.map(w => w.id === id ? { ...w, size: nextSize } : w))
  }

  const handleAdd = (type: string) => {
    const widgetType = widgetTypes.find(w => w.type === type)
    if (!widgetType) return

    const newWidget: Widget = {
      id: Date.now().toString(),
      type,
      title: widgetType.title,
      size: 'medium',
      position: widgets.length,
    }
    onWidgetsChange([...widgets, newWidget])
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
        justifyContent: 'flex-end',
        marginBottom: '1rem',
      }}>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Plus size={16} />
          Add Widget
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}>
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            style={{
              ...getSizeClass(widget.size),
              background: '#1e293b',
              borderRadius: '0.75rem',
              border: draggedIndex === index ? '2px solid #10b981' : '1px solid #334155',
              overflow: 'hidden',
              opacity: draggedIndex === index ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #334155',
              cursor: 'grab',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GripVertical size={16} color="#64748b" />
                <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#f1f5f9' }}>
                  {widget.title}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => handleResize(widget.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: '#64748b',
                  }}
                  title="Resize widget"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  onClick={() => handleRemove(widget.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: '#64748b',
                  }}
                  title="Remove widget"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              {renderWidget(widget)}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div
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
            style={{
              background: '#1e293b',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.125rem', color: '#f1f5f9' }}>
              Add Widget
            </h3>
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
