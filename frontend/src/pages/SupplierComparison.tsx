import { useState, useMemo } from 'react'
import { 
  Zap, ArrowRight, CheckCircle, Star,
  Calculator, Award, Sparkles
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Supplier {
  id: string
  name: string
  type: 'fixed' | 'variable' | 'tou' | 'green'
  ratePerKwh: number
  standingCharge: number
  demandCharge?: number
  greenPremium?: number
  rating: number
  features: string[]
}

interface ComparisonResult {
  supplier: Supplier
  annualCost: number
  savings: number
  savingsPercent: number
  breakdown: {
    energy: number
    standing: number
    demand: number
    green: number
  }
}

const SUPPLIERS: Supplier[] = [
  {
    id: 'current',
    name: 'Current Provider',
    type: 'fixed',
    ratePerKwh: 0.145,
    standingCharge: 850,
    demandCharge: 12.50,
    rating: 3.5,
    features: ['Fixed Rate', '12 Month Contract']
  },
  {
    id: 'green-energy',
    name: 'GreenPower Co',
    type: 'green',
    ratePerKwh: 0.128,
    standingCharge: 720,
    demandCharge: 11.00,
    greenPremium: 0.015,
    rating: 4.8,
    features: ['100% Renewable', 'Carbon Neutral', 'RECs Included']
  },
  {
    id: 'value-saver',
    name: 'ValueSaver Energy',
    type: 'variable',
    ratePerKwh: 0.118,
    standingCharge: 650,
    demandCharge: 10.50,
    rating: 4.2,
    features: ['Variable Rate', 'No Contract', 'Monthly Billing']
  },
  {
    id: 'tou-flex',
    name: 'FlexPower TOU',
    type: 'tou',
    ratePerKwh: 0.135,
    standingCharge: 780,
    demandCharge: 9.00,
    rating: 4.5,
    features: ['Time-of-Use', 'Peak/Off-Peak', 'Smart Meter Required']
  },
  {
    id: 'business-plus',
    name: 'BusinessPlus Energy',
    type: 'fixed',
    ratePerKwh: 0.132,
    standingCharge: 890,
    demandCharge: 11.50,
    rating: 4.0,
    features: ['Fixed Rate', '24/7 Support', 'Dedicated Account Manager']
  }
]

export default function SupplierComparison({ currentSite: _currentSite }: { currentSite: number | null }) {
  const [annualConsumption, setAnnualConsumption] = useState<number>(500000)
  const [peakDemand, setPeakDemand] = useState<number>(150)
  const [preferGreen, setPreferGreen] = useState<boolean>(false)

  const comparisonResults = useMemo((): ComparisonResult[] => {
    return SUPPLIERS.map(supplier => {
      const energyCost = annualConsumption * supplier.ratePerKwh
      const standingCost = supplier.standingCharge * 12
      const demandCost = supplier.demandCharge ? peakDemand * supplier.demandCharge * 12 : 0
      const greenCost = supplier.greenPremium ? annualConsumption * supplier.greenPremium : 0
      
      const annualCost = energyCost + standingCost + demandCost + greenCost
      const currentCost = SUPPLIERS[0].ratePerKwh * annualConsumption + 
                         SUPPLIERS[0].standingCharge * 12 + 
                         (SUPPLIERS[0].demandCharge || 0) * peakDemand * 12
      
      const savings = currentCost - annualCost
      const savingsPercent = (savings / currentCost) * 100
      
      return {
        supplier,
        annualCost,
        savings,
        savingsPercent,
        breakdown: {
          energy: energyCost,
          standing: standingCost,
          demand: demandCost,
          green: greenCost
        }
      }
    }).sort((a, b) => a.annualCost - b.annualCost)
  }, [annualConsumption, peakDemand])

  const bestOption = useMemo(() => {
    if (preferGreen) {
      return comparisonResults.find(r => r.supplier.type === 'green') || comparisonResults[0]
    }
    return comparisonResults[0]
  }, [comparisonResults, preferGreen])

  const chartData = comparisonResults.map(r => ({
    name: r.supplier.name.split(' ')[0],
    cost: Math.round(r.annualCost),
    savings: Math.round(r.savings)
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={28} color="#10b981" />
          Energy Supplier Comparison
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Compare energy suppliers and find the best deal for your consumption profile
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calculator size={20} />
          Your Consumption Profile
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Annual Consumption (kWh)
            </label>
            <input
              type="number"
              value={annualConsumption}
              onChange={(e) => setAnnualConsumption(Number(e.target.value))}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Peak Demand (kW)
            </label>
            <input
              type="number"
              value={peakDemand}
              onChange={(e) => setPeakDemand(Number(e.target.value))}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferGreen}
                onChange={(e) => setPreferGreen(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem' }}>Prefer Green Energy</span>
            </label>
          </div>
        </div>
      </div>

      {bestOption.savings > 0 && (
        <div className="card" style={{ 
          marginBottom: '1.5rem', 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
          border: '1px solid #10b981'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Award size={32} color="white" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Sparkles size={16} color="#10b981" />
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}>AI RECOMMENDATION</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  Switch to {bestOption.supplier.name}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Based on your consumption profile, you could save ${Math.round(bestOption.savings).toLocaleString()} annually ({Math.round(bestOption.savingsPercent)}%)
                </p>
              </div>
            </div>
            <button className="btn btn-primary">
              Get Quote
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Annual Cost Comparison
        </h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Annual Cost']}
              />
              <Bar dataKey="cost" fill="#3b82f6">
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Detailed Supplier Comparison
        </h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Type</th>
                <th>Rate ($/kWh)</th>
                <th>Standing Charge</th>
                <th>Demand Charge</th>
                <th>Annual Cost</th>
                <th>Savings</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {comparisonResults.map((result, index) => (
                <tr key={result.supplier.id} style={{
                  background: index === 0 ? 'rgba(16, 185, 129, 0.1)' : undefined
                }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {index === 0 && <CheckCircle size={16} color="#10b981" />}
                      <span style={{ fontWeight: 500 }}>{result.supplier.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: result.supplier.type === 'green' ? '#10b98122' : '#3b82f622',
                      color: result.supplier.type === 'green' ? '#10b981' : '#3b82f6',
                      textTransform: 'uppercase'
                    }}>
                      {result.supplier.type}
                    </span>
                  </td>
                  <td>${result.supplier.ratePerKwh.toFixed(3)}</td>
                  <td>${result.supplier.standingCharge}/mo</td>
                  <td>{result.supplier.demandCharge ? `$${result.supplier.demandCharge}/kW` : '-'}</td>
                  <td style={{ fontWeight: 600 }}>${Math.round(result.annualCost).toLocaleString()}</td>
                  <td style={{ color: result.savings > 0 ? '#10b981' : result.savings < 0 ? '#ef4444' : '#94a3b8' }}>
                    {result.savings > 0 ? '+' : ''}{result.savings !== 0 ? `$${Math.round(result.savings).toLocaleString()}` : '-'}
                    {result.savingsPercent !== 0 && (
                      <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                        ({result.savingsPercent > 0 ? '+' : ''}{Math.round(result.savingsPercent)}%)
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Star size={14} color="#eab308" fill="#eab308" />
                      <span>{result.supplier.rating.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {comparisonResults[0].supplier.features.map((feature, i) => (
            <span key={i} style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              background: '#334155',
              color: '#94a3b8'
            }}>
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
