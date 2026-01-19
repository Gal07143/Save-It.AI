import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, BESSVendor, BESSModel, BESSDataset, BESSRecommendation, BESSSimulationResult } from '../services/api'
import { Battery, Play, Upload, FileSpreadsheet, TrendingUp, DollarSign, Clock, Building2, Zap, Award, ChevronRight, X, Check, AlertCircle, Boxes, Database, BarChart3, PieChart } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts'
import TabPanel, { Tab } from '../components/TabPanel'

function generateSampleLoadProfile(): number[] {
  return Array.from({ length: 8760 }, (_, hour) => {
    const dayHour = hour % 24
    const month = Math.floor(hour / 730)
    const baseLoad = 150
    const seasonFactor = 1 + 0.3 * Math.sin((month - 6) * Math.PI / 6)
    const hourlyFactor = dayHour >= 8 && dayHour <= 20 ? 1.5 + 0.5 * Math.sin((dayHour - 8) * Math.PI / 12) : 0.7
    return Math.round((baseLoad * seasonFactor * hourlyFactor + Math.random() * 30) * 10) / 10
  })
}

function generateSampleTariff(): number[] {
  return Array.from({ length: 8760 }, (_, hour) => {
    const dayHour = hour % 24
    if (dayHour >= 14 && dayHour <= 19) return 0.25
    if (dayHour >= 7 && dayHour <= 22) return 0.15
    return 0.08
  })
}

type TabType = 'vendor' | 'models' | 'datasets' | 'arbitrage' | 'peak' | 'financial'

export default function BESSSimulator() {
  const [activeTab, setActiveTab] = useState<TabType>('vendor')
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<BESSModel | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<BESSDataset | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newDatasetName, setNewDatasetName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [params, setParams] = useState({
    battery_capacity_kwh: 500,
    battery_power_kw: 250,
    round_trip_efficiency: 0.9,
    depth_of_discharge: 0.9,
    capex: 250000,
    opex_annual: 5000,
    analysis_years: 15,
    discount_rate: 0.08,
    degradation_rate: 0.02,
  })
  const [result, setResult] = useState<BESSSimulationResult | null>(null)
  const [recommendations, setRecommendations] = useState<BESSRecommendation[]>([])

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['bess-vendors'],
    queryFn: api.bessVendors.list,
  })

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['bess-models', selectedVendor],
    queryFn: () => api.bessModels.list({ vendorId: selectedVendor || undefined }),
  })

  const { data: datasets = [], isLoading: datasetsLoading, refetch: refetchDatasets } = useQuery({
    queryKey: ['bess-datasets'],
    queryFn: () => api.bessDatasets.list(),
  })

  const createDatasetMutation = useMutation({
    mutationFn: (name: string) => api.bessDatasets.create({ site_id: 1, name }),
    onSuccess: async (dataset) => {
      if (uploadFile) {
        setUploadProgress('uploading')
        try {
          const result = await api.bessDatasets.uploadCsv(dataset.id, uploadFile)
          setUploadProgress('success')
          setUploadMessage(`Imported ${result.records_imported} records`)
          refetchDatasets()
          setTimeout(() => {
            setShowUploadModal(false)
            setUploadProgress('idle')
            setNewDatasetName('')
            setUploadFile(null)
          }, 2000)
        } catch (error) {
          setUploadProgress('error')
          setUploadMessage((error as Error).message)
        }
      }
    },
  })

  const simulationMutation = useMutation({
    mutationFn: api.analysis.bessSimulation,
    onSuccess: setResult,
  })

  const recommendationsMutation = useMutation({
    mutationFn: api.bessRecommendations.get,
    onSuccess: setRecommendations,
  })

  const runSimulation = () => {
    const simParams = selectedModel ? {
      ...params,
      battery_capacity_kwh: selectedModel.capacity_kwh,
      battery_power_kw: selectedModel.power_rating_kw,
      round_trip_efficiency: selectedModel.round_trip_efficiency,
      depth_of_discharge: selectedModel.depth_of_discharge,
      capex: selectedModel.price_usd || params.capex,
    } : params

    let loadProfile: number[]
    let tariffRates: number[]
    
    if (selectedDataset && selectedDataset.total_records > 0) {
      const avgDemand = selectedDataset.avg_demand_kw || 100
      const peakDemand = selectedDataset.peak_demand_kw || 200
      const peakRatio = peakDemand / avgDemand
      
      loadProfile = Array.from({ length: 8760 }, (_, hour) => {
        const dayHour = hour % 24
        const month = Math.floor(hour / 730)
        const seasonFactor = 1 + 0.3 * Math.sin((month - 6) * Math.PI / 6)
        const hourlyFactor = dayHour >= 8 && dayHour <= 20 
          ? 1 + (peakRatio - 1) * Math.sin((dayHour - 8) * Math.PI / 12) 
          : 0.7
        return Math.round((avgDemand * seasonFactor * hourlyFactor) * 10) / 10
      })
    } else {
      loadProfile = generateSampleLoadProfile()
    }
    
    tariffRates = generateSampleTariff()

    simulationMutation.mutate({
      ...simParams,
      load_profile_kwh: loadProfile,
      tariff_rates: tariffRates,
      demand_charges: [15, 15, 15, 12, 12, 18, 20, 20, 18, 15, 15, 15],
    })
  }

  const getRecommendations = () => {
    if (!selectedDataset) {
      setActiveTab('financial')
      return
    }
    recommendationsMutation.mutate({
      site_id: 1,
      dataset_id: selectedDataset.id,
      target_peak_reduction_percent: 20,
    })
    setActiveTab('financial')
  }

  const handleUpload = () => {
    if (newDatasetName && uploadFile) {
      createDatasetMutation.mutate(newDatasetName)
    }
  }

  const selectModelForSimulation = (model: BESSModel) => {
    setSelectedModel(model)
    setParams({
      ...params,
      battery_capacity_kwh: model.capacity_kwh,
      battery_power_kw: model.power_rating_kw,
      round_trip_efficiency: model.round_trip_efficiency,
      depth_of_discharge: model.depth_of_discharge,
      capex: model.price_usd || params.capex,
    })
    setActiveTab('arbitrage')
  }

  const tabs: Tab[] = [
    { id: 'vendor', label: 'Vendor Catalog', icon: Building2 },
    { id: 'models', label: 'Model Selection', icon: Boxes },
    { id: 'datasets', label: 'Load Datasets', icon: Database },
    { id: 'arbitrage', label: 'Arbitrage Simulation', icon: TrendingUp },
    { id: 'peak', label: 'Peak Shaving', icon: BarChart3 },
    { id: 'financial', label: 'Financial Analysis', icon: PieChart },
  ]

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'vendor':
        return (
          <div>
            <div className="card">
              <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Battery Manufacturers</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Browse and select from leading BESS manufacturers worldwide. Click a vendor to filter available models.
              </p>
              {vendorsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading vendors...</div>
              ) : (
                <div className="grid grid-3" style={{ gap: '1rem' }}>
                  {vendors.map((vendor: BESSVendor) => (
                    <div
                      key={vendor.id}
                      onClick={() => setSelectedVendor(selectedVendor === vendor.id ? null : vendor.id)}
                      className="card"
                      style={{
                        cursor: 'pointer',
                        border: selectedVendor === vendor.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{vendor.name}</h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{vendor.country}</p>
                        </div>
                        {selectedVendor === vendor.id && <Check size={20} color="var(--primary)" />}
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        {vendor.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {selectedVendor && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => setActiveTab('models')}>
                    View Models <ChevronRight size={16} />
                  </button>
                  <button className="btn" onClick={() => setSelectedVendor(null)}>
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )

      case 'models':
        return (
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontWeight: '600' }}>Battery Models - Capacity & Chemistry Options</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Compare specifications, chemistry types, and pricing across available BESS models
                  </p>
                </div>
                {selectedVendor && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Filtered by: {vendors.find(v => v.id === selectedVendor)?.name}
                  </span>
                )}
              </div>
              {modelsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading models...</div>
              ) : models.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Boxes size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <h4 style={{ marginBottom: '0.5rem' }}>No models found</h4>
                  <p>Select a vendor from the Vendor Catalog tab to filter models.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('vendor')}>
                    Browse Vendors
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Chemistry</th>
                        <th>Capacity</th>
                        <th>Power</th>
                        <th>Efficiency</th>
                        <th>Cycle Life</th>
                        <th>Warranty</th>
                        <th>Price</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((model: BESSModel) => (
                        <tr key={model.id}>
                          <td>
                            <div>
                              <div style={{ fontWeight: '500' }}>{model.model_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{model.model_number}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${model.chemistry === 'LFP' ? 'badge-success' : 'badge-info'}`}>
                              {model.chemistry}
                            </span>
                          </td>
                          <td>{model.capacity_kwh} kWh</td>
                          <td>{model.power_rating_kw} kW</td>
                          <td>{(model.round_trip_efficiency * 100).toFixed(0)}%</td>
                          <td>{model.cycle_life.toLocaleString()}</td>
                          <td>{model.warranty_years} yrs</td>
                          <td>
                            {model.price_usd ? (
                              <div>
                                <div>${model.price_usd.toLocaleString()}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  ${model.price_per_kwh}/kWh
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => selectModelForSimulation(model)}
                            >
                              Simulate <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )

      case 'datasets':
        return (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontWeight: '600' }}>8760-Hour Load Profiles</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Upload annual interval data (8760 hours) for accurate BESS sizing and simulation
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                  <Upload size={16} /> Upload CSV
                </button>
              </div>

              {datasetsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading datasets...</div>
              ) : datasets.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                  <FileSpreadsheet size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                  <h4 style={{ marginBottom: '0.5rem' }}>No datasets uploaded yet</h4>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Upload a CSV file with timestamp and demand columns (8760 hourly records for full year analysis)
                  </p>
                  <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                    <Upload size={16} /> Upload First Dataset
                  </button>
                </div>
              ) : (
                <div className="grid grid-2" style={{ gap: '1rem' }}>
                  {datasets.map((dataset: BESSDataset) => (
                    <div
                      key={dataset.id}
                      onClick={() => setSelectedDataset(selectedDataset?.id === dataset.id ? null : dataset)}
                      className="card"
                      style={{
                        cursor: 'pointer',
                        border: selectedDataset?.id === dataset.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{dataset.name}</h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{dataset.file_name}</p>
                        </div>
                        <span className={`badge ${dataset.upload_status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {dataset.upload_status}
                        </span>
                      </div>
                      <div className="grid grid-3" style={{ gap: '0.5rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Records</div>
                          <div style={{ fontWeight: '600' }}>{dataset.total_records.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Peak Demand</div>
                          <div style={{ fontWeight: '600' }}>{dataset.peak_demand_kw?.toFixed(0) || '-'} kW</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total kWh</div>
                          <div style={{ fontWeight: '600' }}>{dataset.total_consumption_kwh?.toLocaleString() || '-'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedDataset && (
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Selected Dataset: {selectedDataset.name}</h3>
                <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Date Range</div>
                    <div className="stat-value" style={{ fontSize: '1rem' }}>
                      {selectedDataset.start_date} - {selectedDataset.end_date}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Interval</div>
                    <div className="stat-value">{selectedDataset.interval_minutes} min</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Avg Demand</div>
                    <div className="stat-value">{selectedDataset.avg_demand_kw?.toFixed(1) || '-'} kW</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Peak Demand</div>
                    <div className="stat-value">{selectedDataset.peak_demand_kw?.toFixed(1) || '-'} kW</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => setActiveTab('arbitrage')}>
                    <TrendingUp size={16} /> Run Arbitrage Simulation
                  </button>
                  <button className="btn" onClick={() => setActiveTab('peak')}>
                    <BarChart3 size={16} /> Analyze Peak Shaving
                  </button>
                </div>
              </div>
            )}
          </div>
        )

      case 'arbitrage':
        return (
          <div>
            {selectedModel && (
              <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Battery size={20} />
                <span>Simulating with: <strong>{selectedModel.model_name}</strong> ({selectedModel.capacity_kwh} kWh / {selectedModel.power_rating_kw} kW)</span>
                <button onClick={() => setSelectedModel(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>TOU Arbitrage Optimization</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Maximize savings by charging during off-peak hours and discharging during peak TOU periods. 
                Configure battery parameters and run simulation to analyze arbitrage revenue potential.
              </p>
            </div>

            <div className="grid grid-3" style={{ gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Battery Specifications</h3>
                
                <div className="form-group">
                  <label className="form-label">Capacity (kWh)</label>
                  <input
                    type="number"
                    value={params.battery_capacity_kwh}
                    onChange={(e) => setParams({ ...params, battery_capacity_kwh: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Power Rating (kW)</label>
                  <input
                    type="number"
                    value={params.battery_power_kw}
                    onChange={(e) => setParams({ ...params, battery_power_kw: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Round-Trip Efficiency (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={Math.round(params.round_trip_efficiency * 100)}
                    onChange={(e) => setParams({ ...params, round_trip_efficiency: Number(e.target.value) / 100 })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Depth of Discharge (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={Math.round(params.depth_of_discharge * 100)}
                    onChange={(e) => setParams({ ...params, depth_of_discharge: Number(e.target.value) / 100 })}
                  />
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>TOU Rate Structure</h3>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Off-Peak (12am - 7am)</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>$0.08/kWh</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Mid-Peak (7am - 2pm, 7pm - 12am)</span>
                    <span style={{ fontWeight: '600', color: 'var(--warning)' }}>$0.15/kWh</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>On-Peak (2pm - 7pm)</span>
                    <span style={{ fontWeight: '600', color: 'var(--danger)' }}>$0.25/kWh</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Sample TOU schedule for simulation. Actual rates will vary by utility.
                </p>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Run Arbitrage Simulation</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {selectedDataset 
                    ? `Using dataset: ${selectedDataset.name}`
                    : 'Using sample load profile and TOU tariff data (8760 hourly values).'}
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={runSimulation}
                  disabled={simulationMutation.isPending}
                >
                  <Play size={18} />
                  {simulationMutation.isPending ? 'Running...' : 'Run TOU Arbitrage Simulation'}
                </button>
                
                {simulationMutation.isError && (
                  <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
                    Error: {(simulationMutation.error as Error).message}
                  </div>
                )}

                {result && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--primary)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      ${result.arbitrage_savings_year1.toLocaleString()}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>Year 1 TOU Arbitrage Savings</div>
                    <button 
                      className="btn btn-primary" 
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      onClick={() => setActiveTab('financial')}
                    >
                      View Full Analysis <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 'peak':
        return (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Peak Shaving - Demand Reduction Modeling</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Reduce demand charges by shaving peak loads. Model different battery sizes to optimize demand charge savings.
              </p>
            </div>

            <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Peak Shaving Configuration</h3>
                
                <div className="form-group">
                  <label className="form-label">Battery Capacity (kWh)</label>
                  <input
                    type="number"
                    value={params.battery_capacity_kwh}
                    onChange={(e) => setParams({ ...params, battery_capacity_kwh: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Power Rating (kW)</label>
                  <input
                    type="number"
                    value={params.battery_power_kw}
                    onChange={(e) => setParams({ ...params, battery_power_kw: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Peak Reduction (%)</label>
                  <input
                    type="number"
                    defaultValue={20}
                    min={5}
                    max={50}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={runSimulation}
                  disabled={simulationMutation.isPending}
                >
                  <Play size={18} />
                  {simulationMutation.isPending ? 'Analyzing...' : 'Run Peak Shaving Analysis'}
                </button>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Monthly Demand Charges</h3>
                <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.25rem 0' }}>Month</th>
                        <th style={{ textAlign: 'right', padding: '0.25rem 0' }}>Rate ($/kW)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => (
                        <tr key={month}>
                          <td style={{ padding: '0.25rem 0' }}>{month}</td>
                          <td style={{ textAlign: 'right', padding: '0.25rem 0' }}>${[15, 15, 15, 12, 12, 18, 20, 20, 18, 15, 15, 15][i]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {result && (
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Monthly Peak Reduction Results</h3>
                <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                  <div className="stat-card">
                    <DollarSign size={32} color="var(--info)" />
                    <div className="stat-value" style={{ color: 'var(--info)' }}>
                      ${result.peak_shaving_savings_year1.toLocaleString()}
                    </div>
                    <div className="stat-label">Year 1 Demand Charge Savings</div>
                  </div>
                  <div className="stat-card">
                    <Zap size={32} color="var(--warning)" />
                    <div className="stat-value">
                      {Math.round(result.monthly_peak_reduction.reduce((a, b) => a + b, 0) / 12)} kW
                    </div>
                    <div className="stat-label">Average Monthly Peak Reduction</div>
                  </div>
                </div>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.monthly_peak_reduction.map((v, i) => ({ 
                      month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], 
                      reduction: v 
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }} />
                      <Bar dataKey="reduction" fill="var(--info)" radius={[4, 4, 0, 0]} name="Peak Reduction (kW)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!result && (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <BarChart3 size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>Run analysis to see peak shaving results</h4>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Configure parameters and run simulation to view monthly demand reduction modeling
                </p>
              </div>
            )}
          </div>
        )

      case 'financial':
        return (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Financial Analysis - ROI Projections</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Comprehensive financial analysis including NPV, IRR, payback period, and lifetime cash flow projections.
              </p>
            </div>

            <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Financial Parameters</h3>
                
                <div className="form-group">
                  <label className="form-label">CAPEX ($)</label>
                  <input
                    type="number"
                    value={params.capex}
                    onChange={(e) => setParams({ ...params, capex: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Annual OPEX ($)</label>
                  <input
                    type="number"
                    value={params.opex_annual}
                    onChange={(e) => setParams({ ...params, opex_annual: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Analysis Period (Years)</label>
                  <input
                    type="number"
                    value={params.analysis_years}
                    onChange={(e) => setParams({ ...params, analysis_years: Number(e.target.value) })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Discount Rate (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={Math.round(params.discount_rate * 100)}
                    onChange={(e) => setParams({ ...params, discount_rate: Number(e.target.value) / 100 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Annual Degradation Rate (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={Math.round(params.degradation_rate * 100)}
                    onChange={(e) => setParams({ ...params, degradation_rate: Number(e.target.value) / 100 })}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={runSimulation}
                  disabled={simulationMutation.isPending}
                >
                  <Play size={18} />
                  {simulationMutation.isPending ? 'Calculating...' : 'Calculate ROI'}
                </button>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Equipment Recommendations</h3>
                {recommendationsMutation.isPending ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p>Generating recommendations...</p>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Award size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                    <h4 style={{ marginBottom: '0.5rem' }}>No recommendations yet</h4>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Upload load data to get AI-powered equipment recommendations
                    </p>
                    <button className="btn btn-primary" onClick={getRecommendations} disabled={recommendationsMutation.isPending}>
                      <Award size={16} /> Generate Recommendations
                    </button>
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {recommendations.slice(0, 3).map((rec, idx) => (
                      <div key={rec.model_id} style={{ 
                        padding: '0.75rem', 
                        border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '600' }}>{rec.model_name}</span>
                          {idx === 0 && <span className="badge badge-success">Best Match</span>}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Score: {(rec.fit_score * 100).toFixed(0)}% • Savings: ${rec.estimated_annual_savings?.toLocaleString()}/yr • Payback: {rec.estimated_payback_years?.toFixed(1)} yrs
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {result ? (
              <>
                <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
                  <div className="card stat-card">
                    <DollarSign size={32} color="var(--primary)" />
                    <div className="stat-value" style={{ color: 'var(--primary)' }}>
                      ${result.total_savings_year1.toLocaleString()}
                    </div>
                    <div className="stat-label">Year 1 Total Savings</div>
                  </div>
                  <div className="card stat-card">
                    <Clock size={32} color="var(--info)" />
                    <div className="stat-value">
                      {result.simple_payback_years.toFixed(1)} yrs
                    </div>
                    <div className="stat-label">Simple Payback</div>
                  </div>
                  <div className="card stat-card">
                    <TrendingUp size={32} color={result.net_present_value > 0 ? 'var(--primary)' : 'var(--danger)'} />
                    <div className="stat-value" style={{ color: result.net_present_value > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                      ${Math.abs(result.net_present_value).toLocaleString()}
                    </div>
                    <div className="stat-label">NPV</div>
                  </div>
                  <div className="card stat-card">
                    <Zap size={32} color="var(--warning)" />
                    <div className="stat-value">
                      {result.internal_rate_of_return ? `${(result.internal_rate_of_return * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="stat-label">IRR</div>
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                  <div className="card">
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Savings Breakdown (Year 1)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--primary)' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                          ${result.arbitrage_savings_year1.toLocaleString()}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>TOU Arbitrage</div>
                      </div>
                      <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--info)' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--info)' }}>
                          ${result.peak_shaving_savings_year1.toLocaleString()}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>Peak Shaving</div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Investment Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Initial Investment</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>${params.capex.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Annual OPEX</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>${params.opex_annual.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lifetime Savings</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--primary)' }}>
                          ${(result.total_savings_year1 * params.analysis_years * 0.85).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Net Benefit</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: result.net_present_value > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                          ${result.net_present_value.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cumulative Cash Flow Projection</h3>
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[{ year: 0, cumulative: -params.capex }, ...result.annual_projections]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip 
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cumulative Cash Flow']} 
                          contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cumulative" 
                          stroke="var(--primary)" 
                          fill="rgba(16, 185, 129, 0.2)"
                          strokeWidth={2} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <PieChart size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>Run simulation to see financial analysis</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Configure parameters and run simulation from Arbitrage or Peak Shaving tabs, or use the Calculate ROI button above
                </p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="page-dark">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Battery size={24} />
          BESS Financial Simulator
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Analyze battery energy storage system ROI with TOU arbitrage and peak shaving</p>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        variant="default"
        size="md"
      >
        {renderTabContent}
      </TabPanel>

      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '600' }}>Upload Load Data CSV</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {uploadProgress === 'idle' && (
              <>
                <div className="form-group">
                  <label className="form-label">Dataset Name</label>
                  <input
                    type="text"
                    value={newDatasetName}
                    onChange={(e) => setNewDatasetName(e.target.value)}
                    placeholder="e.g., Main Building 2024"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CSV File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    CSV should have columns: timestamp, demand_kw (8760 rows for full year)
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleUpload}
                  disabled={!newDatasetName || !uploadFile}
                >
                  <Upload size={16} /> Upload Dataset
                </button>
              </>
            )}

            {uploadProgress === 'uploading' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                <p>Uploading and processing data...</p>
              </div>
            )}

            {uploadProgress === 'success' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Check size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--primary)' }}>{uploadMessage}</p>
              </div>
            )}

            {uploadProgress === 'error' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <AlertCircle size={48} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--danger)' }}>{uploadMessage}</p>
                <button 
                  className="btn" 
                  style={{ marginTop: '1rem' }}
                  onClick={() => setUploadProgress('idle')}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
