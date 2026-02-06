/**
 * Dashboard Context
 * Manages dashboard state with backend persistence.
 * Replaces localStorage-based widget management.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

// Types
export interface WidgetPosition {
  x: number
  y: number
}

export interface WidgetSize {
  width: number
  height: number
}

export interface Widget {
  id: number
  type: string
  title: string | null
  position: WidgetPosition
  size: WidgetSize
  config: Record<string, unknown>
  data_source: Record<string, unknown>
}

export interface Dashboard {
  id: number
  name: string
  description: string | null
  is_default: boolean
  is_shared: boolean
  theme: string
  refresh_interval: number
  created_at: string
  layout?: Record<string, unknown> | null
  widgets?: Widget[]
}

export interface DashboardContextValue {
  // State
  dashboards: Dashboard[]
  currentDashboard: Dashboard | null
  widgets: Widget[]
  isEditing: boolean
  isLoading: boolean
  error: string | null

  // Dashboard actions
  selectDashboard: (id: number) => void
  createDashboard: (name: string, description?: string) => Promise<Dashboard>
  updateDashboard: (id: number, updates: Partial<Dashboard>) => Promise<void>
  deleteDashboard: (id: number) => Promise<void>
  cloneDashboard: (id: number, newName?: string) => Promise<Dashboard>

  // Widget actions
  addWidget: (type: string, title?: string, config?: Record<string, unknown>) => Promise<Widget>
  updateWidgetPosition: (widgetId: number, position: WidgetPosition) => Promise<void>
  updateWidgetSize: (widgetId: number, size: WidgetSize) => Promise<void>
  updateWidgetConfig: (widgetId: number, config: Record<string, unknown>) => Promise<void>
  removeWidget: (widgetId: number) => Promise<void>

  // Edit mode
  setEditing: (editing: boolean) => void
  saveLayout: () => Promise<void>

  // Refresh
  refreshDashboards: () => void
  refreshCurrentDashboard: () => void
}

// Create context
const DashboardContext = createContext<DashboardContextValue | null>(null)

// Provider props
interface DashboardProviderProps {
  children: ReactNode
  defaultDashboardId?: number
}

// Provider component
export function DashboardProvider({ children, defaultDashboardId }: DashboardProviderProps) {
  const queryClient = useQueryClient()
  const [currentDashboardId, setCurrentDashboardId] = useState<number | null>(defaultDashboardId || null)
  const [isEditing, setIsEditing] = useState(false)
  const [localWidgets, setLocalWidgets] = useState<Widget[]>([])

  // Fetch all dashboards
  const {
    data: dashboards = [],
    isLoading: dashboardsLoading,
    error: dashboardsError,
    refetch: refetchDashboards,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: () => api.dashboards.list(true),
  })

  // Fetch current dashboard with widgets
  const {
    data: currentDashboardData,
    isLoading: currentLoading,
    error: currentError,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['dashboard', currentDashboardId],
    queryFn: () => currentDashboardId ? api.dashboards.get(currentDashboardId) : null,
    enabled: !!currentDashboardId,
  })

  // Convert dashboard data to our format
  const currentDashboard: Dashboard | null = currentDashboardData
    ? {
        ...currentDashboardData,
        is_default: false,
        is_shared: currentDashboardData.is_shared,
        created_at: new Date().toISOString(),
        widgets: currentDashboardData.widgets,
      }
    : null

  // Sync local widgets with backend data when not editing
  useEffect(() => {
    if (currentDashboard?.widgets && !isEditing) {
      setLocalWidgets(currentDashboard.widgets)
    }
  }, [currentDashboard?.widgets, isEditing])

  // Auto-select default dashboard
  useEffect(() => {
    if (!currentDashboardId && dashboards.length > 0) {
      const defaultDash = dashboards.find(d => d.is_default) || dashboards[0]
      setCurrentDashboardId(defaultDash.id)
    }
  }, [dashboards, currentDashboardId])

  // Mutations
  const createDashboardMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.dashboards.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
  })

  const updateDashboardMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Dashboard> }) => {
      // Convert null values to undefined for API compatibility
      const apiUpdates: {
        name?: string
        description?: string
        is_default?: boolean
        is_shared?: boolean
        theme?: string
        refresh_interval?: number
        layout?: Record<string, unknown>
      } = {}
      if (updates.name !== undefined) apiUpdates.name = updates.name
      if (updates.description !== undefined && updates.description !== null) apiUpdates.description = updates.description
      if (updates.is_default !== undefined) apiUpdates.is_default = updates.is_default
      if (updates.is_shared !== undefined) apiUpdates.is_shared = updates.is_shared
      if (updates.theme !== undefined) apiUpdates.theme = updates.theme
      if (updates.refresh_interval !== undefined) apiUpdates.refresh_interval = updates.refresh_interval
      if (updates.layout !== undefined && updates.layout !== null) apiUpdates.layout = updates.layout
      return api.dashboards.update(id, apiUpdates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', currentDashboardId] })
    },
  })

  const deleteDashboardMutation = useMutation({
    mutationFn: (id: number) => api.dashboards.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      if (currentDashboardId === deleteDashboardMutation.variables) {
        setCurrentDashboardId(null)
      }
    },
  })

  const cloneDashboardMutation = useMutation({
    mutationFn: ({ id, newName }: { id: number; newName?: string }) =>
      api.dashboards.clone(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
  })

  const addWidgetMutation = useMutation({
    mutationFn: (widget: {
      dashboard_id: number
      widget_type: string
      title?: string
      position_x?: number
      position_y?: number
      width?: number
      height?: number
      config?: Record<string, unknown>
      data_source?: Record<string, unknown>
    }) => api.dashboards.addWidget(widget.dashboard_id, widget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', currentDashboardId] })
    },
  })

  const updateWidgetMutation = useMutation({
    mutationFn: ({ widgetId, updates }: { widgetId: number; updates: Record<string, unknown> }) =>
      api.dashboards.updateWidget(widgetId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', currentDashboardId] })
    },
  })

  const deleteWidgetMutation = useMutation({
    mutationFn: (widgetId: number) => api.dashboards.deleteWidget(widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', currentDashboardId] })
    },
  })

  // Actions
  const selectDashboard = useCallback((id: number) => {
    setCurrentDashboardId(id)
    setIsEditing(false)
  }, [])

  const createDashboard = useCallback(async (name: string, description?: string): Promise<Dashboard> => {
    const result = await createDashboardMutation.mutateAsync({ name, description })
    return {
      ...result,
      widgets: [],
    }
  }, [createDashboardMutation])

  const updateDashboard = useCallback(async (id: number, updates: Partial<Dashboard>) => {
    await updateDashboardMutation.mutateAsync({ id, updates })
  }, [updateDashboardMutation])

  const deleteDashboard = useCallback(async (id: number) => {
    await deleteDashboardMutation.mutateAsync(id)
  }, [deleteDashboardMutation])

  const cloneDashboard = useCallback(async (id: number, newName?: string): Promise<Dashboard> => {
    const result = await cloneDashboardMutation.mutateAsync({ id, newName })
    return {
      ...result,
      widgets: [],
    }
  }, [cloneDashboardMutation])

  const addWidget = useCallback(async (
    type: string,
    title?: string,
    config?: Record<string, unknown>
  ): Promise<Widget> => {
    if (!currentDashboardId) {
      throw new Error('No dashboard selected')
    }

    // Calculate next position
    const maxY = localWidgets.reduce((max, w) => Math.max(max, w.position.y + w.size.height), 0)

    const result = await addWidgetMutation.mutateAsync({
      dashboard_id: currentDashboardId,
      widget_type: type,
      title,
      position_x: 0,
      position_y: maxY,
      width: 4,
      height: 3,
      config,
    })

    const newWidget: Widget = {
      id: result.id,
      type: result.widget_type,
      title: result.title,
      position: result.position,
      size: result.size,
      config: result.config || {},
      data_source: result.data_source || {},
    }

    setLocalWidgets(prev => [...prev, newWidget])
    return newWidget
  }, [currentDashboardId, localWidgets, addWidgetMutation])

  const updateWidgetPosition = useCallback(async (widgetId: number, position: WidgetPosition) => {
    // Update local state immediately for responsiveness
    setLocalWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, position } : w)
    )

    // Persist to backend
    await updateWidgetMutation.mutateAsync({
      widgetId,
      updates: { position_x: position.x, position_y: position.y },
    })
  }, [updateWidgetMutation])

  const updateWidgetSize = useCallback(async (widgetId: number, size: WidgetSize) => {
    setLocalWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, size } : w)
    )

    await updateWidgetMutation.mutateAsync({
      widgetId,
      updates: { width: size.width, height: size.height },
    })
  }, [updateWidgetMutation])

  const updateWidgetConfig = useCallback(async (widgetId: number, config: Record<string, unknown>) => {
    setLocalWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w)
    )

    await updateWidgetMutation.mutateAsync({
      widgetId,
      updates: { config },
    })
  }, [updateWidgetMutation])

  const removeWidget = useCallback(async (widgetId: number) => {
    setLocalWidgets(prev => prev.filter(w => w.id !== widgetId))
    await deleteWidgetMutation.mutateAsync(widgetId)
  }, [deleteWidgetMutation])

  const setEditing = useCallback((editing: boolean) => {
    setIsEditing(editing)
    if (!editing && currentDashboard?.widgets) {
      // Reset to backend state when exiting edit mode
      setLocalWidgets(currentDashboard.widgets)
    }
  }, [currentDashboard?.widgets])

  const saveLayout = useCallback(async () => {
    if (!currentDashboardId) return

    // Build layout from current widget positions
    const layout = localWidgets.reduce((acc, widget) => {
      acc[widget.id] = {
        x: widget.position.x,
        y: widget.position.y,
        w: widget.size.width,
        h: widget.size.height,
      }
      return acc
    }, {} as Record<number, { x: number; y: number; w: number; h: number }>)

    await updateDashboardMutation.mutateAsync({
      id: currentDashboardId,
      updates: { layout },
    })

    setIsEditing(false)
  }, [currentDashboardId, localWidgets, updateDashboardMutation])

  const refreshDashboards = useCallback(() => {
    refetchDashboards()
  }, [refetchDashboards])

  const refreshCurrentDashboard = useCallback(() => {
    refetchCurrent()
  }, [refetchCurrent])

  // Compute error state
  const error = dashboardsError
    ? String(dashboardsError)
    : currentError
      ? String(currentError)
      : null

  const value: DashboardContextValue = {
    dashboards: dashboards as Dashboard[],
    currentDashboard,
    widgets: localWidgets,
    isEditing,
    isLoading: dashboardsLoading || currentLoading,
    error,

    selectDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    cloneDashboard,

    addWidget,
    updateWidgetPosition,
    updateWidgetSize,
    updateWidgetConfig,
    removeWidget,

    setEditing,
    saveLayout,

    refreshDashboards,
    refreshCurrentDashboard,
  }

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}

// Hook to use dashboard context
export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

// Hook for widget-specific operations
export function useWidget(widgetId: number) {
  const { widgets, updateWidgetPosition, updateWidgetSize, updateWidgetConfig, removeWidget } = useDashboard()
  const widget = widgets.find(w => w.id === widgetId)

  return {
    widget,
    updatePosition: (position: WidgetPosition) => updateWidgetPosition(widgetId, position),
    updateSize: (size: WidgetSize) => updateWidgetSize(widgetId, size),
    updateConfig: (config: Record<string, unknown>) => updateWidgetConfig(widgetId, config),
    remove: () => removeWidget(widgetId),
  }
}

export default DashboardContext
