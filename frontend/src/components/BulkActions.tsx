import { useState } from 'react'
import { CheckSquare, Square, X } from 'lucide-react'

interface BulkActionsProps<T> {
  items: T[]
  selectedIds: Set<number | string>
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggle: (id: number | string) => void
  getId: (item: T) => number | string
  actions: Array<{
    label: string
    icon: React.ElementType
    onClick: (ids: (number | string)[]) => void
    variant?: 'default' | 'danger'
  }>
}

export default function BulkActions<T>({ 
  items, 
  selectedIds, 
  onSelectAll, 
  onDeselectAll, 
  actions,
}: BulkActionsProps<T>) {
  const selectedCount = selectedIds.size
  const allSelected = selectedCount === items.length && items.length > 0

  if (selectedCount === 0) {
    return null
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.75rem 1rem',
      background: 'rgba(16, 185, 129, 0.1)',
      borderRadius: '0.5rem',
      marginBottom: '1rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#10b981',
            fontSize: '0.813rem',
          }}
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div style={{
        width: '1px',
        height: '24px',
        background: '#334155',
      }} />

      <span style={{
        color: '#f1f5f9',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}>
        {selectedCount} selected
      </span>

      <div style={{
        width: '1px',
        height: '24px',
        background: '#334155',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flex: 1,
      }}>
        {actions.map((action, index) => {
          const Icon = action.icon
          const isDanger = action.variant === 'danger'
          
          return (
            <button
              key={index}
              onClick={() => action.onClick(Array.from(selectedIds))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                background: isDanger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                color: isDanger ? '#ef4444' : '#94a3b8',
                fontSize: '0.813rem',
              }}
            >
              <Icon size={14} />
              {action.label}
            </button>
          )
        })}
      </div>

      <button
        onClick={onDeselectAll}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.375rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#64748b',
        }}
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function useSelection<T>(items: T[], getId: (item: T) => number | string) {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set())

  const toggle = (id: number | string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(items.map(getId)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const isSelected = (id: number | string) => selectedIds.has(id)

  return {
    selectedIds,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
    selectedCount: selectedIds.size,
  }
}
