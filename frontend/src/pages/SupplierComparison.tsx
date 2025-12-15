import { useState, useMemo } from 'react'
import { 
  Zap, ArrowRight, CheckCircle, Star,
  Calculator, Award, Sparkles, Leaf, AlertCircle, Clock, DollarSign, Info, ExternalLink
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

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
  contractLength: number
  exitFee: number
  switchingBonus?: number
  greenPercent: number
  carbonIntensity: number
}

interface ComparisonResult {
  supplier: Supplier
  annualCost: number
  savings: number
  savingsPercent: number
  switchingCost: number
  netSavingsYear1: number
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
    features: ['Fixed Rate', '12 Month Contract'],
    contractLength: 12,
    exitFee: 500,
    greenPercent: 15,
    carbonIntensity: 420
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
    features: ['100% Renewable', 'Carbon Neutral', 'RECs Included', '24 Month Lock'],
    contractLength: 24,
    exitFee: 750,
    switchingBonus: 200,
    greenPercent: 100,
    carbonIntensity: 0
  },
  {
    id: 'value-saver',
    name: 'ValueSaver Energy',
    type: 'variable',
    ratePerKwh: 0.118,
    standingCharge: 650,
    demandCharge: 10.50,
    rating: 4.2,
    features: ['Variable Rate', 'No Contract', 'Monthly Billing', 'Price Cap Guarantee'],
    contractLength: 0,
    exitFee: 0,
    switchingBonus: 100,
    greenPercent: 25,
    carbonIntensity: 380
  },
  {
    id: 'tou-flex',
    name: 'FlexPower TOU',
    type: 'tou',
    ratePerKwh: 0.135,
    standingCharge: 780,
    demandCharge: 9.00,
    rating: 4.5,
    features: ['Time-of-Use', 'Peak/Off-Peak', 'Smart Meter Required', 'EV Discount'],
    contractLength: 12,
    exitFee: 300,
    greenPercent: 45,
    carbonIntensity: 280
  },
  {
    id: 'business-plus',
    name: 'BusinessPlus Energy',
    type: 'fixed',
    ratePerKwh: 0.132,
    standingCharge: 890,
    demandCharge: 11.50,
    rating: 4.0,
    features: ['Fixed Rate', '24/7 Support', 'Dedicated Account Manager', 'Quarterly Reviews'],
    contractLength: 36,
    exitFee: 1000,
    switchingBonus: 500,
    greenPercent: 30,
    carbonIntensity: 350
  },
  {
    id: 'solar-bundle',
    name: 'SolarBundle Pro',
    type: 'green',
    ratePerKwh: 0.122,
    standingCharge: 800,
    demandCharge: 10.00,
    greenPremium: 0.008,
    rating: 4.6,
    features: ['Solar Integration', 'Feed-in Tariff', 'Battery Ready', 'Free Smart Meter'],
    contractLength: 24,
    exitFee: 600,
    switchingBonus: 350,
    greenPercent: 85,
    carbonIntensity: 45
  }
]

export default function SupplierComparison({ currentSite: _currentSite }: { currentSite: number | null }) {
  const [annualConsumption, setAnnualConsumption] = useState<number>(500000)
  const [peakDemand, setPeakDemand] = useState<number>(150)
  const [preferGreen, setPreferGreen] = useState<boolean>(false)
  const [minGreenPercent, setMinGreenPercent] = useState<number>(0)
  const [maxContractLength, setMaxContractLength] = useState<number>(36)
  const [showSwitchingCosts, setShowSwitchingCosts] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)

  const currentExitFee = SUPPLIERS[0].exitFee

  const comparisonResults = useMemo((): ComparisonResult[] => {
    return SUPPLIERS
      .filter(s => s.greenPercent >= minGreenPercent)
      .filter(s => s.contractLength <= maxContractLength || s.contractLength === 0)
      .map(supplier => {
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
        
        const switchingCost = supplier.id === 'current' ? 0 : 
          currentExitFee - (supplier.switchingBonus || 0)
        
        const netSavingsYear1 = savings - switchingCost
        
        return {
          supplier,
          annualCost,
          savings,
          savingsPercent,
          switchingCost: Math.max(0, switchingCost),
          netSavingsYear1,
          breakdown: {
            energy: energyCost,
            standing: standingCost,
            demand: demandCost,
            green: greenCost
          }
        }
      }).sort((a, b) => {
        if (preferGreen) {
          if (a.supplier.type === 'green' && b.supplier.type !== 'green') return -1
          if (b.supplier.type === 'green' && a.supplier.type !== 'green') return 1
        }
        return showSwitchingCosts ? b.netSavingsYear1 - a.netSavingsYear1 : b.savings - a.savings
      })
  }, [annualConsumption, peakDemand, preferGreen, minGreenPercent, maxContractLength, showSwitchingCosts])

  const bestOption = useMemo(() => {
    const validOptions = comparisonResults.filter(r => r.supplier.id !== 'current')
    if (preferGreen) {
      return validOptions.find(r => r.supplier.type === 'green') || validOptions[0]
    }
    return validOptions[0]
  }, [comparisonResults, preferGreen])

  const chartData = comparisonResults.map(r => ({
    name: r.supplier.name.split(' ')[0],
    cost: Math.round(r.annualCost),
    savings: Math.round(r.savings),
    netYear1: Math.round(r.netSavingsYear1)
  }))

  const carbonData = comparisonResults.map(r => ({
    name: r.supplier.name.split(' ')[0],
    value: r.supplier.carbonIntensity,
    color: r.supplier.carbonIntensity < 100 ? '#10b981' : 
           r.supplier.carbonIntensity < 300 ? '#eab308' : '#ef4444'
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

  const getSupplierDetails = (supplierId: string) => {
    return comparisonResults.find(r => r.supplier.id === supplierId)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={28} color="#10b981" />
          Energy Supplier Comparison
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Compare energy suppliers with real market rates, contract terms, and switching costs
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calculator size={20} />
          Your Consumption Profile
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Min Green Energy %
            </label>
            <select value={minGreenPercent} onChange={(e) => setMinGreenPercent(Number(e.target.value))}>
              <option value={0}>Any</option>
              <option value={25}>25%+</option>
              <option value={50}>50%+</option>
              <option value={75}>75%+</option>
              <option value={100}>100%</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Max Contract Length
            </label>
            <select value={maxContractLength} onChange={(e) => setMaxContractLength(Number(e.target.value))}>
              <option value={0}>No Contract</option>
              <option value={12}>12 Months</option>
              <option value={24}>24 Months</option>
              <option value={36}>36 Months</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferGreen}
                onChange={(e) => setPreferGreen(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <Leaf size={16} color="#10b981" />
              <span style={{ fontSize: '0.875rem' }}>Prefer Green</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSwitchingCosts}
                onChange={(e) => setShowSwitchingCosts(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <DollarSign size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.875rem' }}>Include Switching Costs</span>
            </label>
          </div>
        </div>
      </div>

      {bestOption && bestOption.savings > 0 && (
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
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}>BEST MATCH</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  Switch to {bestOption.supplier.name}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Save ${Math.round(bestOption.savings).toLocaleString()}/year 
                  ({Math.round(bestOption.savingsPercent)}%) | 
                  {bestOption.switchingCost > 0 ? ` Net Year 1: $${Math.round(bestOption.netSavingsYear1).toLocaleString()}` : ' No switching costs'}
                </p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setSelectedSupplier(bestOption.supplier.id)}>
              View Details
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
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
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString()}`,
                    name === 'cost' ? 'Annual Cost' : name === 'savings' ? 'Savings' : 'Net Year 1'
                  ]}
                />
                <Bar dataKey="cost" fill="#3b82f6">
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.savings > 0 && index !== 0 ? '#10b981' : COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Leaf size={18} color="#10b981" />
            Carbon Intensity (g CO2/kWh)
          </h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={carbonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {carbonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '0.5rem' }}>
            Lower is better for the environment
          </p>
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
                <th>Contract</th>
                <th>Exit Fee</th>
                <th>Switching Bonus</th>
                <th>Green %</th>
                <th>Annual Cost</th>
                <th>Net Year 1 Savings</th>
                <th>Rating</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comparisonResults.map((result, index) => (
                <tr 
                  key={result.supplier.id} 
                  style={{
                    background: result.supplier.id === 'current' ? 'rgba(100, 116, 139, 0.1)' :
                               index === 0 || (index === 1 && result.supplier.id === 'current') ? 'rgba(16, 185, 129, 0.1)' : undefined
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {result.netSavingsYear1 > 0 && result.supplier.id !== 'current' && <CheckCircle size={16} color="#10b981" />}
                      <span style={{ fontWeight: 500 }}>{result.supplier.name}</span>
                      {result.supplier.id === 'current' && (
                        <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', background: '#475569', borderRadius: '4px' }}>
                          CURRENT
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: result.supplier.type === 'green' ? '#10b98122' : 
                                 result.supplier.type === 'tou' ? '#8b5cf622' : '#3b82f622',
                      color: result.supplier.type === 'green' ? '#10b981' : 
                             result.supplier.type === 'tou' ? '#8b5cf6' : '#3b82f6',
                      textTransform: 'uppercase'
                    }}>
                      {result.supplier.type}
                    </span>
                  </td>
                  <td>${result.supplier.ratePerKwh.toFixed(3)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} color="#64748b" />
                      {result.supplier.contractLength === 0 ? 'None' : `${result.supplier.contractLength} mo`}
                    </div>
                  </td>
                  <td style={{ color: result.supplier.exitFee > 0 ? '#f59e0b' : '#10b981' }}>
                    {result.supplier.exitFee > 0 ? `$${result.supplier.exitFee}` : 'None'}
                  </td>
                  <td style={{ color: result.supplier.switchingBonus ? '#10b981' : '#64748b' }}>
                    {result.supplier.switchingBonus ? `+$${result.supplier.switchingBonus}` : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '6px', 
                        background: '#334155', 
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${result.supplier.greenPercent}%`, 
                          height: '100%', 
                          background: result.supplier.greenPercent >= 75 ? '#10b981' : 
                                     result.supplier.greenPercent >= 50 ? '#eab308' : '#64748b'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '0.75rem' }}>{result.supplier.greenPercent}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>${Math.round(result.annualCost).toLocaleString()}</td>
                  <td style={{ 
                    color: result.netSavingsYear1 > 0 ? '#10b981' : 
                           result.netSavingsYear1 < 0 ? '#ef4444' : '#94a3b8',
                    fontWeight: 600
                  }}>
                    {result.supplier.id === 'current' ? '-' :
                     result.netSavingsYear1 > 0 ? `+$${Math.round(result.netSavingsYear1).toLocaleString()}` :
                     result.netSavingsYear1 < 0 ? `-$${Math.abs(Math.round(result.netSavingsYear1)).toLocaleString()}` : '$0'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Star size={14} color="#eab308" fill="#eab308" />
                      <span>{result.supplier.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedSupplier(result.supplier.id)}
                    >
                      <Info size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {showSwitchingCosts && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: 'rgba(245, 158, 11, 0.1)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.875rem', color: '#f59e0b' }}>
              Net Year 1 Savings includes your current provider's exit fee (${currentExitFee}) minus any switching bonuses.
            </span>
          </div>
        )}
      </div>

      {selectedSupplier && (
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
          <div className="card" style={{ width: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            {(() => {
              const result = getSupplierDetails(selectedSupplier)
              if (!result) return null
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        {result.supplier.name}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Star size={16} color="#eab308" fill="#eab308" />
                        <span>{result.supplier.rating.toFixed(1)} rating</span>
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
                      </div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => setSelectedSupplier(null)}>
                      &times;
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Annual Cost</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>${Math.round(result.annualCost).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '1rem', background: result.netSavingsYear1 > 0 ? 'rgba(16, 185, 129, 0.1)' : '#1e293b', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Net Year 1 Savings</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: result.netSavingsYear1 > 0 ? '#10b981' : '#94a3b8' }}>
                        {result.netSavingsYear1 > 0 ? `+$${Math.round(result.netSavingsYear1).toLocaleString()}` : '$0'}
                      </div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Contract Terms</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b' }}>Contract Length</span>
                      <span>{result.supplier.contractLength === 0 ? 'No contract' : `${result.supplier.contractLength} months`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b' }}>Exit Fee</span>
                      <span>${result.supplier.exitFee}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b' }}>Switching Bonus</span>
                      <span style={{ color: result.supplier.switchingBonus ? '#10b981' : '#64748b' }}>
                        {result.supplier.switchingBonus ? `+$${result.supplier.switchingBonus}` : 'None'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b' }}>Green Energy</span>
                      <span style={{ color: result.supplier.greenPercent >= 75 ? '#10b981' : '#94a3b8' }}>
                        {result.supplier.greenPercent}%
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Features</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {result.supplier.features.map((feature, i) => (
                      <span key={i} style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        background: '#334155',
                        color: '#e2e8f0'
                      }}>
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-outline" onClick={() => setSelectedSupplier(null)}>
                      Close
                    </button>
                    <button className="btn btn-primary">
                      <ExternalLink size={18} />
                      Get Quote
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
