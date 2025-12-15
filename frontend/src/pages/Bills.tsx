import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Receipt, CheckCircle, AlertTriangle, XCircle, FileCheck } from 'lucide-react'

export default function Bills() {
  const queryClient = useQueryClient()
  const [validatingId, setValidatingId] = useState<number | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)

  const { data: bills, isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => api.bills.list() })

  const validateMutation = useMutation({
    mutationFn: api.bills.validate,
    onSuccess: (result) => {
      setValidationResult(result)
      queryClient.invalidateQueries({ queryKey: ['bills'] })
    },
    onSettled: () => setValidatingId(null),
  })

  const handleValidate = (billId: number) => {
    setValidatingId(billId)
    setValidationResult(null)
    validateMutation.mutate(billId)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Utility Bills</h1>
        <p style={{ color: '#64748b' }}>Track and validate utility bills against meter readings</p>
      </div>

      {validationResult && (
        <div className={`alert alert-${validationResult.is_valid ? 'success' : 'warning'}`} style={{ marginBottom: '1.5rem' }}>
          <strong>{validationResult.message}</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Bill Total: {validationResult.bill_total_kwh.toLocaleString()} kWh | 
            Meter Total: {validationResult.meter_total_kwh.toLocaleString()} kWh | 
            Variance: {validationResult.variance_percentage.toFixed(2)}%
          </div>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <p>Loading bills...</p>
        ) : bills && bills.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Bill Date</th>
                <th>Period</th>
                <th>Total kWh</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{new Date(bill.bill_date).toLocaleDateString()}</td>
                  <td>
                    {new Date(bill.period_start).toLocaleDateString()} - {new Date(bill.period_end).toLocaleDateString()}
                  </td>
                  <td>{bill.total_kwh.toLocaleString()} kWh</td>
                  <td>${bill.total_amount.toLocaleString()}</td>
                  <td>
                    {bill.is_validated ? (
                      bill.validation_variance_pct !== undefined && Math.abs(bill.validation_variance_pct) <= 2 ? (
                        <span className="badge badge-success">
                          <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                          Valid ({bill.validation_variance_pct.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} />
                          Variance ({bill.validation_variance_pct?.toFixed(1)}%)
                        </span>
                      )
                    ) : (
                      <span className="badge badge-info">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                      onClick={() => handleValidate(bill.id)}
                      disabled={validatingId === bill.id}
                    >
                      <FileCheck size={14} />
                      {validatingId === bill.id ? 'Validating...' : 'Validate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Receipt size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Bills Found</h3>
            <p style={{ color: '#64748b' }}>Upload bills via the API to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
