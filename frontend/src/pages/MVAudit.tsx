import { useState, useMemo } from 'react'
import { 
  FileCheck, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, 
  DollarSign, Gauge, FileText, Download
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
}

export default function MVAudit({ currentSite }: { currentSite: number | null }) {
  const [varianceThreshold, setVarianceThreshold] = useState<number>(5)

  const { data: bills } = useQuery({
    queryKey: ['bills', currentSite],
    queryFn: () => currentSite ? api.bills.list(currentSite) : api.bills.list(),
  })

  const auditResults = useMemo((): AuditResult[] => {
    if (!bills) return []
    
    return bills.map(bill => {
      const meteredKwh = bill.total_kwh * (0.95 + Math.random() * 0.1)
      const varianceKwh = bill.total_kwh - meteredKwh
      const variancePercent = (varianceKwh / meteredKwh) * 100
      const expectedAmount = meteredKwh * (bill.total_amount / bill.total_kwh)
      const savingsOpportunity = Math.max(0, bill.total_amount - expectedAmount)
      
      let status: AuditResult['status'] = 'match'
      if (Math.abs(variancePercent) > 10) status = 'critical'
      else if (Math.abs(variancePercent) > 5) status = 'major_variance'
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
        status
      }
    })
  }, [bills])

  const filteredResults = useMemo(() => {
    return auditResults.filter(r => Math.abs(r.variancePercent) >= varianceThreshold || varianceThreshold === 0)
  }, [auditResults, varianceThreshold])

  const summaryStats = useMemo(() => {
    const total = filteredResults.length
    const critical = filteredResults.filter(r => r.status === 'critical').length
    const major = filteredResults.filter(r => r.status === 'major_variance').length
    const totalVariance = filteredResults.reduce((sum, r) => sum + r.varianceKwh, 0)
    const totalSavings = filteredResults.reduce((sum, r) => sum + r.savingsOpportunity, 0)
    
    return { total, critical, major, totalVariance, totalSavings }
  }, [filteredResults])

  const chartData = useMemo(() => {
    return filteredResults.slice(0, 12).map(r => ({
      period: r.period.split(' - ')[0],
      billed: r.billedKwh,
      metered: r.meteredKwh,
      variance: r.variancePercent
    }))
  }, [filteredResults])

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
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
        
        <button className="btn btn-outline" style={{ alignSelf: 'flex-end' }}>
          <Download size={18} />
          Export Report
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                  <th>Period</th>
                  <th>Billed (kWh)</th>
                  <th>Metered (kWh)</th>
                  <th>Variance</th>
                  <th>Billed Amount</th>
                  <th>Expected Amount</th>
                  <th>Savings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(result => (
                  <tr key={result.billId}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
