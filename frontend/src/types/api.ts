/**
 * API type definitions for Save-It.AI.
 * These types match the backend API schemas.
 */

// =============================================================================
// Authentication Types
// =============================================================================

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

// =============================================================================
// Site Types
// =============================================================================

export interface Site {
  id: number
  name: string
  address?: string
  city?: string
  country?: string
  timezone: string
  site_type?: string
  industry?: string
  area_sqm?: number
  grid_capacity_kva?: number
  operating_hours?: string
  operating_hours_start?: string
  operating_hours_end?: string
  currency?: string
  electricity_rate?: number
  utility_provider?: string
  contact_name?: string
  contact_phone?: string
  created_at: string
  organization_id?: number
  is_active?: number
}

// =============================================================================
// Asset Types
// =============================================================================

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
  meter_id?: string
  rated_voltage?: number
}

// =============================================================================
// Meter Types
// =============================================================================

export interface Meter {
  id: number
  site_id: number
  asset_id?: number
  data_source_id?: number
  meter_id: string
  name: string
  meter_type?: string
  is_active: boolean
  last_reading_at?: string
}

// =============================================================================
// Bill Types
// =============================================================================

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

// =============================================================================
// Analysis Types
// =============================================================================

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
  annual_projections: Array<{ year: number; net_savings: number; cumulative: number }>
  monthly_peak_reduction: number[]
}

// =============================================================================
// Device Types
// =============================================================================

export interface DataSource {
  id: number
  site_id: number
  gateway_id?: number
  gateway?: Gateway
  name: string
  source_type: string
  host?: string
  port?: number
  slave_id?: number
  polling_interval_seconds?: number
  is_active: boolean | number
  last_poll_at?: string
  last_error?: string
  mqtt_broker_url?: string
  mqtt_topic?: string
  mqtt_username?: string | null
  mqtt_password?: string | null
  mqtt_port?: number
  mqtt_use_tls?: boolean | number
  webhook_url?: string
  webhook_api_key?: string | null
  webhook_auth_type?: string
  connection_params?: Record<string, unknown>
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
  manufacturer?: string
  model?: string
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

// =============================================================================
// Gateway Credentials Types
// =============================================================================

export interface MQTTConfig {
  host: string
  port: number
  tls_port: number
  username: string
  password: string
  client_id: string
  publish_topic: string
  heartbeat_topic: string
  subscribe_topic: string
}

export interface WebhookConfig {
  url: string
  api_key: string
  secret_key: string
  method: string
  content_type: string
}

export interface GatewayRegistration {
  gateway_id: number
  gateway_name: string
  status: string
  mqtt: MQTTConfig
  webhook: WebhookConfig
  registered_at: string
}

// =============================================================================
// Notification Types
// =============================================================================

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

// =============================================================================
// Tariff Types
// =============================================================================

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
  peak_hours_start?: string
  peak_hours_end?: string
  is_active: boolean
  effective_from: string
  effective_to?: string
}

// =============================================================================
// Tenant Types
// =============================================================================

export interface Tenant {
  id: number
  site_id: number
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
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

// =============================================================================
// Data Quality Types
// =============================================================================

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

// =============================================================================
// Virtual Meter Types
// =============================================================================

export interface VirtualMeter {
  id: number
  site_id: number
  name: string
  description: string | null
  meter_type: string
  expression: string
  unit: string
  is_active: boolean
  created_at: string
}

// =============================================================================
// Device Health Types
// =============================================================================

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

// =============================================================================
// Forecast Types
// =============================================================================

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

// =============================================================================
// BESS Types
// =============================================================================

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

// =============================================================================
// PV Types
// =============================================================================

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

// =============================================================================
// Maintenance Types
// =============================================================================

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

// =============================================================================
// Carbon Types
// =============================================================================

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

// =============================================================================
// AI Agent Types
// =============================================================================

export interface AgentChatResponse {
  session_id: number
  agent_type: string
  response: string
  actions?: Array<{ type: string; data: Record<string, unknown> }>
  recommendations?: string[]
}

// =============================================================================
// Panel Diagram Types
// =============================================================================

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

// =============================================================================
// Device Template Types (Extended)
// =============================================================================

export interface DeviceTemplateExtended {
  id: number
  name: string
  device_type: string
  manufacturer: string
  model: string
  protocol: string
  description?: string
  default_port?: number
  default_slave_id?: number
  is_system_template?: boolean
  is_active?: boolean
  register_count?: number
  created_at?: string
}

export interface TemplateRegister {
  name: string
  description?: string
  register_address: number
  register_type: string
  data_type: string
  byte_order?: string
  register_count?: number
  scale_factor?: number
  offset?: number
  unit?: string
  is_writable?: boolean
  display_order?: number
  category?: string
}

export interface TemplateExport {
  version: string
  template: Partial<DeviceTemplateExtended>
  registers: TemplateRegister[]
}

export interface TemplateImport {
  template: Partial<DeviceTemplateExtended>
  registers: TemplateRegister[]
}

// =============================================================================
// Modbus Register Types (Extended)
// =============================================================================

export interface ModbusRegisterExtended {
  id: number
  data_source_id: number
  meter_id?: number
  name: string
  description?: string
  register_address: number
  register_type: string
  data_type: string
  byte_order?: string
  register_count?: number
  scale_factor?: number
  offset?: number
  unit?: string
  is_writable?: boolean
  is_active?: boolean
  poll_priority?: number
  last_value?: number
  last_read_at?: string
  last_error?: string
  read_error_count?: number
}

export interface ModbusRegisterCreate {
  data_source_id: number
  meter_id?: number
  name: string
  description?: string
  register_address: number
  register_type: 'holding' | 'input' | 'coil' | 'discrete'
  data_type: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64' | 'bool'
  byte_order?: 'big_endian' | 'little_endian' | 'big_endian_swap' | 'little_endian_swap'
  register_count?: number
  scale_factor?: number
  offset?: number
  unit?: string
  is_writable?: boolean
  is_active?: boolean
  poll_priority?: number
}

export interface RegisterReadResult {
  register_id: number
  name: string
  address: number
  raw_value: number | null
  scaled_value: number | null
  unit?: string
  quality: 'good' | 'bad' | 'stale'
  read_at: string
  error?: string
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  response_time_ms?: number
  device_info?: {
    host: string
    port: number
    slave_id: number
    sample_register_0?: number
  }
}

// =============================================================================
// Bulk Import Types
// =============================================================================

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

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationRule {
  id: number
  site_id: number
  data_source_id?: number
  register_id?: number
  name: string
  description?: string
  rule_type: 'min_value' | 'max_value' | 'rate_of_change' | 'stale_data' | 'range'
  severity: 'warning' | 'error' | 'critical'
  min_value?: number
  max_value?: number
  rate_of_change_max?: number
  rate_of_change_period_seconds?: number
  stale_threshold_seconds?: number
  is_active: boolean
  action_on_violation: string
  created_at: string
  updated_at: string
}

export interface ValidationViolation {
  id: number
  rule_id: number
  data_source_id?: number
  register_id?: number
  timestamp: string
  actual_value?: number
  expected_min?: number
  expected_max?: number
  previous_value?: number
  violation_message?: string
  is_acknowledged: boolean
  acknowledged_by?: number
  acknowledged_at?: string
  created_at: string
}

// =============================================================================
// Device Group Types
// =============================================================================

export interface DeviceGroup {
  id: number
  site_id: number
  name: string
  description?: string
  group_type: string
  parent_group_id?: number
  color: string
  icon?: string
  display_order: number
  is_active: boolean
  device_count: number
  created_at: string
  updated_at: string
}

export interface DeviceGroupMember {
  id: number
  group_id: number
  data_source_id: number
  added_at: string
}

// =============================================================================
// Retry Logic Types
// =============================================================================

export interface RetryQueueItem {
  data_source_id: number
  name: string
  connection_status: string
  next_retry_at?: string
  current_retry_count: number
  max_retries: number
  last_error?: string
}

export interface RetryStatus {
  data_source_id: number
  name: string
  connection_status: string
  current_retry_count: number
  max_retries: number
  retry_delay_seconds: number
  backoff_multiplier: number
  next_retry_at?: string
  last_error?: string
  last_poll_at?: string
  last_successful_poll_at?: string
}

export interface RetryConfig {
  max_retries?: number
  retry_delay_seconds?: number
  backoff_multiplier?: number
}

export interface ConnectionAttemptResult {
  success: boolean
  error_message?: string
  next_retry_at?: string
  current_retry_count: number
}

// =============================================================================
// Firmware Types
// =============================================================================

export interface FirmwareInfo {
  data_source_id: number
  name: string
  firmware_version?: string
  firmware_updated_at?: string
  hardware_version?: string
  serial_number?: string
  manufacturer?: string
  model?: string
  source_type: string
}

export interface FirmwareUpdate {
  firmware_version?: string
  hardware_version?: string
  serial_number?: string
  manufacturer?: string
  model?: string
}

export interface FirmwareSummary {
  total_devices: number
  devices_with_firmware: number
  unique_firmware_versions: number
  firmware_breakdown: Array<{ version: string; count: number; devices: string[] }>
}

// =============================================================================
// QR Code Types
// =============================================================================

export interface QRCodeData {
  data_source_id: number
  qr_string: string
  qr_base64: string
  device_info: {
    type: string
    id: number
    name: string
    site_id: number
    source_type?: string
    serial_number?: string
    firmware_version?: string
  }
}

export interface QRCodeBatchItem {
  data_source_id: number
  name: string
  qr_string: string
  qr_base64: string
}

// =============================================================================
// Clone and Discovery Types
// =============================================================================

export interface CloneResult {
  success: boolean
  message: string
  new_source_id: number
  registers_cloned: number
}

export interface DiscoveredDevice {
  ip: string
  port: number
  protocol: string
  status: string
}

export interface DiscoveryResult {
  success: boolean
  scanned: number
  discovered: DiscoveredDevice[]
  message: string
}

// =============================================================================
// Commissioning Types
// =============================================================================

export interface CommissioningCheckItem {
  step: string
  name: string
  description: string
  completed: boolean
  required: boolean
}

export interface CommissioningStatus {
  device_id: number
  device_name: string
  checklist: CommissioningCheckItem[]
  required_complete: number
  required_total: number
  optional_complete: number
  is_commissioned: boolean
  progress_percent: number
}

// =============================================================================
// Maintenance Schedule Types
// =============================================================================

export interface MaintenanceScheduleItem {
  id: number
  data_source_id: number
  device_name: string
  title: string
  description: string | null
  maintenance_type: string
  priority: string
  scheduled_date: string | null
  completed_date: string | null
  status: string
  assigned_to: string | null
  notes: string | null
}

export interface MaintenanceScheduleCreate {
  data_source_id: number
  title: string
  scheduled_date: string
  description?: string
  maintenance_type?: string
  priority?: string
  assigned_to?: string
}

// =============================================================================
// Device Alert Types
// =============================================================================

export interface DeviceAlertItem {
  id: number
  data_source_id: number
  device_name: string
  name: string
  alert_type: string
  condition: string
  threshold_value: number | null
  threshold_duration_seconds: number
  severity: string
  is_active: number
  last_triggered_at: string | null
  trigger_count: number
  notification_channels: string | null
}

export interface DeviceAlertCreate {
  data_source_id: number
  name: string
  alert_type: string
  condition: string
  threshold_value?: number
  threshold_duration_seconds?: number
  severity?: string
}

// =============================================================================
// PV Extended Types
// =============================================================================

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

export interface PVAssessmentCreate {
  site_id: number
  name: string
  latitude?: number
  longitude?: number
  notes?: string
  surfaces?: PVSurfaceCreate[]
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

// =============================================================================
// BESS Extended Types
// =============================================================================

export interface BESSRecommendationRequest {
  site_id: number
  dataset_id?: number
  budget_min?: number
  budget_max?: number
  target_peak_reduction_percent?: number
  preferred_chemistry?: string
}
