const API_BASE = '/api/v1'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }))
    throw new Error(error.detail || 'An error occurred')
  }
  
  return response.json()
}

export const api = {
  sites: {
    list: () => fetchApi<Site[]>('/sites'),
    get: (id: number) => fetchApi<Site>(`/sites/${id}`),
    create: (data: Partial<Site>) => fetchApi<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  },
  assets: {
    list: (siteId?: number) => fetchApi<Asset[]>(`/assets${siteId ? `?site_id=${siteId}` : ''}`),
    tree: (siteId: number) => fetchApi<AssetTreeNode[]>(`/assets/tree/${siteId}`),
    create: (data: Partial<Asset>) => fetchApi<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
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
  },
  analysis: {
    gapAnalysis: (siteId: number) => fetchApi<GapAnalysisResult>(`/analysis/gap-analysis/${siteId}`),
    solarRoi: (data: SolarROIInput) => fetchApi<SolarROIResult>('/analysis/solar-roi', { method: 'POST', body: JSON.stringify(data) }),
    bessSimulation: (data: BESSSimulationInput) => fetchApi<BESSSimulationResult>('/analysis/bess-simulation', { method: 'POST', body: JSON.stringify(data) }),
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
  name: string
  source_type: string
  is_active: boolean
  last_poll_at?: string
  last_error?: string
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
