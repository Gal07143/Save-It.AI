/**
 * Centralized type definitions for Save-It.AI frontend.
 * All API types should be imported from './api' instead of defining inline.
 */

// Re-export all API types
export * from './api'

// =============================================================================
// Common Component Types
// =============================================================================

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface TableColumn<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface SortState {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterState {
  [key: string]: string | number | boolean | null
}

// =============================================================================
// Form Types
// =============================================================================

export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox' | 'date'
  required?: boolean
  placeholder?: string
  options?: SelectOption[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface FormErrors {
  [fieldName: string]: string | undefined
}

// =============================================================================
// UI State Types
// =============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'view' | 'delete'
  data?: unknown
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

// =============================================================================
// Navigation Types
// =============================================================================

export interface NavItem {
  path: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string | number
  children?: NavItem[]
  requiredRole?: string[]
}

export interface BreadcrumbItem {
  label: string
  path?: string
}

// =============================================================================
// Chart Types
// =============================================================================

export interface ChartDataPoint {
  timestamp: string | Date
  value: number
  label?: string
}

export interface ChartSeries {
  name: string
  data: ChartDataPoint[]
  color?: string
  type?: 'line' | 'bar' | 'area'
}

// =============================================================================
// Dashboard Widget Types
// =============================================================================

export interface WidgetConfig {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list'
  title: string
  size: 'small' | 'medium' | 'large'
  refreshInterval?: number
}

export interface MetricWidget extends WidgetConfig {
  type: 'metric'
  value: number | string
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'flat'
    period: string
  }
}

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type ValueOf<T> = T[keyof T]
