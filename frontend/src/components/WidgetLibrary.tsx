/**
 * Widget Library
 * Modal component for selecting widget types to add to a dashboard.
 * Matches backend WidgetType enum from dashboard_service.py
 */

import { useState } from 'react'
import {
  X, Search,
  Gauge, LineChart, BarChart3, PieChart, Table2, Map,
  Bell, Activity, TrendingUp, Type, Image, Grid3X3, ScatterChart
} from 'lucide-react'

// Widget type definitions matching backend WidgetType enum
export type WidgetType =
  | 'gauge'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'map'
  | 'alarm_list'
  | 'device_status'
  | 'kpi_card'
  | 'text'
  | 'image'
  | 'heatmap'
  | 'scatter'

export interface WidgetTypeDefinition {
  type: WidgetType
  name: string
  description: string
  icon: typeof Gauge
  category: 'charts' | 'metrics' | 'monitoring' | 'content'
  supportsRealtime: boolean
  defaultSize: { width: number; height: number }
  minSize: { width: number; height: number }
}

// Widget definitions with metadata
export const WIDGET_TYPES: WidgetTypeDefinition[] = [
  {
    type: 'gauge',
    name: 'Gauge',
    description: 'Single value dial indicator',
    icon: Gauge,
    category: 'metrics',
    supportsRealtime: true,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 2, height: 2 },
  },
  {
    type: 'kpi_card',
    name: 'KPI Card',
    description: 'Large value display with trend',
    icon: TrendingUp,
    category: 'metrics',
    supportsRealtime: true,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 2, height: 2 },
  },
  {
    type: 'line_chart',
    name: 'Line Chart',
    description: 'Time series visualization',
    icon: LineChart,
    category: 'charts',
    supportsRealtime: true,
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 4, height: 3 },
  },
  {
    type: 'bar_chart',
    name: 'Bar Chart',
    description: 'Categorical comparison',
    icon: BarChart3,
    category: 'charts',
    supportsRealtime: false,
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 4, height: 3 },
  },
  {
    type: 'pie_chart',
    name: 'Pie Chart',
    description: 'Distribution breakdown',
    icon: PieChart,
    category: 'charts',
    supportsRealtime: false,
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
  },
  {
    type: 'scatter',
    name: 'Scatter Plot',
    description: 'Correlation analysis',
    icon: ScatterChart,
    category: 'charts',
    supportsRealtime: false,
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 3, height: 3 },
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    description: 'Time/value intensity grid',
    icon: Grid3X3,
    category: 'charts',
    supportsRealtime: false,
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Tabular data display',
    icon: Table2,
    category: 'charts',
    supportsRealtime: true,
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 4, height: 3 },
  },
  {
    type: 'alarm_list',
    name: 'Alarm List',
    description: 'Active alarms feed',
    icon: Bell,
    category: 'monitoring',
    supportsRealtime: true,
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 4, height: 3 },
  },
  {
    type: 'device_status',
    name: 'Device Status',
    description: 'Equipment health overview',
    icon: Activity,
    category: 'monitoring',
    supportsRealtime: true,
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
  },
  {
    type: 'map',
    name: 'Map',
    description: 'Geospatial visualization',
    icon: Map,
    category: 'monitoring',
    supportsRealtime: true,
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 6, height: 4 },
  },
  {
    type: 'text',
    name: 'Text',
    description: 'Static text or notes',
    icon: Type,
    category: 'content',
    supportsRealtime: false,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 2, height: 1 },
  },
  {
    type: 'image',
    name: 'Image',
    description: 'Static image or logo',
    icon: Image,
    category: 'content',
    supportsRealtime: false,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 2, height: 2 },
  },
]

const CATEGORIES = [
  { id: 'all', name: 'All Widgets' },
  { id: 'charts', name: 'Charts' },
  { id: 'metrics', name: 'Metrics' },
  { id: 'monitoring', name: 'Monitoring' },
  { id: 'content', name: 'Content' },
]

interface WidgetLibraryProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (widgetType: WidgetTypeDefinition) => void
}

export default function WidgetLibrary({ isOpen, onClose, onSelect }: WidgetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  if (!isOpen) return null

  const filteredWidgets = WIDGET_TYPES.filter(widget => {
    const matchesSearch = searchQuery === '' ||
      widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      widget.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const handleSelect = (widget: WidgetTypeDefinition) => {
    onSelect(widget)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '720px', maxHeight: '90vh' }}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Add Widget</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #334155' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
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
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '2.5rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: selectedCategory === category.id ? '#10b981' : '#334155',
                  color: selectedCategory === category.id ? 'white' : '#94a3b8',
                  fontSize: '0.813rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: 'calc(90vh - 200px)', overflowY: 'auto' }}>
          {filteredWidgets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Search size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No widgets found matching your search.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}>
              {filteredWidgets.map(widget => {
                const Icon = widget.icon
                return (
                  <button
                    key={widget.type}
                    onClick={() => handleSelect(widget)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid #334155',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#10b981'
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#334155'
                      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)'
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.75rem',
                    }}>
                      <Icon size={24} color="#10b981" />
                    </div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                      {widget.name}
                    </div>
                    <div style={{ fontSize: '0.813rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      {widget.description}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {widget.supportsRealtime && (
                        <span style={{
                          fontSize: '0.688rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '4px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                        }}>
                          Real-time
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.688rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        textTransform: 'capitalize',
                      }}>
                        {widget.category}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Get widget type definition by type string
 */
export function getWidgetTypeDefinition(type: string): WidgetTypeDefinition | undefined {
  return WIDGET_TYPES.find(w => w.type === type)
}

/**
 * Get all widget types for a specific category
 */
export function getWidgetsByCategory(category: string): WidgetTypeDefinition[] {
  if (category === 'all') return WIDGET_TYPES
  return WIDGET_TYPES.filter(w => w.category === category)
}
