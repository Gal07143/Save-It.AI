import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, GapAnalysisResult } from '../services/api'
import { Search, AlertTriangle, CheckCircle, Target } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export default function GapAnalysis() {
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  const [result, setResult] = useState<GapAnalysisResult | null>(null)

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const analysisMutation = useMutation({
    mutationFn: api.analysis.gapAnalysis,
    onSuccess: setResult,
  })

  const runAnalysis = () => {
    if (selectedSite) {
      analysisMutation.mutate(selectedSite)
    }
  }

  const pieData = result ? [
    { name: 'Metered', value: result.metered_assets, color: '#10b981' },
    { name: 'Unmetered', value: result.unmetered_assets, color: '#f59e0b' },
  ] : []

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          <Search size={24} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Gap Analysis
        </h1>
        <p style={{ color: '#64748b' }}>Identify unmetered assets in your electrical network</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Select Site</label>
            <select
              value={selectedSite || ''}
              onChange={(e) => setSelectedSite(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a site...</option>
              {sites?.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={!selectedSite || analysisMutation.isPending}
          >
            <Target size={18} />
            {analysisMutation.isPending ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-value">{result.total_assets}</div>
              <div className="stat-label">Total Assets</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-value" style={{ color: '#10b981' }}>{result.metered_assets}</div>
              <div className="stat-label">Metered</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{result.unmetered_assets}</div>
              <div className="stat-label">Unmetered</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-value">{result.coverage_percentage.toFixed(1)}%</div>
              <div className="stat-label">Coverage</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Metering Coverage</h3>
              </div>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recommendations</h3>
              </div>
              {result.recommendations.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {result.recommendations.map((rec, i) => (
                    <li key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.5rem',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                  No recommendations - all critical assets are metered!
                </p>
              )}
            </div>
          </div>

          {result.unmetered_asset_list.length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Unmetered Assets</h3>
                {result.critical_unmetered_count > 0 && (
                  <span className="badge badge-danger">
                    {result.critical_unmetered_count} Critical
                  </span>
                )}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Parent</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmetered_asset_list.map((asset) => (
                    <tr key={asset.asset_id}>
                      <td style={{ fontWeight: 500 }}>{asset.asset_name}</td>
                      <td>
                        <span className="badge badge-info">{asset.asset_type}</span>
                      </td>
                      <td style={{ color: '#64748b' }}>{asset.parent_name || '-'}</td>
                      <td>
                        {asset.is_critical ? (
                          <span className="badge badge-danger">
                            <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} />
                            Critical
                          </span>
                        ) : (
                          <span className="badge badge-warning">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!result && !analysisMutation.isPending && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Search size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Run Gap Analysis</h3>
          <p style={{ color: '#64748b' }}>Select a site and run analysis to find unmetered assets</p>
        </div>
      )}
    </div>
  )
}
