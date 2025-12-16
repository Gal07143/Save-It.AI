import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, PVModule, PVAssessment, PVDesignScenario, PVSurfaceCreate } from '../services/api'
import { 
  Sun, Plus, Calculator, MapPin, Layers, DollarSign, 
  TrendingUp, Leaf, ChevronRight, X, Check
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type TabType = 'assessments' | 'modules' | 'design'

export default function PVDesign() {
  const [activeTab, setActiveTab] = useState<TabType>('assessments')
  const [selectedAssessment, setSelectedAssessment] = useState<PVAssessment | null>(null)
  const [selectedModule, setSelectedModule] = useState<PVModule | null>(null)
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false)
  const [showAddSurfaceModal, setShowAddSurfaceModal] = useState(false)
  const [designResult, setDesignResult] = useState<PVDesignScenario | null>(null)

  const [newAssessment, setNewAssessment] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    notes: '',
  })

  const [newSurface, setNewSurface] = useState<PVSurfaceCreate>({
    name: '',
    surface_type: 'rooftop',
    area_sqm: 100,
    tilt_degrees: 15,
    azimuth_degrees: 180,
    shading_percent: 5,
  })

  const [designParams, setDesignParams] = useState({
    target_capacity_kw: 100,
    electricity_rate: 0.12,
    export_rate: 0.05,
    self_consumption_percent: 80,
    capex_per_kw: 1000,
    analysis_years: 25,
    discount_rate: 0.06,
  })

  const { data: assessments = [], isLoading: assessmentsLoading, refetch: refetchAssessments } = useQuery({
    queryKey: ['pv-assessments'],
    queryFn: () => api.pvAssessments.list(),
  })

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['pv-modules'],
    queryFn: () => api.pvModules.list(),
  })

  const { data: scenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ['pv-scenarios', selectedAssessment?.id],
    queryFn: () => selectedAssessment ? api.pvAssessments.getScenarios(selectedAssessment.id) : Promise.resolve([]),
    enabled: !!selectedAssessment,
  })

  const createAssessmentMutation = useMutation({
    mutationFn: () => api.pvAssessments.create({
      site_id: 1,
      name: newAssessment.name,
      latitude: newAssessment.latitude || undefined,
      longitude: newAssessment.longitude || undefined,
      notes: newAssessment.notes || undefined,
    }),
    onSuccess: (assessment) => {
      refetchAssessments()
      setSelectedAssessment(assessment)
      setShowNewAssessmentModal(false)
      setNewAssessment({ name: '', latitude: 0, longitude: 0, notes: '' })
    },
  })

  const addSurfaceMutation = useMutation({
    mutationFn: () => selectedAssessment 
      ? api.pvAssessments.addSurface(selectedAssessment.id, newSurface)
      : Promise.reject('No assessment selected'),
    onSuccess: () => {
      refetchAssessments()
      setShowAddSurfaceModal(false)
      setNewSurface({
        name: '',
        surface_type: 'rooftop',
        area_sqm: 100,
        tilt_degrees: 15,
        azimuth_degrees: 180,
        shading_percent: 5,
      })
      if (selectedAssessment) {
        api.pvAssessments.get(selectedAssessment.id).then(setSelectedAssessment)
      }
    },
  })

  const calculateDesignMutation = useMutation({
    mutationFn: () => api.pvDesign.calculate({
      assessment_id: selectedAssessment!.id,
      module_id: selectedModule?.id,
      target_capacity_kw: designParams.target_capacity_kw,
      electricity_rate: designParams.electricity_rate,
      export_rate: designParams.export_rate,
      self_consumption_percent: designParams.self_consumption_percent,
      capex_per_kw: designParams.capex_per_kw,
      analysis_years: designParams.analysis_years,
      discount_rate: designParams.discount_rate,
    }),
    onSuccess: (result) => {
      setDesignResult(result)
      refetchScenarios()
    },
  })

  const totalUsableArea = selectedAssessment?.surfaces.reduce((sum, s) => sum + (s.usable_area_sqm || s.area_sqm), 0) || 0
  const maxCapacity = totalUsableArea * 0.2

  const generateCashFlowData = () => {
    if (!designResult) return []
    const capex = designResult.total_capex || 0
    const annualSavings = designResult.annual_savings || 0
    const data = [{ year: 0, cashFlow: -capex, cumulative: -capex }]
    let cumulative = -capex
    for (let year = 1; year <= designParams.analysis_years; year++) {
      const degradedSavings = annualSavings * Math.pow(0.995, year)
      cumulative += degradedSavings
      data.push({ year, cashFlow: degradedSavings, cumulative })
    }
    return data
  }

  return (
    <div className="page-dark">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sun size={24} color="var(--warning)" />
          PV System Design
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Design solar PV systems with ROI projections and equipment selection</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'assessments' as TabType, label: 'Site Assessments', icon: MapPin },
          { id: 'modules' as TabType, label: 'PV Modules', icon: Layers },
          { id: 'design' as TabType, label: 'System Design', icon: Calculator },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'assessments' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '600' }}>Site Assessments</h3>
              <button className="btn btn-primary" onClick={() => setShowNewAssessmentModal(true)}>
                <Plus size={16} /> New Assessment
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Create assessments to define rooftop or ground areas for PV installation
            </p>

            {assessmentsLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading assessments...</div>
            ) : assessments.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                <MapPin size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>No assessments yet</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Create your first site assessment to start designing PV systems
                </p>
                <button className="btn btn-primary" onClick={() => setShowNewAssessmentModal(true)}>
                  <Plus size={16} /> Create Assessment
                </button>
              </div>
            ) : (
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                {assessments.map((assessment: PVAssessment) => (
                  <div
                    key={assessment.id}
                    onClick={() => setSelectedAssessment(selectedAssessment?.id === assessment.id ? null : assessment)}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: selectedAssessment?.id === assessment.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{assessment.name}</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {assessment.assessment_date}
                        </p>
                      </div>
                      <span className={`badge ${assessment.status === 'draft' ? 'badge-warning' : 'badge-success'}`}>
                        {assessment.status}
                      </span>
                    </div>
                    <div className="grid grid-3" style={{ gap: '0.5rem', marginTop: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Surfaces</div>
                        <div style={{ fontWeight: '600' }}>{assessment.surfaces.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Area</div>
                        <div style={{ fontWeight: '600' }}>
                          {assessment.surfaces.reduce((sum, s) => sum + s.area_sqm, 0).toFixed(0)} m²
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max Capacity</div>
                        <div style={{ fontWeight: '600' }}>
                          {(assessment.surfaces.reduce((sum, s) => sum + (s.max_capacity_kw || 0), 0)).toFixed(0)} kW
                        </div>
                      </div>
                    </div>
                    {assessment.latitude && assessment.longitude && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        {assessment.latitude.toFixed(4)}, {assessment.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedAssessment && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: '600' }}>Surfaces: {selectedAssessment.name}</h3>
                <button className="btn btn-primary" onClick={() => setShowAddSurfaceModal(true)}>
                  <Plus size={16} /> Add Surface
                </button>
              </div>

              {selectedAssessment.surfaces.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                  <Layers size={32} style={{ margin: '0 auto 0.5rem', color: 'var(--text-secondary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>No surfaces defined. Add rooftop or ground areas.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Area (m²)</th>
                        <th>Usable (m²)</th>
                        <th>Tilt</th>
                        <th>Azimuth</th>
                        <th>Shading</th>
                        <th>Max kW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAssessment.surfaces.map(surface => (
                        <tr key={surface.id}>
                          <td style={{ fontWeight: '500' }}>{surface.name}</td>
                          <td>
                            <span className={`badge ${surface.surface_type === 'rooftop' ? 'badge-info' : 'badge-success'}`}>
                              {surface.surface_type}
                            </span>
                          </td>
                          <td>{surface.area_sqm}</td>
                          <td>{surface.usable_area_sqm?.toFixed(0) || '-'}</td>
                          <td>{surface.tilt_degrees}°</td>
                          <td>{surface.azimuth_degrees}°</td>
                          <td>{surface.shading_percent}%</td>
                          <td style={{ fontWeight: '600', color: 'var(--primary)' }}>
                            {surface.max_capacity_kw?.toFixed(1) || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setActiveTab('design')}
                  disabled={selectedAssessment.surfaces.length === 0}
                >
                  <Calculator size={16} /> Design System
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'modules' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600' }}>PV Module Catalog</h3>
            {selectedModule && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={16} color="var(--primary)" />
                <span>Selected: {selectedModule.model_name}</span>
                <button onClick={() => setSelectedModule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {modulesLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading modules...</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Power</th>
                    <th>Efficiency</th>
                    <th>Size (mm)</th>
                    <th>Cell Type</th>
                    <th>Warranty</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module: PVModule) => (
                    <tr key={module.id} style={{ background: selectedModule?.id === module.id ? 'rgba(16, 185, 129, 0.1)' : undefined }}>
                      <td style={{ fontWeight: '500' }}>{module.manufacturer}</td>
                      <td>{module.model_name}</td>
                      <td style={{ fontWeight: '600' }}>{module.power_rating_w} W</td>
                      <td>{module.efficiency_percent.toFixed(1)}%</td>
                      <td style={{ fontSize: '0.875rem' }}>{module.width_mm} x {module.height_mm}</td>
                      <td>
                        <span className="badge badge-info">{module.cell_type}</span>
                      </td>
                      <td>{module.warranty_years} yrs</td>
                      <td>{module.price_usd ? `$${module.price_usd}` : '-'}</td>
                      <td>
                        <button
                          className={`btn ${selectedModule?.id === module.id ? 'btn-success' : 'btn-primary'} btn-sm`}
                          onClick={() => setSelectedModule(selectedModule?.id === module.id ? null : module)}
                        >
                          {selectedModule?.id === module.id ? <Check size={14} /> : 'Select'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'design' && (
        <div>
          {!selectedAssessment ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <MapPin size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
              <h4 style={{ marginBottom: '0.5rem' }}>No assessment selected</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Select a site assessment from the Assessments tab first
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('assessments')}>
                <ChevronRight size={16} /> Go to Assessments
              </button>
            </div>
          ) : (
            <>
              <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} />
                <span>Designing for: <strong>{selectedAssessment.name}</strong> ({totalUsableArea.toFixed(0)} m² usable, max {maxCapacity.toFixed(0)} kW)</span>
                {selectedModule && (
                  <>
                    <span style={{ margin: '0 0.5rem' }}>|</span>
                    <Sun size={16} />
                    <span>Module: <strong>{selectedModule.model_name}</strong> ({selectedModule.power_rating_w}W)</span>
                  </>
                )}
              </div>

              <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>System Configuration</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Target Capacity (kW)</label>
                    <input
                      type="number"
                      value={designParams.target_capacity_kw}
                      onChange={(e) => setDesignParams({ ...designParams, target_capacity_kw: Number(e.target.value) })}
                      max={maxCapacity}
                    />
                    <small style={{ color: 'var(--text-secondary)' }}>Max available: {maxCapacity.toFixed(0)} kW</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Self-Consumption (%)</label>
                    <input
                      type="number"
                      value={designParams.self_consumption_percent}
                      onChange={(e) => setDesignParams({ ...designParams, self_consumption_percent: Number(e.target.value) })}
                      min={0}
                      max={100}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Analysis Period (Years)</label>
                    <input
                      type="number"
                      value={designParams.analysis_years}
                      onChange={(e) => setDesignParams({ ...designParams, analysis_years: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Financial Parameters</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Electricity Rate ($/kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={designParams.electricity_rate}
                      onChange={(e) => setDesignParams({ ...designParams, electricity_rate: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Export Rate ($/kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={designParams.export_rate}
                      onChange={(e) => setDesignParams({ ...designParams, export_rate: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CAPEX ($/kW)</label>
                    <input
                      type="number"
                      value={designParams.capex_per_kw}
                      onChange={(e) => setDesignParams({ ...designParams, capex_per_kw: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Discount Rate (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={Math.round(designParams.discount_rate * 100)}
                      onChange={(e) => setDesignParams({ ...designParams, discount_rate: Number(e.target.value) / 100 })}
                    />
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => calculateDesignMutation.mutate()}
                  disabled={calculateDesignMutation.isPending || selectedAssessment.surfaces.length === 0}
                >
                  <Calculator size={18} />
                  {calculateDesignMutation.isPending ? 'Calculating...' : 'Calculate Design & ROI'}
                </button>
                {calculateDesignMutation.isError && (
                  <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
                    Error: {(calculateDesignMutation.error as Error).message}
                  </div>
                )}
              </div>

              {designResult && (
                <div>
                  <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
                    <div className="card stat-card">
                      <Sun size={32} color="var(--warning)" />
                      <div className="stat-value">{designResult.system_capacity_kw.toFixed(1)} kW</div>
                      <div className="stat-label">{designResult.num_panels} Panels</div>
                    </div>
                    <div className="card stat-card">
                      <TrendingUp size={32} color="var(--primary)" />
                      <div className="stat-value" style={{ color: 'var(--primary)' }}>
                        ${designResult.annual_savings?.toLocaleString() || 0}
                      </div>
                      <div className="stat-label">Annual Savings</div>
                    </div>
                    <div className="card stat-card">
                      <DollarSign size={32} color={designResult.npv && designResult.npv > 0 ? 'var(--primary)' : 'var(--danger)'} />
                      <div className="stat-value" style={{ color: designResult.npv && designResult.npv > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                        ${Math.abs(designResult.npv || 0).toLocaleString()}
                      </div>
                      <div className="stat-label">NPV</div>
                    </div>
                    <div className="card stat-card">
                      <Leaf size={32} color="var(--primary)" />
                      <div className="stat-value">{designResult.co2_avoided_tons?.toFixed(1) || 0}</div>
                      <div className="stat-label">CO₂ Avoided (t/yr)</div>
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div className="card">
                      <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Financial Summary</h3>
                      <div className="grid grid-2" style={{ gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total CAPEX</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            ${designResult.total_capex?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Payback Period</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {designResult.payback_years?.toFixed(1) || '-'} years
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>IRR</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {designResult.irr ? `${(designResult.irr * 100).toFixed(1)}%` : '-'}
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LCOE</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            ${designResult.lcoe?.toFixed(3) || '-'}/kWh
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Production & Consumption</h3>
                      <div className="grid grid-2" style={{ gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--primary)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Annual Production</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {designResult.annual_production_kwh?.toLocaleString() || 0} kWh
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--warning)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Capacity Factor</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                            {((designResult.capacity_factor || 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Self-Consumed</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {designResult.self_consumption_percent}%
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--surface-bg)', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Exported</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {designResult.export_percent}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cumulative Cash Flow</h3>
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generateCashFlowData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} label={{ value: 'Year', position: 'bottom', fill: 'var(--text-secondary)' }} />
                          <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']} 
                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                          />
                          <Line type="monotone" dataKey="cumulative" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} name="Cumulative" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {scenarios.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Previous Scenarios</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Capacity</th>
                          <th>Panels</th>
                          <th>Annual Production</th>
                          <th>Annual Savings</th>
                          <th>NPV</th>
                          <th>Payback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scenarios.map((scenario: PVDesignScenario) => (
                          <tr key={scenario.id}>
                            <td style={{ fontWeight: '500' }}>{scenario.name}</td>
                            <td>{scenario.system_capacity_kw.toFixed(1)} kW</td>
                            <td>{scenario.num_panels}</td>
                            <td>{scenario.annual_production_kwh?.toLocaleString() || '-'} kWh</td>
                            <td style={{ color: 'var(--primary)' }}>${scenario.annual_savings?.toLocaleString() || '-'}</td>
                            <td style={{ color: scenario.npv && scenario.npv > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                              ${scenario.npv?.toLocaleString() || '-'}
                            </td>
                            <td>{scenario.payback_years?.toFixed(1) || '-'} yrs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showNewAssessmentModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '600' }}>New Site Assessment</h3>
              <button onClick={() => setShowNewAssessmentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Assessment Name *</label>
              <input
                type="text"
                value={newAssessment.name}
                onChange={(e) => setNewAssessment({ ...newAssessment, name: e.target.value })}
                placeholder="e.g., Building A Rooftop"
              />
            </div>

            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newAssessment.latitude || ''}
                  onChange={(e) => setNewAssessment({ ...newAssessment, latitude: Number(e.target.value) })}
                  placeholder="e.g., 40.7128"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newAssessment.longitude || ''}
                  onChange={(e) => setNewAssessment({ ...newAssessment, longitude: Number(e.target.value) })}
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={newAssessment.notes}
                onChange={(e) => setNewAssessment({ ...newAssessment, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowNewAssessmentModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => createAssessmentMutation.mutate()}
                disabled={!newAssessment.name || createAssessmentMutation.isPending}
              >
                {createAssessmentMutation.isPending ? 'Creating...' : 'Create Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSurfaceModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '600' }}>Add Surface</h3>
              <button onClick={() => setShowAddSurfaceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Surface Name *</label>
              <input
                type="text"
                value={newSurface.name}
                onChange={(e) => setNewSurface({ ...newSurface, name: e.target.value })}
                placeholder="e.g., Main Rooftop"
              />
            </div>

            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  value={newSurface.surface_type}
                  onChange={(e) => setNewSurface({ ...newSurface, surface_type: e.target.value })}
                >
                  <option value="rooftop">Rooftop</option>
                  <option value="ground">Ground Mount</option>
                  <option value="carport">Carport</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Area (m²) *</label>
                <input
                  type="number"
                  value={newSurface.area_sqm}
                  onChange={(e) => setNewSurface({ ...newSurface, area_sqm: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-3" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tilt (°)</label>
                <input
                  type="number"
                  value={newSurface.tilt_degrees}
                  onChange={(e) => setNewSurface({ ...newSurface, tilt_degrees: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Azimuth (°)</label>
                <input
                  type="number"
                  value={newSurface.azimuth_degrees}
                  onChange={(e) => setNewSurface({ ...newSurface, azimuth_degrees: Number(e.target.value) })}
                />
                <small style={{ color: 'var(--text-secondary)' }}>180° = South</small>
              </div>
              <div className="form-group">
                <label className="form-label">Shading (%)</label>
                <input
                  type="number"
                  value={newSurface.shading_percent}
                  onChange={(e) => setNewSurface({ ...newSurface, shading_percent: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowAddSurfaceModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => addSurfaceMutation.mutate()}
                disabled={!newSurface.name || !newSurface.area_sqm || addSurfaceMutation.isPending}
              >
                {addSurfaceMutation.isPending ? 'Adding...' : 'Add Surface'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
