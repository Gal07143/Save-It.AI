/**
 * Site Comparison Page
 * Compare metrics across multiple sites with charts and data export.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, Site } from '../services/api'
import { dashboardDataService, DateRange } from '../services/dashboardData'
import DateRangePicker from '../components/DateRangePicker'
import QueryError from '../components/QueryError'
import {
  Building2, BarChart3, Download, Plus, X, TrendingUp, TrendingDown,
  Zap, DollarSign, Leaf, Activity, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts'

// Metric options for comparison
const METRICS = [
  { id: 'consumption', name: 'Energy Consumption', unit: 'kWh', icon: Zap, color: '#6366f1' },
  { id: 'cost', name: 'Energy Cost', unit: '$', icon: DollarSign, color: '#10b981' },
  { id: 'efficiency', name: 'Efficiency Score', unit: '%', icon: Activity, color: '#f59e0b' },
  { id: 'power_factor', name: 'Power Factor', unit: '', icon: TrendingUp, color: '#8b5cf6' },
  { id: 'co2', name: 'CO2 Emissions', unit: 'kg', icon: Leaf, color: '#ef4444' },
]

// Chart colors for different sites
const SITE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function getDefaultDateRange(): DateRange {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return { start, end }
}

interface SiteComparisonData {
  siteId: number
  siteName: string
  consumption: number
  cost: number
  efficiency: number
  powerFactor: number
  co2: number
}

export default function SiteComparison() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange())
  const [selectedSites, setSelectedSites] = useState<number[]>([])
  const [selectedMetric, setSelectedMetric] = useState('consumption')
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [showSiteSelector, setShowSiteSelector] = useState(false)

  // Fetch all sites
  const { data: sites, isLoading: sitesLoading, isError: sitesError, refetch: refetchSites } = useQuery({
    queryKey: ['sites'],
    queryFn: api.sites.list,
  })

  // Fetch comparison data for selected sites
  const { data: comparisonData, isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: ['siteComparison', selectedSites, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<SiteComparisonData[]> => {
      if (selectedSites.length === 0) return []

      const results: SiteComparisonData[] = []

      for (const siteId of selectedSites) {
        try {
          const [kpis, site] = await Promise.all([
            dashboardDataService.fetchSiteKPIs(siteId, dateRange),
            sites?.find(s => s.id === siteId),
          ])

          results.push({
            siteId,
            siteName: site?.name || `Site ${siteId}`,
            consumption: kpis.ytdConsumption,
            cost: kpis.ytdCost,
            efficiency: kpis.efficiencyScore,
            powerFactor: 0.94, // Would come from real data
            co2: Math.round(kpis.ytdConsumption * 0.4), // Estimate CO2
          })
        } catch (error) {
          console.error(`Failed to fetch data for site ${siteId}:`, error)
        }
      }

      return results
    },
    enabled: selectedSites.length > 0 && !!sites,
  })

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!comparisonData) return []

    return comparisonData.map((data, index) => ({
      name: data.siteName,
      value: data[selectedMetric as keyof SiteComparisonData] as number,
      fill: SITE_COLORS[index % SITE_COLORS.length],
    }))
  }, [comparisonData, selectedMetric])

  // Calculate comparison stats
  const stats = useMemo(() => {
    if (!comparisonData || comparisonData.length === 0) return null

    const values = comparisonData.map(d => d[selectedMetric as keyof SiteComparisonData] as number)
    const total = values.reduce((a, b) => a + b, 0)
    const avg = total / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const minSite = comparisonData.find(d => (d[selectedMetric as keyof SiteComparisonData] as number) === min)
    const maxSite = comparisonData.find(d => (d[selectedMetric as keyof SiteComparisonData] as number) === max)

    return { total, avg, min, max, minSite, maxSite }
  }, [comparisonData, selectedMetric])

  const handleAddSite = (siteId: number) => {
    if (selectedSites.length < 5 && !selectedSites.includes(siteId)) {
      setSelectedSites([...selectedSites, siteId])
    }
    setShowSiteSelector(false)
  }

  const handleRemoveSite = (siteId: number) => {
    setSelectedSites(selectedSites.filter(id => id !== siteId))
  }

  const handleExport = (format: 'csv' | 'json') => {
    if (!comparisonData) return

    if (format === 'csv') {
      const headers = ['Site Name', 'Consumption (kWh)', 'Cost ($)', 'Efficiency (%)', 'Power Factor', 'CO2 (kg)']
      const rows = comparisonData.map(d => [
        d.siteName,
        d.consumption,
        d.cost,
        d.efficiency,
        d.powerFactor,
        d.co2,
      ])

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `site-comparison-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } else {
      const json = JSON.stringify(comparisonData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `site-comparison-${new Date().toISOString().split('T')[0]}.json`
      a.click()
    }
  }

  const currentMetric = METRICS.find(m => m.id === selectedMetric)

  if (sitesError) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Site Comparison</h1>
        <QueryError message="Failed to load sites" onRetry={() => refetchSites()} />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3 size={28} />
            Site Comparison
          </h1>
          <p className="page-subtitle">Compare energy metrics across multiple sites</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={() => handleExport('csv')}
              disabled={!comparisonData || comparisonData.length === 0}
            >
              <Download size={18} />
              CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport('json')}
              disabled={!comparisonData || comparisonData.length === 0}
            >
              <Download size={18} />
              JSON
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            <Building2 size={18} style={{ marginRight: '0.5rem' }} />
            Selected Sites ({selectedSites.length}/5)
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {selectedSites.map((siteId, index) => {
              const site = sites?.find(s => s.id === siteId)
              return (
                <div
                  key={siteId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: `${SITE_COLORS[index]}20`,
                    border: `1px solid ${SITE_COLORS[index]}`,
                    borderRadius: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: SITE_COLORS[index],
                    }}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                    {site?.name || `Site ${siteId}`}
                  </span>
                  <button
                    onClick={() => handleRemoveSite(siteId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.125rem',
                      color: '#64748b',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}

            {selectedSites.length < 5 && (
              <button
                onClick={() => setShowSiteSelector(true)}
                className="btn btn-outline"
                style={{ padding: '0.5rem 0.75rem' }}
              >
                <Plus size={16} />
                Add Site
              </button>
            )}
          </div>

          {selectedSites.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <Building2 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Select sites to compare their metrics</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Comparison Metric
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {METRICS.map(metric => {
              const Icon = metric.icon
              return (
                <button
                  key={metric.id}
                  onClick={() => setSelectedMetric(metric.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: selectedMetric === metric.id ? `${metric.color}20` : 'transparent',
                    border: `1px solid ${selectedMetric === metric.id ? metric.color : '#334155'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    color: selectedMetric === metric.id ? '#f1f5f9' : '#94a3b8',
                    textAlign: 'left',
                  }}
                >
                  <Icon size={18} color={metric.color} />
                  <span style={{ fontSize: '0.875rem' }}>{metric.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {selectedSites.length > 0 && (
        <>
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
              <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', border: 'none' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {currentMetric?.unit === '$' ? '$' : ''}{stats.total.toLocaleString()}{currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}
                </div>
              </div>
              <div className="card" style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', border: 'none' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Average</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {currentMetric?.unit === '$' ? '$' : ''}{Math.round(stats.avg).toLocaleString()}{currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  <TrendingDown size={14} style={{ marginRight: '0.25rem' }} />
                  Lowest
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                  {stats.minSite?.siteName}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {currentMetric?.unit === '$' ? '$' : ''}{stats.min.toLocaleString()}{currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  <TrendingUp size={14} style={{ marginRight: '0.25rem' }} />
                  Highest
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {stats.maxSite?.siteName}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {currentMetric?.unit === '$' ? '$' : ''}{stats.max.toLocaleString()}{currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">
                {currentMetric?.name} Comparison
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartType('bar')}
                  style={{ padding: '0.375rem 0.75rem' }}
                >
                  Bar
                </button>
                <button
                  className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setChartType('line')}
                  style={{ padding: '0.375rem 0.75rem' }}
                >
                  Line
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => refetchData()}
                  style={{ padding: '0.375rem' }}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div style={{ height: '350px' }}>
              {dataLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  <RefreshCw className="spinning" size={24} />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                        formatter={(value: number) => [`${currentMetric?.unit === '$' ? '$' : ''}${value.toLocaleString()}${currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}`, currentMetric?.name]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Bar key={index} dataKey="value" fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                        formatter={(value: number) => [`${currentMetric?.unit === '$' ? '$' : ''}${value.toLocaleString()}${currentMetric?.unit && currentMetric.unit !== '$' ? ` ${currentMetric.unit}` : ''}`, currentMetric?.name]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={currentMetric?.color || '#6366f1'}
                        strokeWidth={2}
                        dot={{ fill: currentMetric?.color || '#6366f1', r: 6 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
              Detailed Comparison
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>Site</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>Consumption (kWh)</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>Cost ($)</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>Efficiency</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>Power Factor</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155', color: '#64748b' }}>CO2 (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData?.map((data, index) => (
                    <tr key={data.siteId}>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: SITE_COLORS[index],
                            }}
                          />
                          {data.siteName}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        {data.consumption.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        ${data.cost.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          background: data.efficiency >= 80 ? 'rgba(16, 185, 129, 0.2)' : data.efficiency >= 60 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: data.efficiency >= 80 ? '#10b981' : data.efficiency >= 60 ? '#f59e0b' : '#ef4444',
                        }}>
                          {data.efficiency}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        {data.powerFactor.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                        {data.co2.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Site Selector Modal */}
      {showSiteSelector && (
        <div className="modal-overlay" onClick={() => setShowSiteSelector(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Select Site</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSiteSelector(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {sitesLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <RefreshCw className="spinning" size={24} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sites?.filter(s => !selectedSites.includes(s.id)).map(site => (
                    <button
                      key={site.id}
                      onClick={() => handleAddSite(site.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#f1f5f9',
                      }}
                    >
                      <Building2 size={20} color="#64748b" />
                      <div>
                        <div style={{ fontWeight: 500 }}>{site.name}</div>
                        {site.address && (
                          <div style={{ fontSize: '0.813rem', color: '#64748b' }}>{site.address}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  {sites?.filter(s => !selectedSites.includes(s.id)).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      All sites have been selected
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
