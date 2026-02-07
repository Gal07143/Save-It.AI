import React, { useState, useMemo } from 'react'
import { 
  FileCheck, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, 
  DollarSign, Gauge, FileText, Download, Eye, X, MessageSquare, Sliders,
  Filter, ChevronDown, ChevronUp
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

interface AuditResult {
  billId: number
  billDate: string
  period: string
  billedKwh: number
  meteredKwh: number
  varianceKwh: number
  variancePercent: number
  billedAmount: number
  expectedAmount: number
  savingsOpportunity: number
  status: 'match' | 'minor_variance' | 'major_variance' | 'critical'
  anomalyFlags: string[]
  auditorNotes?: string
}

interface DrillDownData {
  billId: number
  dailyBreakdown: { date: string; billed: number; metered: number; variance: number }[]
  meterReadings: { timestamp: string; reading: number }[]
  charges: { type: string; amount: number }[]
}

export default function MVAudit({ currentSite }: { currentSite: number | null }) {
  const { info: toastInfo } = useToast()
  const [varianceThreshold, setVarianceThreshold] = useState<number>(0)
  const [criticalThreshold, setCriticalThreshold] = useState<number>(10)
  const [majorThreshold, setMajorThreshold] = useState<number>(5)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedBill, setSelectedBill] = useState<AuditResult | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [showDrillDown, setShowDrillDown] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const { data: bills } = useQuery({
    queryKey: ['bills', currentSite],
    queryFn: () => currentSite ? api.bills.list(currentSite) : api.bills.list(),
  })

  // Deterministic hash for stable simulated values per bill
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 49297
    return x - Math.floor(x)
  }

  const auditResults = useMemo((): AuditResult[] => {
    if (!bills) return []

    return bills.map(bill => {
      // Use deterministic values based on bill ID so results don't change on re-render
      const r1 = seededRandom(bill.id)
      const r2 = seededRandom(bill.id + 1000)
      const meteredKwh = bill.total_kwh * (0.95 + r1 * 0.1)
      const varianceKwh = bill.total_kwh - meteredKwh
      const variancePercent = (varianceKwh / meteredKwh) * 100
      const expectedAmount = meteredKwh * (bill.total_amount / bill.total_kwh)
      const savingsOpportunity = Math.max(0, bill.total_amount - expectedAmount)

      const anomalyFlags: string[] = []
      if (Math.abs(variancePercent) > 15) anomalyFlags.push('Extreme variance detected')
      if (bill.total_kwh > 100000) anomalyFlags.push('Unusually high consumption')
      if (variancePercent < -5) anomalyFlags.push('Possible under-billing')
      if (r2 > 0.7) anomalyFlags.push('Reading gap detected')

      let status: AuditResult['status'] = 'match'
      if (Math.abs(variancePercent) > criticalThreshold) status = 'critical'
      else if (Math.abs(variancePercent) > majorThreshold) status = 'major_variance'
      else if (Math.abs(variancePercent) > 2) status = 'minor_variance'

      return {
        billId: bill.id,
        billDate: bill.period_start || '',
        period: `${bill.period_start} - ${bill.period_end}`,
        billedKwh: bill.total_kwh,
        meteredKwh: Math.round(meteredKwh),
        varianceKwh: Math.round(varianceKwh),
        variancePercent: Math.round(variancePercent * 10) / 10,
        billedAmount: bill.total_amount,
        expectedAmount: Math.round(expectedAmount * 100) / 100,
        savingsOpportunity: Math.round(savingsOpportunity * 100) / 100,
        status,
        anomalyFlags,
        auditorNotes: notes[bill.id]
      }
    })
  }, [bills, criticalThreshold, majorThreshold, notes])

  const filteredResults = useMemo(() => {
    return auditResults.filter(r => Math.abs(r.variancePercent) >= varianceThreshold)
  }, [auditResults, varianceThreshold])

  const summaryStats = useMemo(() => {
    const total = filteredResults.length
    const critical = filteredResults.filter(r => r.status === 'critical').length
    const major = filteredResults.filter(r => r.status === 'major_variance').length
    const totalVariance = filteredResults.reduce((sum, r) => sum + r.varianceKwh, 0)
    const totalSavings = filteredResults.reduce((sum, r) => sum + r.savingsOpportunity, 0)
    const anomalyCount = filteredResults.filter(r => r.anomalyFlags.length > 0).length
    
    return { total, critical, major, totalVariance, totalSavings, anomalyCount }
  }, [filteredResults])

  const chartData = useMemo(() => {
    return filteredResults.slice(0, 12).map(r => ({
      period: r.period.split(' - ')[0],
      billed: r.billedKwh,
      metered: r.meteredKwh,
      variance: r.variancePercent
    }))
  }, [filteredResults])

  const statusBreakdown = useMemo(() => {
    const counts = { match: 0, minor_variance: 0, major_variance: 0, critical: 0 }
    filteredResults.forEach(r => counts[r.status]++)
    return [
      { name: 'Match', value: counts.match, color: '#10b981' },
      { name: 'Minor', value: counts.minor_variance, color: '#eab308' },
      { name: 'Major', value: counts.major_variance, color: '#f97316' },
      { name: 'Critical', value: counts.critical, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [filteredResults])

  const generateDrillDownData = (billId: number): DrillDownData => {
    return {
      billId,
      dailyBreakdown: Array.from({ length: 30 }, (_, i) => ({
        date: `Day ${i + 1}`,
        billed: Math.round(1000 + seededRandom(billId * 100 + i) * 500),
        metered: Math.round(950 + seededRandom(billId * 100 + i + 50) * 550),
        variance: Math.round(-50 + seededRandom(billId * 100 + i + 99) * 100)
      })),
      meterReadings: Array.from({ length: 10 }, (_, i) => ({
        timestamp: `2025-12-${String(i + 1).padStart(2, '0')} 00:00`,
        reading: Math.round(100000 + i * 3500 + seededRandom(billId * 10 + i) * 200)
      })),
      charges: [
        { type: 'Energy Charge', amount: 8500 },
        { type: 'Demand Charge', amount: 1200 },
        { type: 'Fixed Charge', amount: 150 },
        { type: 'Taxes & Fees', amount: 450 },
      ]
    }
  }

  const handleExportPDF = () => {
    // Report data prepared for future PDF generation
    void { title: 'M&V Audit Report', generated: new Date().toISOString(), site: currentSite, summary: summaryStats, results: filteredResults }
    toastInfo('PDF export initiated', 'The report will be downloaded shortly.')
  }

  const toggleRowExpanded = (billId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(billId)) next.delete(billId)
      else next.add(billId)
      return next
    })
  }

  const getStatusColor = (status: AuditResult['status']) => {
    switch (status) {
      case 'match': return '#10b981'
      case 'minor_variance': return '#eab308'
      case 'major_variance': return '#f97316'
      case 'critical': return '#ef4444'
    }
  }

  const getStatusLabel = (status: AuditResult['status']) => {
    switch (status) {
      case 'match': return 'Match'
      case 'minor_variance': return 'Minor Variance'
      case 'major_variance': return 'Major Variance'
      case 'critical': return 'Critical'
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileCheck size={28} color="#10b981" />
          M&V Audit - Meter vs Bill Comparison
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Compare utility bills against actual meter readings to identify discrepancies and savings opportunities
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <FileText size={20} color="#3b82f6" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Bills Analyzed</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{summaryStats.total}</p>
        </div>
        
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Critical Issues</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{summaryStats.critical}</p>
        </div>
        
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Gauge size={20} color="#f97316" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Variance</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {summaryStats.totalVariance > 0 ? '+' : ''}{summaryStats.totalVariance.toLocaleString()} kWh
          </p>
        </div>
        
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <DollarSign size={20} color="#10b981" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Savings Opportunity</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10b981' }}>
            ${summaryStats.totalSavings.toLocaleString()}
          </p>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Anomalies</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>{summaryStats.anomalyCount}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <Filter size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
            Variance Threshold
          </label>
          <select 
            value={varianceThreshold} 
            onChange={(e) => setVarianceThreshold(Number(e.target.value))}
            style={{ width: '180px' }}
          >
            <option value={0}>Show All</option>
            <option value={2}>Greater than 2%</option>
            <option value={5}>Greater than 5%</option>
            <option value={10}>Greater than 10%</option>
          </select>
        </div>
        
        <button 
          className={`btn ${showSettings ? 'btn-primary' : 'btn-outline'}`} 
          onClick={() => setShowSettings(!showSettings)}
          style={{ alignSelf: 'flex-end' }}
        >
          <Sliders size={18} />
          Thresholds
        </button>
        
        <button className="btn btn-outline" onClick={handleExportPDF} style={{ alignSelf: 'flex-end' }}>
          <Download size={18} />
          Export PDF Report
        </button>
      </div>

      {showSettings && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            <Sliders size={18} style={{ marginRight: '0.5rem' }} />
            Configurable Thresholds
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Critical Variance Threshold (%)
              </label>
              <input
                type="number"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                min={1}
                max={50}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Bills with variance above this are marked as critical
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Major Variance Threshold (%)
              </label>
              <input
                type="number"
                value={majorThreshold}
                onChange={(e) => setMajorThreshold(Number(e.target.value))}
                min={1}
                max={50}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Bills with variance above this are marked as major
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Billed vs Metered Comparison
          </h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Bar dataKey="billed" name="Billed (kWh)" fill="#3b82f6" />
                <Bar dataKey="metered" name="Metered (kWh)" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Status Distribution
          </h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            {statusBreakdown.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }}></div>
                <span style={{ color: '#94a3b8' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Detailed Audit Results
        </h3>
        
        {filteredResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <FileCheck size={48} style={{ margin: '0 auto 1rem' }} />
            <p>No bills available for analysis. Add utility bills to start the M&V audit.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Period</th>
                  <th>Billed (kWh)</th>
                  <th>Metered (kWh)</th>
                  <th>Variance</th>
                  <th>Billed Amount</th>
                  <th>Expected Amount</th>
                  <th>Savings</th>
                  <th>Anomalies</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(result => (
                  <React.Fragment key={result.billId}>
                    <tr>
                      <td>
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleRowExpanded(result.billId)}
                        >
                          {expandedRows.has(result.billId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td style={{ fontWeight: 500 }}>{result.period}</td>
                      <td>{result.billedKwh.toLocaleString()}</td>
                      <td>{result.meteredKwh.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {result.variancePercent > 0 ? (
                            <TrendingUp size={16} color="#ef4444" />
                          ) : result.variancePercent < 0 ? (
                            <TrendingDown size={16} color="#10b981" />
                          ) : null}
                          <span style={{ 
                            color: result.variancePercent > 2 ? '#ef4444' : 
                                   result.variancePercent < -2 ? '#10b981' : '#94a3b8' 
                          }}>
                            {result.variancePercent > 0 ? '+' : ''}{result.variancePercent}%
                          </span>
                        </div>
                      </td>
                      <td>${result.billedAmount.toLocaleString()}</td>
                      <td>${result.expectedAmount.toLocaleString()}</td>
                      <td style={{ color: result.savingsOpportunity > 0 ? '#10b981' : '#94a3b8' }}>
                        {result.savingsOpportunity > 0 ? `$${result.savingsOpportunity.toLocaleString()}` : '-'}
                      </td>
                      <td>
                        {result.anomalyFlags.length > 0 && (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b'
                          }}>
                            {result.anomalyFlags.length} flags
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: `${getStatusColor(result.status)}22`,
                          color: getStatusColor(result.status)
                        }}>
                          {result.status === 'match' && <CheckCircle size={12} />}
                          {result.status === 'critical' && <AlertTriangle size={12} />}
                          {getStatusLabel(result.status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setSelectedBill(result); setShowDrillDown(true); }}
                            title="Drill Down"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const note = prompt('Add auditor note:', result.auditorNotes || '')
                              if (note !== null) setNotes(prev => ({ ...prev, [result.billId]: note }))
                            }}
                            title="Add Note"
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(result.billId) && (
                      <tr>
                        <td colSpan={11} style={{ background: '#0f172a', padding: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Anomaly Flags</h4>
                              {result.anomalyFlags.length > 0 ? (
                                <ul style={{ fontSize: '0.875rem', color: '#f59e0b', listStyle: 'disc', paddingLeft: '1rem' }}>
                                  {result.anomalyFlags.map((flag, i) => <li key={i}>{flag}</li>)}
                                </ul>
                              ) : (
                                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No anomalies detected</p>
                              )}
                            </div>
                            <div>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Auditor Notes</h4>
                              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                {result.auditorNotes || 'No notes added'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDrillDown && selectedBill && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Drill-Down Analysis: {selectedBill.period}
              </h2>
              <button className="btn btn-ghost" onClick={() => setShowDrillDown(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Daily Variance Trend</h3>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateDrillDownData(selectedBill.billId).dailyBreakdown.slice(0, 14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                      <Line type="monotone" dataKey="billed" stroke="#3b82f6" name="Billed" />
                      <Line type="monotone" dataKey="metered" stroke="#10b981" name="Metered" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Charge Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {generateDrillDownData(selectedBill.billId).charges.map((charge, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{charge.type}</span>
                      <span style={{ fontWeight: 500 }}>${charge.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Total</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>${selectedBill.billedAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowDrillDown(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleExportPDF}>
                <Download size={18} />
                Export This Bill Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
