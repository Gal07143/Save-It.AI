import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Gauge, CheckCircle, XCircle, Clock } from 'lucide-react'

export default function Meters() {
  const { data: meters, isLoading } = useQuery({ queryKey: ['meters'], queryFn: () => api.meters.list() })

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Meters</h1>
        <p style={{ color: '#64748b' }}>Monitor meter status and readings</p>
      </div>

      <div className="card">
        {isLoading ? (
          <p>Loading meters...</p>
        ) : meters && meters.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Last Reading</th>
                <th>Asset</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((meter) => (
                <tr key={meter.id}>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                      {meter.meter_id}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{meter.name}</td>
                  <td>
                    {meter.is_active ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    {meter.last_reading_at ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b' }}>
                        <Clock size={14} />
                        {new Date(meter.last_reading_at).toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No readings</span>
                    )}
                  </td>
                  <td>
                    {meter.asset_id ? (
                      <span className="badge badge-info">Asset #{meter.asset_id}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Gauge size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Meters Found</h3>
            <p style={{ color: '#64748b' }}>Add meters via the API or import from a data source</p>
          </div>
        )}
      </div>
    </div>
  )
}
