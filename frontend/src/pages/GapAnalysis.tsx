import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, GapAnalysisResult } from '../services/api'
import { Search, AlertTriangle, CheckCircle, Target, Map, Lightbulb, DollarSign, BarChart3, ClipboardList } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import TabPanel, { Tab } from '../components/TabPanel'

interface GapAnalysisProps {
  currentSite?: number | null
}

export default function GapAnalysis({ currentSite: _propSite }: GapAnalysisProps) {
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

  const tabs: Tab[] = [
    { id: 'unmetered', label: 'Unmetered Nodes', icon: AlertTriangle, badge: result?.unmetered_assets },
    { id: 'coverage', label: 'Coverage Map', icon: Map },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, badge: result?.recommendations?.length },
    { id: 'cost', label: 'Cost Estimate', icon: DollarSign },
    { id: 'priority', label: 'Priority Ranking', icon: BarChart3 },
    { id: 'action', label: 'Action Plan', icon: ClipboardList },
  ]

  const renderTabContent = (activeTab: string) => {
    if (!result) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Search size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Run Gap Analysis</h3>
          <p style={{ color: '#64748b' }}>Select a site and run analysis to view {activeTab === 'unmetered' ? 'unmetered nodes' : activeTab === 'coverage' ? 'coverage map' : activeTab === 'recommendations' ? 'recommendations' : activeTab === 'cost' ? 'cost estimates' : activeTab === 'priority' ? 'priority rankings' : 'action plan'}</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'unmetered':
        return (
          <>
            {result.unmetered_asset_list.length > 0 ? (
              <div className="card">
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
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ marginBottom: '0.5rem' }}>All Assets Metered</h3>
                <p style={{ color: '#64748b' }}>No unmetered nodes detected in this site</p>
              </div>
            )}
          </>
        )

      case 'coverage':
        return (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Metering Coverage</h3>
            </div>
            <div style={{ height: '300px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', padding: '1rem', borderTop: '1px solid #334155' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{result.metered_assets}</div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Metered</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{result.unmetered_assets}</div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Unmetered</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{result.coverage_percentage.toFixed(1)}%</div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Coverage</div>
              </div>
            </div>
          </div>
        )

      case 'recommendations':
        return (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Meter Placement Recommendations</h3>
            </div>
            {result.recommendations.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {result.recommendations.map((rec, i) => (
                  <li key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '0.5rem',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid #334155',
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
        )

      case 'cost':
        return (
          <div className="card" style={{ padding: '2rem' }}>
            <div className="card-header">
              <h3 className="card-title">Gap Closure Cost Estimate</h3>
            </div>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <DollarSign size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
              <h4 style={{ marginBottom: '0.5rem' }}>Estimated Costs</h4>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Based on {result.unmetered_assets} unmetered assets</p>
              <div className="grid grid-3" style={{ gap: '1rem' }}>
                <div className="card" style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                    ${(result.unmetered_assets * 150).toLocaleString()}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Hardware Cost</div>
                </div>
                <div className="card" style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6' }}>
                    ${(result.unmetered_assets * 75).toLocaleString()}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Installation</div>
                </div>
                <div className="card" style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    ${(result.unmetered_assets * 225).toLocaleString()}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Estimate</div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'priority':
        return (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Priority Ranking</h3>
            </div>
            {result.unmetered_asset_list.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Priority Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.unmetered_asset_list]
                    .sort((a, b) => (b.is_critical ? 1 : 0) - (a.is_critical ? 1 : 0))
                    .map((asset, index) => (
                      <tr key={asset.asset_id}>
                        <td>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: index < 3 ? '#ef4444' : index < 6 ? '#f59e0b' : '#64748b',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{asset.asset_name}</td>
                        <td><span className="badge badge-info">{asset.asset_type}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ 
                              width: '60px', 
                              height: '8px', 
                              background: '#1e293b', 
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{ 
                                width: `${asset.is_critical ? 90 : 50}%`, 
                                height: '100%', 
                                background: asset.is_critical ? '#ef4444' : '#f59e0b',
                                borderRadius: '4px'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {asset.is_critical ? 'High' : 'Medium'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {asset.is_critical ? (
                            <span className="badge badge-danger">Critical</span>
                          ) : (
                            <span className="badge badge-warning">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                No gaps to prioritize - full coverage achieved!
              </p>
            )}
          </div>
        )

      case 'action':
        return (
          <div className="card" style={{ padding: '2rem' }}>
            <div className="card-header">
              <h3 className="card-title">Implementation Timeline</h3>
            </div>
            <div style={{ padding: '1rem 0' }}>
              {result.unmetered_assets > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: '#10b981', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>1</span>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>Week 1-2: Procurement</h4>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Order {result.unmetered_assets} meters and required hardware</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: '#3b82f6', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>2</span>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>Week 3-4: Critical Installations</h4>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Install meters on {result.critical_unmetered_count} critical assets first</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: '#f59e0b', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>3</span>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>Week 5-6: Remaining Installations</h4>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Complete installation of {result.unmetered_assets - result.critical_unmetered_count} standard priority meters</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: '#8b5cf6', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>4</span>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>Week 7: Verification & Testing</h4>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Verify all meter connections and data flow</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                  <h4 style={{ marginBottom: '0.5rem' }}>No Action Required</h4>
                  <p style={{ color: '#64748b' }}>All assets are fully metered</p>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

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
      )}

      <TabPanel tabs={tabs} variant="underline">
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
