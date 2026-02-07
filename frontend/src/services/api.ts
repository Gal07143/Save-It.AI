// Re-export all types from the centralized type definitions
export * from '../types/api'

// Import types needed for API methods
import type {
  TokenResponse,
  RegisterData,
  AuthUser,
  Site,
  Asset,
  AssetTreeNode,
  Meter,
  Bill,
  BillValidationResult,
  OCRBillResult,
  GapAnalysisResult,
  SolarROIInput,
  SolarROIResult,
  BESSSimulationInput,
  BESSSimulationResult,
  PanelDiagramResult,
  Tenant,
  Invoice,
  DataSource,
  Gateway,
  GatewayRegistration,
  DeviceTemplateExtended,
  TemplateExport,
  TemplateImport,
  ModbusRegisterExtended,
  ModbusRegisterCreate,
  RegisterReadResult,
  ConnectionTestResult,
  BulkDeviceImportRequest,
  BulkDeviceImportResponse,
  DeviceHealthDashboard,
  Notification,
  Tariff,
  CarbonEmission,
  CarbonSummary,
  DataQualityDashboard,
  QualityIssue,
  VirtualMeter,
  MaintenanceAlert,
  AssetCondition,
  AgentChatResponse,
  ForecastResponse,
  BESSVendor,
  BESSModel,
  BESSDataset,
  BESSRecommendationRequest,
  BESSRecommendation,
  PVModule,
  PVAssessment,
  PVAssessmentCreate,
  PVSurface,
  PVSurfaceCreate,
  PVDesignScenario,
  PVDesignRequest,
  ValidationRule,
  ValidationViolation,
  DeviceGroup,
  DeviceGroupMember,
  RetryQueueItem,
  RetryStatus,
  RetryConfig,
  ConnectionAttemptResult,
  FirmwareInfo,
  FirmwareUpdate,
  FirmwareSummary,
  QRCodeData,
  QRCodeBatchItem,
  CloneResult,
  DiscoveryResult,
  CommissioningStatus,
  MaintenanceScheduleItem,
  MaintenanceScheduleCreate,
  DeviceAlertItem,
  DeviceAlertCreate,
} from '../types/api'

// Type aliases for backward compatibility
export type DeviceTemplate = DeviceTemplateExtended
export type ModbusRegister = ModbusRegisterExtended

const API_BASE = '/api/v1'

/**
 * Get CSRF token from cookie for double-submit pattern.
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  return match ? match[1] : null
}

/**
 * Check if the request method requires CSRF protection.
 */
function requiresCsrf(method?: string): boolean {
  const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
  return protectedMethods.includes((method || 'GET').toUpperCase())
}

/**
 * Ensure a CSRF cookie exists. If not, fetch one from the server.
 * Prevents "Missing CSRF token cookie" errors after login or cookie expiry.
 */
let csrfEnsurePromise: Promise<void> | null = null
async function ensureCsrfCookie(): Promise<void> {
  if (getCsrfToken()) return
  if (csrfEnsurePromise) return csrfEnsurePromise
  csrfEnsurePromise = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
    .then(() => { csrfEnsurePromise = null })
    .catch(() => { csrfEnsurePromise = null })
  return csrfEnsurePromise
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options?.headers,
  }

  // Ensure CSRF cookie exists before making state-changing requests
  if (requiresCsrf(options?.method)) {
    await ensureCsrfCookie()
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      ;(headers as Record<string, string>)['X-CSRF-Token'] = csrfToken
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',  // Include HttpOnly cookies
    headers,
    ...options,
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login on authentication failure
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }))
    throw new Error(error.detail || 'An error occurred')
  }

  return response.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchApi<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),
    register: (data: RegisterData) =>
      fetchApi<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    me: () => fetchApi<AuthUser>('/auth/me'),
  },
  sites: {
    list: () => fetchApi<Site[]>('/sites'),
    get: (id: number) => fetchApi<Site>(`/sites/${id}`),
    create: (data: Partial<Site>) => fetchApi<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Site>) => fetchApi<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/sites/${id}`, { method: 'DELETE' }),
    getStats: (id: number) => fetchApi<{
      site_id: number
      meters_count: number
      assets_count: number
      total_load_kw: number
      active_alarms: number
    }>(`/sites/${id}/stats`),
  },
  assets: {
    list: (siteId?: number) => fetchApi<Asset[]>(`/assets${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Asset>(`/assets/${id}`),
    tree: (siteId: number) => fetchApi<AssetTreeNode[]>(`/assets/tree/${siteId}`),
    create: (data: Partial<Asset>) => fetchApi<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Asset>) => fetchApi<Asset>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/assets/${id}`, { method: 'DELETE' }),
  },
  meters: {
    list: (siteId?: number) => fetchApi<Meter[]>(`/meters${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Meter>(`/meters/${id}`),
    create: (data: Partial<Meter>) => fetchApi<Meter>('/meters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Meter>) => fetchApi<Meter>(`/meters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/meters/${id}`, { method: 'DELETE' }),
  },
  bills: {
    list: (siteId?: number) => fetchApi<Bill[]>(`/bills${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Bill>(`/bills/${id}`),
    validate: (id: number) => fetchApi<BillValidationResult>(`/bills/${id}/validate`, { method: 'POST' }),
    create: (data: Partial<Bill>) => fetchApi<Bill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Bill>) => fetchApi<Bill>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/bills/${id}`, { method: 'DELETE' }),
    ocrScan: async (file: File): Promise<OCRBillResult> => {
      const formData = new FormData()
      formData.append('file', file)

      const headers: HeadersInit = {}
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await fetch(`${API_BASE}/bills/ocr-scan`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'OCR scan failed' }))
        throw new Error(error.detail || 'OCR scan failed')
      }

      return response.json()
    },
  },
  analysis: {
    gapAnalysis: (siteId: number) => fetchApi<GapAnalysisResult>(`/analysis/gap-analysis/${siteId}`),
    solarRoi: (data: SolarROIInput) => fetchApi<SolarROIResult>('/analysis/solar-roi', { method: 'POST', body: JSON.stringify(data) }),
    bessSimulation: (data: BESSSimulationInput) => fetchApi<BESSSimulationResult>('/analysis/bess-simulation', { method: 'POST', body: JSON.stringify(data) }),
    analyzePanelDiagram: async (file: File): Promise<PanelDiagramResult> => {
      const formData = new FormData()
      formData.append('file', file)

      const headers: HeadersInit = {}
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await fetch(`${API_BASE}/analysis/panel-diagram`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Analysis failed' }))
        throw new Error(error.detail || 'Analysis failed')
      }

      return response.json()
    },
  },
  tenants: {
    list: (siteId?: number) => fetchApi<Tenant[]>(`/tenants${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Tenant>(`/tenants/${id}`),
    create: (data: Partial<Tenant>) => fetchApi<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Tenant>) => fetchApi<Tenant>(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/tenants/${id}`, { method: 'DELETE' }),
    generateInvoice: (tenantId: number, start: string, end: string) =>
      fetchApi<Invoice>(`/tenants/${tenantId}/generate-invoice?billing_start=${start}&billing_end=${end}`, { method: 'POST' }),
  },
  invoices: {
    list: (tenantId?: number) => fetchApi<Invoice[]>(`/invoices${tenantId ? `?tenant_id=${tenantId}` : ''}`),
    get: (id: number) => fetchApi<Invoice>(`/invoices/${id}`),
  },
  leaseContracts: {
    list: () => fetchApi<any[]>('/lease-contracts'),
  },
  dataIngestion: {
    parse: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return fetchApi<any>('/data-ingestion/parse', { method: 'POST', body: formData })
    },
    import: (file: File, mappings: any[]) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mappings', JSON.stringify(mappings))
      return fetchApi<any>('/data-ingestion/import', { method: 'POST', body: formData })
    },
  },
  dataSources: {
    list: (siteId?: number) => fetchApi<DataSource[]>(`/data-sources${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<DataSource>(`/data-sources/${id}`),
    create: (data: Partial<DataSource>) => fetchApi<DataSource>('/data-sources', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<DataSource>) => fetchApi<DataSource>(`/data-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/data-sources/${id}`, { method: 'DELETE' }),
    clone: (id: number) => fetchApi<DataSource>(`/data-sources/${id}/clone`, { method: 'POST' }),
    testConnection: (data: { host: string; port: number; slave_id: number }) =>
      fetchApi<{ success: boolean; error?: string }>('/modbus-registers/test-connection', { method: 'POST', body: JSON.stringify(data) }),
    bulkImport: (data: BulkDeviceImportRequest) =>
      fetchApi<BulkDeviceImportResponse>('/data-sources/bulk-import', { method: 'POST', body: JSON.stringify(data) }),
    bulkImportCSV: async (siteId: number, file: File): Promise<BulkDeviceImportResponse> => {
      const formData = new FormData()
      formData.append('file', file)

      const headers: HeadersInit = {}
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await fetch(`${API_BASE}/data-sources/bulk-import/csv?site_id=${siteId}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Import failed' }))
        throw new Error(error.detail || 'Import failed')
      }

      return response.json()
    },
    healthDashboard: (siteId?: number) =>
      fetchApi<DeviceHealthDashboard>(`/data-sources/health/dashboard${siteId ? `?site_id=${siteId}` : ''}`),
  },
  gateways: {
    list: (siteId?: number) => fetchApi<Gateway[]>(`/gateways${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Gateway>(`/gateways/${id}`),
    create: (data: Partial<Gateway>) => fetchApi<Gateway>('/gateways', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Gateway>) => fetchApi<Gateway>(`/gateways/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/gateways/${id}`, { method: 'DELETE' }),
    register: (id: number) => fetchApi<GatewayRegistration>(`/gateways/${id}/register`, { method: 'POST' }),
    rotateCredentials: (id: number) => fetchApi<GatewayRegistration>(`/gateways/${id}/rotate-credentials`, { method: 'POST' }),
    getCredentials: (id: number) => fetchApi<GatewayRegistration>(`/gateways/${id}/credentials`),
  },
  deviceTemplates: {
    list: () => fetchApi<DeviceTemplate[]>('/device-templates'),
    get: (id: number) => fetchApi<DeviceTemplate>(`/device-templates/${id}`),
    create: (data: Partial<DeviceTemplate>) =>
      fetchApi<DeviceTemplate>('/device-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<DeviceTemplate>) =>
      fetchApi<DeviceTemplate>(`/device-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/device-templates/${id}`, { method: 'DELETE' }),
    apply: (data: { template_id: number; data_source_id: number; meter_id?: number | null }) =>
      fetchApi<{ registers_created: number }>('/device-templates/apply', { method: 'POST', body: JSON.stringify(data) }),
    seed: () => fetchApi<{ seeded: number }>('/device-templates/seed', { method: 'POST' }),
    exportTemplate: (id: number) => fetchApi<TemplateExport>(`/device-templates/${id}/export`),
    importTemplate: (data: TemplateImport) =>
      fetchApi<DeviceTemplate>('/device-templates/import', { method: 'POST', body: JSON.stringify(data) }),
  },
  modbusRegisters: {
    list: (dataSourceId: number) => fetchApi<ModbusRegister[]>(`/modbus-registers?data_source_id=${dataSourceId}`),
    get: (id: number) => fetchApi<ModbusRegister>(`/modbus-registers/${id}`),
    create: (data: ModbusRegisterCreate) => fetchApi<ModbusRegister>('/modbus-registers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ModbusRegisterCreate>) => fetchApi<ModbusRegister>(`/modbus-registers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/modbus-registers/${id}`, { method: 'DELETE' }),
    read: (dataSourceId: number, registerIds?: number[]) => fetchApi<RegisterReadResult[]>('/modbus-registers/read', {
      method: 'POST',
      body: JSON.stringify({ data_source_id: dataSourceId, register_ids: registerIds })
    }),
    testConnection: (data: { host: string; port: number; slave_id: number; timeout_seconds?: number }) =>
      fetchApi<ConnectionTestResult>('/modbus-registers/test-connection', { method: 'POST', body: JSON.stringify(data) }),
  },
  validationRules: {
    list: (siteId?: number, dataSourceId?: number) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (dataSourceId) params.append('data_source_id', String(dataSourceId))
      const query = params.toString()
      return fetchApi<ValidationRule[]>(`/data-sources/validation-rules${query ? `?${query}` : ''}`)
    },
    get: (id: number) => fetchApi<ValidationRule>(`/data-sources/validation-rules/${id}`),
    create: (data: Partial<ValidationRule>) => fetchApi<ValidationRule>('/data-sources/validation-rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ValidationRule>) => fetchApi<ValidationRule>(`/data-sources/validation-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/data-sources/validation-rules/${id}`, { method: 'DELETE' }),
  },
  validationViolations: {
    list: (siteId?: number, ruleId?: number, isAcknowledged?: boolean, limit?: number) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (ruleId) params.append('rule_id', String(ruleId))
      if (isAcknowledged !== undefined) params.append('is_acknowledged', String(isAcknowledged))
      if (limit) params.append('limit', String(limit))
      const query = params.toString()
      return fetchApi<ValidationViolation[]>(`/data-sources/validation-violations${query ? `?${query}` : ''}`)
    },
    acknowledge: (id: number) => fetchApi<{ success: boolean }>(`/data-sources/validation-violations/${id}/acknowledge`, { method: 'POST' }),
  },
  deviceGroups: {
    list: (siteId?: number) => fetchApi<DeviceGroup[]>(`/data-sources/device-groups${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<DeviceGroup>(`/data-sources/device-groups/${id}`),
    create: (data: Partial<DeviceGroup>) => fetchApi<DeviceGroup>('/data-sources/device-groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<DeviceGroup>) => fetchApi<DeviceGroup>(`/data-sources/device-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/data-sources/device-groups/${id}`, { method: 'DELETE' }),
    addMember: (groupId: number, dataSourceId: number) => fetchApi<DeviceGroupMember>(`/data-sources/device-groups/${groupId}/members?data_source_id=${dataSourceId}`, { method: 'POST' }),
    listMembers: (groupId: number) => fetchApi<DeviceGroupMember[]>(`/data-sources/device-groups/${groupId}/members`),
    removeMember: (groupId: number, dataSourceId: number) => fetchApi<void>(`/data-sources/device-groups/${groupId}/members/${dataSourceId}`, { method: 'DELETE' }),
  },
  retryLogic: {
    getQueue: (siteId?: number) => fetchApi<RetryQueueItem[]>(`/data-sources/retry-queue${siteId ? `?site_id=${siteId}` : ''}`),
    getStatus: (sourceId: number) => fetchApi<RetryStatus>(`/data-sources/${sourceId}/retry-status`),
    updateConfig: (sourceId: number, config: RetryConfig) => fetchApi<{ success: boolean }>(`/data-sources/${sourceId}/retry-config`, { method: 'PUT', body: JSON.stringify(config) }),
    simulateFailure: (sourceId: number, errorMessage?: string) => fetchApi<ConnectionAttemptResult>(`/data-sources/${sourceId}/simulate-failure${errorMessage ? `?error_message=${encodeURIComponent(errorMessage)}` : ''}`, { method: 'POST' }),
    simulateSuccess: (sourceId: number) => fetchApi<ConnectionAttemptResult>(`/data-sources/${sourceId}/simulate-success`, { method: 'POST' }),
    resetRetry: (sourceId: number) => fetchApi<{ success: boolean }>(`/data-sources/${sourceId}/reset-retry`, { method: 'POST' }),
    forceRetry: (sourceId: number) => fetchApi<ConnectionAttemptResult>(`/data-sources/${sourceId}/force-retry`, { method: 'POST' }),
  },
  firmware: {
    list: (siteId?: number, hasFirmware?: boolean) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (hasFirmware !== undefined) params.append('has_firmware', String(hasFirmware))
      const query = params.toString()
      return fetchApi<FirmwareInfo[]>(`/data-sources/firmware${query ? `?${query}` : ''}`)
    },
    summary: (siteId?: number) => fetchApi<FirmwareSummary>(`/data-sources/firmware/summary${siteId ? `?site_id=${siteId}` : ''}`),
    get: (sourceId: number) => fetchApi<FirmwareInfo>(`/data-sources/${sourceId}/firmware`),
    update: (sourceId: number, data: FirmwareUpdate) => fetchApi<{ success: boolean }>(`/data-sources/${sourceId}/firmware`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  qrCodes: {
    get: (sourceId: number) => fetchApi<QRCodeData>(`/data-sources/${sourceId}/qr-data`),
    batch: (siteId?: number, sourceIds?: number[]) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (sourceIds && sourceIds.length) params.append('source_ids', sourceIds.join(','))
      const query = params.toString()
      return fetchApi<QRCodeBatchItem[]>(`/data-sources/qr-batch${query ? `?${query}` : ''}`)
    },
  },
  deviceClone: {
    clone: (sourceId: number, newName: string, newHost?: string, newSlaveId?: number) => {
      const params = new URLSearchParams()
      params.append('new_name', newName)
      if (newHost) params.append('new_host', newHost)
      if (newSlaveId) params.append('new_slave_id', String(newSlaveId))
      return fetchApi<CloneResult>(`/data-sources/${sourceId}/clone?${params.toString()}`, { method: 'POST' })
    },
  },
  deviceDiscovery: {
    scan: (startIp: string, endIp: string, port: number = 502, timeout: number = 0.5) => {
      const params = new URLSearchParams()
      params.append('start_ip', startIp)
      params.append('end_ip', endIp)
      params.append('port', String(port))
      params.append('timeout', String(timeout))
      return fetchApi<DiscoveryResult>(`/data-sources/discover?${params.toString()}`, { method: 'POST' })
    },
  },
  commissioning: {
    getStatus: (sourceId: number) => fetchApi<CommissioningStatus>(`/data-sources/${sourceId}/commissioning`),
    complete: (sourceId: number) => fetchApi<{ success: boolean; message: string }>(`/data-sources/${sourceId}/commission`, { method: 'POST' }),
  },
  maintenance: {
    list: (siteId?: number, status?: string) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (status) params.append('status', status)
      return fetchApi<MaintenanceScheduleItem[]>(`/data-sources/maintenance${params.toString() ? `?${params}` : ''}`)
    },
    create: (data: MaintenanceScheduleCreate) => {
      const params = new URLSearchParams()
      params.append('data_source_id', String(data.data_source_id))
      params.append('title', data.title)
      params.append('scheduled_date', data.scheduled_date)
      if (data.description) params.append('description', data.description)
      if (data.maintenance_type) params.append('maintenance_type', data.maintenance_type)
      if (data.priority) params.append('priority', data.priority)
      if (data.assigned_to) params.append('assigned_to', data.assigned_to)
      return fetchApi<{ success: boolean; id: number }>(`/data-sources/maintenance?${params}`, { method: 'POST' })
    },
    update: (id: number, data: { status?: string; notes?: string }) => {
      const params = new URLSearchParams()
      if (data.status) params.append('status', data.status)
      if (data.notes) params.append('notes', data.notes)
      return fetchApi<{ success: boolean }>(`/data-sources/maintenance/${id}?${params}`, { method: 'PUT' })
    },
    delete: (id: number) => fetchApi<{ success: boolean }>(`/data-sources/maintenance/${id}`, { method: 'DELETE' }),
  },
  deviceAlerts: {
    list: (siteId?: number, dataSourceId?: number) => {
      const params = new URLSearchParams()
      if (siteId) params.append('site_id', String(siteId))
      if (dataSourceId) params.append('data_source_id', String(dataSourceId))
      return fetchApi<DeviceAlertItem[]>(`/data-sources/alerts${params.toString() ? `?${params}` : ''}`)
    },
    create: (data: DeviceAlertCreate) => {
      const params = new URLSearchParams()
      params.append('data_source_id', String(data.data_source_id))
      params.append('name', data.name)
      params.append('alert_type', data.alert_type)
      params.append('condition', data.condition)
      if (data.threshold_value !== undefined) params.append('threshold_value', String(data.threshold_value))
      if (data.threshold_duration_seconds) params.append('threshold_duration_seconds', String(data.threshold_duration_seconds))
      if (data.severity) params.append('severity', data.severity)
      return fetchApi<{ success: boolean; id: number }>(`/data-sources/alerts?${params}`, { method: 'POST' })
    },
    update: (id: number, data: { is_active?: number; threshold_value?: number; severity?: string }) => {
      const params = new URLSearchParams()
      if (data.is_active !== undefined) params.append('is_active', String(data.is_active))
      if (data.threshold_value !== undefined) params.append('threshold_value', String(data.threshold_value))
      if (data.severity) params.append('severity', data.severity)
      return fetchApi<{ success: boolean }>(`/data-sources/alerts/${id}?${params}`, { method: 'PUT' })
    },
    delete: (id: number) => fetchApi<{ success: boolean }>(`/data-sources/alerts/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: (siteId?: number, unreadOnly?: boolean) =>
      fetchApi<Notification[]>(`/notifications?${siteId ? `site_id=${siteId}&` : ''}${unreadOnly ? 'unread_only=true' : ''}`),
    markRead: (id: number) => fetchApi<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
    resolve: (id: number) => fetchApi<Notification>(`/notifications/${id}/resolve`, { method: 'POST' }),
  },
  tariffs: {
    list: (siteId?: number) => fetchApi<Tariff[]>(`/tariffs${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Tariff>(`/tariffs/${id}`),
    create: (data: Partial<Tariff>) => fetchApi<Tariff>('/tariffs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Tariff>) => fetchApi<Tariff>(`/tariffs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<void>(`/tariffs/${id}`, { method: 'DELETE' }),
  },
  carbonEmissions: {
    list: (siteId?: number, year?: number) =>
      fetchApi<CarbonEmission[]>(`/carbon-emissions?${siteId ? `site_id=${siteId}&` : ''}${year ? `year=${year}` : ''}`),
    summary: (siteId?: number, year?: number) =>
      fetchApi<CarbonSummary>(`/carbon-emissions/summary?${siteId ? `site_id=${siteId}&` : ''}${year ? `year=${year}` : ''}`),
    create: (data: Partial<CarbonEmission>) => fetchApi<CarbonEmission>('/carbon-emissions', { method: 'POST', body: JSON.stringify(data) }),
  },
  exports: {
    sitesUrl: () => `${API_BASE}/export/sites`,
    metersUrl: (siteId?: number) => `${API_BASE}/export/meters${siteId ? `?site_id=${siteId}` : ''}`,
    billsUrl: (siteId?: number) => `${API_BASE}/export/bills${siteId ? `?site_id=${siteId}` : ''}`,
  },
  reports: {
    siteSummaryUrl: (siteId: number) => `${API_BASE}/reports/site-summary/${siteId}`,
    energyAnalysisUrl: (siteId: number) => `${API_BASE}/reports/energy-analysis/${siteId}`,
  },
  dataQuality: {
    dashboard: () => fetchApi<DataQualityDashboard>('/data-quality/dashboard'),
    issues: (siteId?: number) => fetchApi<QualityIssue[]>(`/data-quality/issues${siteId ? `?site_id=${siteId}` : ''}`),
    resolveIssue: (issueId: number, resolution: string) =>
      fetchApi<QualityIssue>(`/data-quality/issues/${issueId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution })
      }),
  },
  virtualMeters: {
    list: (siteId?: number) => fetchApi<VirtualMeter[]>(`/virtual-meters${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<VirtualMeter>(`/virtual-meters/${id}`),
    create: (data: Partial<VirtualMeter>) => fetchApi<VirtualMeter>('/virtual-meters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<VirtualMeter>) => fetchApi<VirtualMeter>(`/virtual-meters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/virtual-meters/${id}`, { method: 'DELETE' }),
  },
  assetMaintenance: {
    alerts: (siteId?: number) => fetchApi<MaintenanceAlert[]>(`/maintenance/alerts${siteId ? `?site_id=${siteId}` : ''}`),
    acknowledge: (alertId: number) => fetchApi<MaintenanceAlert>(`/maintenance/alerts/${alertId}/acknowledge`, { method: 'POST' }),
    assetConditions: (assetId?: number) => fetchApi<AssetCondition[]>(`/maintenance/asset-conditions${assetId ? `?asset_id=${assetId}` : ''}`),
  },
  agents: {
    chat: (siteId: number, agentType: string, message: string) =>
      fetchApi<AgentChatResponse>('/agents/chat', {
        method: 'POST',
        body: JSON.stringify({ site_id: siteId, agent_type: agentType, message })
      }),
  },
  forecasts: {
    create: (siteId: number, forecastType: string, horizonHours: number) =>
      fetchApi<ForecastResponse>('/forecasts', {
        method: 'POST',
        body: JSON.stringify({ site_id: siteId, forecast_type: forecastType, horizon_hours: horizonHours })
      }),
    get: (jobId: number) => fetchApi<ForecastResponse>(`/forecasts/${jobId}`),
  },
  bessVendors: {
    list: () => fetchApi<BESSVendor[]>('/bess/vendors'),
    get: (id: number) => fetchApi<BESSVendor>(`/bess/vendors/${id}`),
  },
  bessModels: {
    list: (filters?: { vendorId?: number; chemistry?: string; minCapacity?: number; maxCapacity?: number }) => {
      const params = new URLSearchParams()
      if (filters?.vendorId) params.append('vendor_id', String(filters.vendorId))
      if (filters?.chemistry) params.append('chemistry', filters.chemistry)
      if (filters?.minCapacity) params.append('min_capacity_kwh', String(filters.minCapacity))
      if (filters?.maxCapacity) params.append('max_capacity_kwh', String(filters.maxCapacity))
      const query = params.toString()
      return fetchApi<BESSModel[]>(`/bess/models${query ? `?${query}` : ''}`)
    },
    get: (id: number) => fetchApi<BESSModel>(`/bess/models/${id}`),
  },
  bessDatasets: {
    list: (siteId?: number) => fetchApi<BESSDataset[]>(`/bess/datasets${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<BESSDataset>(`/bess/datasets/${id}`),
    create: (data: Partial<BESSDataset>) => fetchApi<BESSDataset>('/bess/datasets', { method: 'POST', body: JSON.stringify(data) }),
    uploadCsv: async (datasetId: number, file: File, options?: { timestampColumn?: string; demandColumn?: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      if (options?.timestampColumn) formData.append('timestamp_column', options.timestampColumn)
      if (options?.demandColumn) formData.append('demand_column', options.demandColumn)

      const headers: HeadersInit = {}
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await fetch(`${API_BASE}/bess/datasets/${datasetId}/upload-csv`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(error.detail || 'Upload failed')
      }
      return response.json()
    },
  },
  bessRecommendations: {
    get: (data: BESSRecommendationRequest) =>
      fetchApi<BESSRecommendation[]>('/bess/recommendations', { method: 'POST', body: JSON.stringify(data) }),
  },
  pvModules: {
    list: (filters?: { manufacturer?: string; minPower?: number; maxPower?: number }) => {
      const params = new URLSearchParams()
      if (filters?.manufacturer) params.append('manufacturer', filters.manufacturer)
      if (filters?.minPower) params.append('min_power_w', String(filters.minPower))
      if (filters?.maxPower) params.append('max_power_w', String(filters.maxPower))
      const query = params.toString()
      return fetchApi<PVModule[]>(`/pv/modules${query ? `?${query}` : ''}`)
    },
  },
  pvAssessments: {
    list: (siteId?: number) => fetchApi<PVAssessment[]>(`/pv/assessments${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<PVAssessment>(`/pv/assessments/${id}`),
    create: (data: PVAssessmentCreate) => fetchApi<PVAssessment>('/pv/assessments', { method: 'POST', body: JSON.stringify(data) }),
    addSurface: (assessmentId: number, data: PVSurfaceCreate) =>
      fetchApi<PVSurface>(`/pv/assessments/${assessmentId}/surfaces`, { method: 'POST', body: JSON.stringify(data) }),
    getScenarios: (assessmentId: number) => fetchApi<PVDesignScenario[]>(`/pv/assessments/${assessmentId}/scenarios`),
  },
  pvDesign: {
    calculate: (data: PVDesignRequest) => fetchApi<PVDesignScenario>('/pv/design', { method: 'POST', body: JSON.stringify(data) }),
  },
  telemetry: {
    getLatest: (deviceId: number) => fetchApi<{
      device_id: number
      datapoints: Record<string, { value: number | null; timestamp: string | null; quality: string }>
    }>(`/telemetry/devices/${deviceId}/latest`),
    getHistory: (deviceId: number, params: {
      datapoint: string
      start?: string
      end?: string
      aggregation?: string
      interval?: string
      limit?: number
      offset?: number
    }) => {
      const searchParams = new URLSearchParams()
      searchParams.append('datapoint', params.datapoint)
      if (params.start) searchParams.append('start', params.start)
      if (params.end) searchParams.append('end', params.end)
      if (params.limit) searchParams.append('limit', String(params.limit))
      if (params.offset) searchParams.append('offset', String(params.offset))
      return fetchApi<Array<{ timestamp: string; value: number; quality: string; raw_value?: number }>>(
        `/telemetry/devices/${deviceId}/history?${searchParams.toString()}`
      )
    },
    getAggregated: (deviceId: number, params: {
      datapoints?: string
      start?: string
      end?: string
      aggregation?: string
      interval?: string
      limit?: number
    }) => {
      const searchParams = new URLSearchParams()
      if (params.datapoints) searchParams.append('datapoints', params.datapoints)
      if (params.start) searchParams.append('start', params.start)
      if (params.end) searchParams.append('end', params.end)
      if (params.aggregation) searchParams.append('aggregation', params.aggregation)
      if (params.interval) searchParams.append('interval', params.interval)
      if (params.limit) searchParams.append('limit', String(params.limit))
      return fetchApi<unknown>(`/telemetry/devices/${deviceId}?${searchParams.toString()}`)
    },
    getStats: (deviceId: number, params: {
      datapoint: string
      start: string
      end: string
    }) => fetchApi<{
      device_id: number
      datapoint: string
      start: string
      end: string
      min: number | null
      max: number | null
      avg: number | null
      sum: number | null
      count: number
      first: number | null
      last: number | null
      first_timestamp: string | null
      last_timestamp: string | null
    }>(`/telemetry/devices/${deviceId}/stats?datapoint=${params.datapoint}&start=${params.start}&end=${params.end}`),
    ingest: (data: { device_id: number; datapoints: Record<string, unknown>; timestamp?: string; source?: string }) =>
      fetchApi<{ status: string; datapoints_stored: number }>('/telemetry', { method: 'POST', body: JSON.stringify(data) }),
  },
  admin: {
    organizations: () => fetchApi<any[]>('/admin/organizations'),
    users: () => fetchApi<any[]>('/admin/users'),
    auditLogs: (limit?: number) => fetchApi<any[]>(`/admin/audit-logs${limit ? `?limit=${limit}` : ''}`),
    resetDemoData: () => fetchApi<{ success: boolean; message: string; deleted_counts?: Record<string, number> }>('/admin/reset-demo', { method: 'POST' }),
  },
  recommendations: {
    list: () => fetchApi<any[]>('/recommendations'),
  },
  dashboards: {
    list: (includeShared?: boolean) =>
      fetchApi<Array<{
        id: number
        name: string
        description: string | null
        is_default: boolean
        is_shared: boolean
        theme: string
        refresh_interval: number
        created_at: string
      }>>(`/dashboards${includeShared !== undefined ? `?include_shared=${includeShared}` : ''}`),
    get: (id: number) =>
      fetchApi<{
        id: number
        name: string
        description: string | null
        layout: Record<string, unknown> | null
        theme: string
        refresh_interval: number
        is_shared: boolean
        widgets: Array<{
          id: number
          type: string
          title: string | null
          position: { x: number; y: number }
          size: { width: number; height: number }
          config: Record<string, unknown>
          data_source: Record<string, unknown>
        }>
      }>(`/dashboards/${id}`),
    create: (data: {
      name: string
      description?: string
      is_default?: boolean
      theme?: string
      refresh_interval?: number
    }) => fetchApi<{
      id: number
      name: string
      description: string | null
      is_default: boolean
      is_shared: boolean
      theme: string
      refresh_interval: number
      created_at: string
    }>('/dashboards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: {
      name?: string
      description?: string
      is_default?: boolean
      is_shared?: boolean
      theme?: string
      refresh_interval?: number
      layout?: Record<string, unknown>
    }) => fetchApi<{
      id: number
      name: string
      description: string | null
      is_default: boolean
      is_shared: boolean
      theme: string
      refresh_interval: number
      created_at: string
    }>(`/dashboards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi<{ message: string }>(`/dashboards/${id}`, { method: 'DELETE' }),
    clone: (id: number, newName?: string) =>
      fetchApi<{
        id: number
        name: string
        description: string | null
        is_default: boolean
        is_shared: boolean
        theme: string
        refresh_interval: number
        created_at: string
      }>(`/dashboards/${id}/clone${newName ? `?new_name=${encodeURIComponent(newName)}` : ''}`, { method: 'POST' }),
    addWidget: (dashboardId: number, widget: {
      widget_type: string
      title?: string
      position_x?: number
      position_y?: number
      width?: number
      height?: number
      config?: Record<string, unknown>
      data_source?: Record<string, unknown>
    }) => fetchApi<{
      id: number
      dashboard_id: number
      widget_type: string
      title: string | null
      position: { x: number; y: number }
      size: { width: number; height: number }
      config: Record<string, unknown> | null
      data_source: Record<string, unknown> | null
    }>(`/dashboards/${dashboardId}/widgets`, { method: 'POST', body: JSON.stringify(widget) }),
    updateWidget: (widgetId: number, updates: {
      title?: string
      position_x?: number
      position_y?: number
      width?: number
      height?: number
      config?: Record<string, unknown>
      data_source?: Record<string, unknown>
    }) => fetchApi<{
      id: number
      dashboard_id: number
      widget_type: string
      title: string | null
      position: { x: number; y: number }
      size: { width: number; height: number }
      config: Record<string, unknown> | null
      data_source: Record<string, unknown> | null
    }>(`/dashboards/widgets/${widgetId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    deleteWidget: (widgetId: number) => fetchApi<{ message: string }>(`/dashboards/widgets/${widgetId}`, { method: 'DELETE' }),
    getWidgetData: (widgetId: number) => fetchApi<{
      widget_id: number
      widget_type: string
      title: string | null
      data: Record<string, unknown> | null
      last_updated: string
      error: string | null
    }>(`/dashboards/widgets/${widgetId}/data`),
  },
}
