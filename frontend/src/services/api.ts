import { getAuthToken } from '../contexts/AuthContext'

const API_BASE = '/api/v1'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...options,
  })
  
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('auth_token')
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
  },
  assets: {
    list: (siteId?: number) => fetchApi<Asset[]>(`/assets${siteId ? `?site_id=${siteId}` : ''}`),
    tree: (siteId: number) => fetchApi<AssetTreeNode[]>(`/assets/tree/${siteId}`),
    getTree: (siteId: number) => fetchApi<AssetTreeNode[]>(`/assets/tree/${siteId}`),
    create: (data: Partial<Asset>) => fetchApi<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Asset>) => fetchApi<Asset>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  meters: {
    list: (siteId?: number) => fetchApi<Meter[]>(`/meters${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Meter>(`/meters/${id}`),
    create: (data: Partial<Meter>) => fetchApi<Meter>('/meters', { method: 'POST', body: JSON.stringify(data) }),
  },
  bills: {
    list: (siteId?: number) => fetchApi<Bill[]>(`/bills${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<Bill>(`/bills/${id}`),
    validate: (id: number) => fetchApi<BillValidationResult>(`/bills/${id}/validate`, { method: 'POST' }),
    create: (data: Partial<Bill>) => fetchApi<Bill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    ocrScan: async (file: File): Promise<OCRBillResult> => {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${API_BASE}/bills/ocr-scan`, {
        method: 'POST',
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
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${API_BASE}/analysis/panel-diagram`, {
        method: 'POST',
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
    generateInvoice: (tenantId: number, start: string, end: string) => 
      fetchApi<Invoice>(`/tenants/${tenantId}/generate-invoice?billing_start=${start}&billing_end=${end}`, { method: 'POST' }),
  },
  invoices: {
    list: (tenantId?: number) => fetchApi<Invoice[]>(`/invoices${tenantId ? `?tenant_id=${tenantId}` : ''}`),
    get: (id: number) => fetchApi<Invoice>(`/invoices/${id}`),
  },
  dataSources: {
    list: (siteId?: number) => fetchApi<DataSource[]>(`/data-sources${siteId ? `?site_id=${siteId}` : ''}`),
    get: (id: number) => fetchApi<DataSource>(`/data-sources/${id}`),
    create: (data: Partial<DataSource>) => fetchApi<DataSource>('/data-sources', { method: 'POST', body: JSON.stringify(data) }),
    testConnection: (data: { host: string; port: number; slave_id: number }) => 
      fetchApi<{ success: boolean; error?: string }>('/modbus-registers/test-connection', { method: 'POST', body: JSON.stringify(data) }),
    bulkImport: (data: BulkDeviceImportRequest) => 
      fetchApi<BulkDeviceImportResponse>('/data-sources/bulk-import', { method: 'POST', body: JSON.stringify(data) }),
    bulkImportCSV: async (siteId: number, file: File): Promise<BulkDeviceImportResponse> => {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${API_BASE}/data-sources/bulk-import/csv?site_id=${siteId}`, {
        method: 'POST',
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
  },
  deviceTemplates: {
    list: () => fetchApi<DeviceTemplate[]>('/device-templates'),
    get: (id: number) => fetchApi<DeviceTemplate>(`/device-templates/${id}`),
    apply: (data: { template_id: number; data_source_id: number; meter_id?: number | null }) => 
      fetchApi<{ registers_created: number }>('/device-templates/apply', { method: 'POST', body: JSON.stringify(data) }),
    seed: () => fetchApi<{ seeded: number }>('/device-templates/seed', { method: 'POST' }),
    exportTemplate: (id: number) => fetchApi<{ template: DeviceTemplate; registers: any[] }>(`/device-templates/${id}/export`),
    importTemplate: (data: { template: Partial<DeviceTemplate>; registers: any[] }) => 
      fetchApi<DeviceTemplate>('/device-templates/import', { method: 'POST', body: JSON.stringify(data) }),
  },
  modbusRegisters: {
    list: (dataSourceId: number) => fetchApi<ModbusRegister[]>(`/modbus-registers?data_source_id=${dataSourceId}`),
    read: (dataSourceId: number) => fetchApi<any>('/modbus-registers/read', { method: 'POST', body: JSON.stringify({ data_source_id: dataSourceId }) }),
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
  },
  maintenance: {
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
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file)
      if (options?.timestampColumn) formData.append('timestamp_column', options.timestampColumn)
      if (options?.demandColumn) formData.append('demand_column', options.demandColumn)
      
      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      
      const response = await fetch(`${API_BASE}/bess/datasets/${datasetId}/upload-csv`, {
        method: 'POST',
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
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export interface RegisterData {
  email: string
  password: string
  first_name?: string
  last_name?: string
  organization_name?: string
}

export interface AuthUser {
  id: number
  email: string
  first_name?: string
  last_name?: string
  role: string
  organization_id: number
  organization_name?: string
  is_active: boolean
}

export interface Site {
  id: number
  name: string
  address?: string
  city?: string
  country?: string
  timezone: string
  created_at: string
}

export interface Asset {
  id: number
  site_id: number
  parent_id?: number
  data_source_id?: number
  name: string
  asset_type: string
  description?: string
  rated_capacity_kw?: number
  is_critical: boolean
  requires_metering: boolean
}

export interface AssetTreeNode extends Asset {
  children: AssetTreeNode[]
  meter?: Meter
}

export interface Meter {
  id: number
  site_id: number
  asset_id?: number
  meter_id: string
  name: string
  is_active: boolean
  last_reading_at?: string
}

export interface Bill {
  id: number
  site_id: number
  bill_date: string
  period_start: string
  period_end: string
  total_kwh: number
  total_amount: number
  is_validated: boolean
  validation_variance_pct?: number
}

export interface BillValidationResult {
  bill_id: number
  is_valid: boolean
  bill_total_kwh: number
  meter_total_kwh: number
  variance_kwh: number
  variance_percentage: number
  message: string
}

export interface OCRBillResult {
  success: boolean
  supplier_name?: string
  account_number?: string
  bill_date?: string
  period_start?: string
  period_end?: string
  total_kwh?: number
  total_amount?: number
  peak_demand_kw?: number
  line_items?: Array<{ description: string; amount: number; quantity?: number }>
  raw_text?: string
  error?: string
}

export interface PanelAssetExtracted {
  name: string
  type: string
  rated_capacity_kw?: number
  rated_voltage?: number
  parent_name?: string
  children: string[]
}

export interface PanelDiagramResult {
  success: boolean
  assets: PanelAssetExtracted[]
  hierarchy_levels: number
  total_assets: number
  raw_analysis?: string
  error?: string
}

export interface GapAnalysisResult {
  site_id: number
  site_name: string
  total_assets: number
  metered_assets: number
  unmetered_assets: number
  coverage_percentage: number
  critical_unmetered_count: number
  unmetered_asset_list: UnmeteredAsset[]
  recommendations: string[]
}

export interface UnmeteredAsset {
  asset_id: number
  asset_name: string
  asset_type: string
  parent_name?: string
  is_critical: boolean
}

export interface SolarROIInput {
  annual_consumption_kwh: number
  average_electricity_rate: number
  system_size_kw: number
  installation_cost: number
}

export interface SolarROIResult {
  system_size_kw: number
  installation_cost: number
  year_one_savings: number
  simple_payback_years: number
  net_present_value: number
  internal_rate_of_return: number
  lifetime_savings: number
}

export interface BESSSimulationInput {
  load_profile_kwh: number[]
  tariff_rates: number[]
  demand_charges?: number[]
  battery_capacity_kwh: number
  battery_power_kw: number
  round_trip_efficiency: number
  depth_of_discharge: number
  capex: number
  opex_annual: number
  analysis_years: number
  discount_rate: number
  degradation_rate: number
}

export interface BESSSimulationResult {
  arbitrage_savings_year1: number
  peak_shaving_savings_year1: number
  total_savings_year1: number
  simple_payback_years: number
  net_present_value: number
  internal_rate_of_return?: number
  lifetime_savings: number
  annual_projections: Array<{year: number, net_savings: number, cumulative: number}>
  monthly_peak_reduction: number[]
}

export interface Tenant {
  id: number
  site_id: number
  name: string
  contact_email?: string
  is_active: boolean
  created_at: string
}

export interface Invoice {
  id: number
  tenant_id: number
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  consumption_kwh: number
  total_amount: number
  status: string
  created_at: string
}

export interface DataSource {
  id: number
  site_id: number
  gateway_id?: number
  name: string
  source_type: string
  host?: string
  port?: number
  slave_id?: number
  polling_interval_seconds?: number
  is_active: boolean
  last_poll_at?: string
  last_error?: string
  mqtt_broker_url?: string
  mqtt_topic?: string
  mqtt_port?: number
  mqtt_use_tls?: boolean
  webhook_url?: string
}

export interface Gateway {
  id: number
  site_id: number
  name: string
  ip_address?: string
  status?: string
  last_seen_at?: string
  firmware_version?: string
  description?: string
  heartbeat_interval_seconds?: number
}

export interface DeviceTemplate {
  id: number
  device_type: string
  manufacturer: string
  model: string
  protocol: string
  description?: string
  register_count?: number
}

export interface ModbusRegister {
  id: number
  data_source_id: number
  meter_id?: number
  name: string
  register_address: number
  register_type: string
  data_type: string
  byte_order?: string
  scale_factor?: number
  unit?: string
  last_value?: number
  last_read_at?: string
  read_error_count?: number
}

export interface BulkDeviceImportRow {
  name: string
  protocol?: string
  host?: string
  port?: number
  slave_id?: number
  location?: string
  template_name?: string
  gateway_name?: string
  description?: string
}

export interface BulkDeviceImportRequest {
  site_id: number
  devices: BulkDeviceImportRow[]
}

export interface BulkImportResultRow {
  row_number: number
  name: string
  success: boolean
  data_source_id?: number
  error?: string
}

export interface BulkDeviceImportResponse {
  total: number
  successful: number
  failed: number
  results: BulkImportResultRow[]
}

export interface DeviceHealthSummary {
  data_source_id: number
  name: string
  protocol: string
  status: string
  last_communication?: string
  success_rate_24h: number
  avg_response_time_ms?: number
  error_count_24h: number
  last_error?: string
  firmware_version?: string
}

export interface DeviceHealthDashboard {
  total_devices: number
  online_count: number
  offline_count: number
  error_count: number
  unknown_count: number
  overall_success_rate: number
  devices: DeviceHealthSummary[]
}

export interface Notification {
  id: number
  site_id: number
  notification_type: string
  severity: string
  title: string
  message: string
  is_read: boolean
  is_resolved: boolean
  created_at: string
  agent_name?: string
}

export interface Tariff {
  id: number
  site_id: number
  name: string
  tariff_type: string
  rate_per_kwh: number
  demand_rate_per_kw?: number
  fixed_charge?: number
  peak_rate?: number
  off_peak_rate?: number
  is_active: boolean
  effective_from: string
  effective_to?: string
}

export interface CarbonEmission {
  id: number
  site_id: number
  year: number
  month: number
  scope1_kg_co2: number
  scope2_kg_co2: number
  scope3_kg_co2: number
  energy_kwh: number
  emission_factor: number
  created_at: string
}

export interface CarbonSummary {
  total_scope1_kg_co2: number
  total_scope2_kg_co2: number
  total_scope3_kg_co2: number
  total_emissions_kg_co2: number
  total_energy_kwh: number
  emission_intensity: number
  record_count: number
}

export interface DataQualityDashboard {
  total_meters: number
  meters_with_issues: number
  average_coverage: number
  average_quality_score: number
  open_issues_count: number
  critical_issues_count: number
  recent_issues: QualityIssue[]
}

export interface QualityIssue {
  id: number
  meter_id: number
  issue_type: string
  severity: string
  description: string
  detected_at: string
  resolved_at?: string
  resolution?: string
}

export interface VirtualMeter {
  id: number
  site_id: number
  name: string
  meter_type: string
  expression: string
  is_active: boolean
  created_at: string
}

export interface MaintenanceAlert {
  id: number
  asset_id: number
  alert_type: string
  severity: string
  message: string
  predicted_failure_date?: string
  confidence: number
  acknowledged_at?: string
  created_at: string
}

export interface AssetCondition {
  id: number
  asset_id: number
  condition_score: number
  health_status: string
  metrics: Record<string, number>
  recorded_at: string
}

export interface AgentChatResponse {
  session_id: number
  agent_type: string
  response: string
  actions?: Array<{ type: string, data: Record<string, unknown> }>
  recommendations?: string[]
}

export interface ForecastResponse {
  job_id: number
  site_id: number
  forecast_type: string
  horizon_hours: number
  status: string
  data: ForecastPoint[]
}

export interface ForecastPoint {
  timestamp: string
  predicted_value: number
  lower_bound?: number
  upper_bound?: number
  confidence?: number
}

export interface BESSVendor {
  id: number
  name: string
  country?: string
  website?: string
  description?: string
  logo_url?: string
  is_active: boolean
  created_at: string
}

export interface BESSModel {
  id: number
  vendor_id: number
  model_name: string
  model_number?: string
  chemistry: string
  capacity_kwh: number
  power_rating_kw: number
  voltage_nominal?: number
  round_trip_efficiency: number
  depth_of_discharge: number
  cycle_life: number
  warranty_years: number
  dimensions_cm?: string
  weight_kg?: number
  price_usd?: number
  price_per_kwh?: number
  is_active: boolean
  created_at: string
  vendor?: BESSVendor
}

export interface BESSDataset {
  id: number
  site_id: number
  name: string
  description?: string
  interval_minutes: number
  start_date?: string
  end_date?: string
  total_records: number
  total_consumption_kwh: number
  peak_demand_kw?: number
  avg_demand_kw?: number
  file_name?: string
  upload_status: string
  created_at: string
}

export interface BESSRecommendationRequest {
  site_id: number
  dataset_id?: number
  budget_min?: number
  budget_max?: number
  target_peak_reduction_percent?: number
  preferred_chemistry?: string
}

export interface BESSRecommendation {
  model_id: number
  vendor_name: string
  model_name: string
  capacity_kwh: number
  power_rating_kw: number
  estimated_price?: number
  estimated_annual_savings: number
  estimated_payback_years: number
  fit_score: number
  reasoning: string
}

export interface PVModule {
  id: number
  manufacturer: string
  model_name: string
  power_rating_w: number
  efficiency_percent: number
  width_mm: number
  height_mm: number
  weight_kg?: number
  cell_type: string
  warranty_years: number
  price_usd?: number
  is_active: boolean
  created_at: string
}

export interface PVSurfaceCreate {
  name: string
  surface_type?: string
  area_sqm: number
  usable_area_sqm?: number
  tilt_degrees?: number
  azimuth_degrees?: number
  shading_percent?: number
  notes?: string
}

export interface PVSurface {
  id: number
  assessment_id: number
  name: string
  surface_type: string
  area_sqm: number
  usable_area_sqm?: number
  tilt_degrees: number
  azimuth_degrees: number
  shading_percent: number
  max_capacity_kw?: number
  created_at: string
}

export interface PVAssessmentCreate {
  site_id: number
  name: string
  latitude?: number
  longitude?: number
  notes?: string
  surfaces?: PVSurfaceCreate[]
}

export interface PVAssessment {
  id: number
  site_id: number
  name: string
  assessment_date: string
  latitude?: number
  longitude?: number
  annual_irradiance_kwh_m2?: number
  avg_peak_sun_hours?: number
  shading_factor: number
  status: string
  surfaces: PVSurface[]
  created_at: string
}

export interface PVDesignRequest {
  assessment_id: number
  module_id?: number
  target_capacity_kw?: number
  max_panels?: number
  electricity_rate?: number
  export_rate?: number
  self_consumption_percent?: number
  capex_per_kw?: number
  analysis_years?: number
  discount_rate?: number
}

export interface PVDesignScenario {
  id: number
  assessment_id: number
  module_id?: number
  name: string
  system_capacity_kw: number
  num_panels: number
  annual_production_kwh?: number
  capacity_factor?: number
  self_consumption_percent: number
  export_percent: number
  total_capex?: number
  annual_savings?: number
  npv?: number
  irr?: number
  payback_years?: number
  lcoe?: number
  co2_avoided_tons?: number
  created_at: string
}
