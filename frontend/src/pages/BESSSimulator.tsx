import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, BESSSimulationResult } from '../services/api'
import { Battery, Play, Download, TrendingUp, DollarSign, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

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

export default function BESSSimulator() {
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

  const simulationMutation = useMutation({
    mutationFn: api.analysis.bessSimulation,
    onSuccess: setResult,
  })

  const runSimulation = () => {
    simulationMutation.mutate({
      ...params,
      load_profile_kwh: generateSampleLoadProfile(),
      tariff_rates: generateSampleTariff(),
      demand_charges: [15, 15, 15, 12, 12, 18, 20, 20, 18, 15, 15, 15],
    })
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          <Battery size={24} style={{ display: 'inline', marginRight: '0.5rem' }} />
          BESS Financial Simulator
        </h1>
        <p style={{ color: '#64748b' }}>Analyze battery energy storage system ROI with TOU arbitrage and peak shaving</p>
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
              step="0.01"
              value={params.round_trip_efficiency * 100}
              onChange={(e) => setParams({ ...params, round_trip_efficiency: Number(e.target.value) / 100 })}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Depth of Discharge (%)</label>
            <input
              type="number"
              step="0.01"
              value={params.depth_of_discharge * 100}
              onChange={(e) => setParams({ ...params, depth_of_discharge: Number(e.target.value) / 100 })}
            />
          </div>
        </div>

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
              step="0.01"
              value={params.discount_rate * 100}
              onChange={(e) => setParams({ ...params, discount_rate: Number(e.target.value) / 100 })}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Degradation Rate (%/year)</label>
            <input
              type="number"
              step="0.01"
              value={params.degradation_rate * 100}
              onChange={(e) => setParams({ ...params, degradation_rate: Number(e.target.value) / 100 })}
            />
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Run Simulation</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            The simulation will use sample load profile and TOU tariff data (8760 hourly values).
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={runSimulation}
            disabled={simulationMutation.isPending}
          >
            <Play size={18} />
            {simulationMutation.isPending ? 'Running Simulation...' : 'Run BESS Simulation'}
          </button>
          
          {simulationMutation.isError && (
            <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
              Error: {(simulationMutation.error as Error).message}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <DollarSign size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
              <div className="stat-value" style={{ color: '#10b981' }}>
                ${result.total_savings_year1.toLocaleString()}
              </div>
              <div className="stat-label">Year 1 Savings</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <Clock size={32} color="#1e40af" style={{ margin: '0 auto 0.5rem' }} />
              <div className="stat-value">
                {result.simple_payback_years.toFixed(1)} yrs
              </div>
              <div className="stat-label">Simple Payback</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <TrendingUp size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
              <div className="stat-value" style={{ color: result.net_present_value > 0 ? '#10b981' : '#ef4444' }}>
                ${Math.abs(result.net_present_value).toLocaleString()}
              </div>
              <div className="stat-label">NPV</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <TrendingUp size={32} color="#1e40af" style={{ margin: '0 auto 0.5rem' }} />
              <div className="stat-value">
                {result.internal_rate_of_return ? `${result.internal_rate_of_return.toFixed(1)}%` : 'N/A'}
              </div>
              <div className="stat-label">IRR</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Savings Breakdown (Year 1)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    ${result.arbitrage_savings_year1.toLocaleString()}
                  </div>
                  <div style={{ color: '#166534' }}>TOU Arbitrage</div>
                </div>
                <div style={{ padding: '1rem', background: '#dbeafe', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                    ${result.peak_shaving_savings_year1.toLocaleString()}
                  </div>
                  <div style={{ color: '#1e3a8a' }}>Peak Shaving</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Monthly Peak Reduction (kW)</h3>
              </div>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.monthly_peak_reduction.map((v, i) => ({ 
                    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], 
                    reduction: v 
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reduction" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Cumulative Cash Flow</h3>
            </div>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[{ year: 0, cumulative: -params.capex }, ...result.annual_projections]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cumulative']} />
                  <Line type="monotone" dataKey="cumulative" stroke="#1e40af" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
