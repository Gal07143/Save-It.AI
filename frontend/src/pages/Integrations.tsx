import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Plug, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

const sourceTypeLabels: Record<string, string> = {
  modbus_tcp: 'Modbus TCP',
  modbus_rtu: 'Modbus RTU',
  bacnet: 'BACnet',
  csv_import: 'CSV Import',
  external_api: 'External API',
  manual: 'Manual Entry',
}

export default function Integrations() {
  const { data: dataSources, isLoading } = useQuery({ 
    queryKey: ['data-sources'], 
    queryFn: () => api.dataSources.list() 
  })

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Integrations</h1>
        <p style={{ color: '#64748b' }}>Manage data source connections and meter integrations</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Active Sources</h3>
          <div className="stat-value">{dataSources?.filter(d => d.is_active).length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>With Errors</h3>
          <div className="stat-value">{dataSources?.filter(d => d.last_error).length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #1e40af' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Sources</h3>
          <div className="stat-value">{dataSources?.length || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Data Sources</h2>
        </div>
        
        {isLoading ? (
          <p>Loading data sources...</p>
        ) : dataSources && dataSources.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Poll</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((source) => (
                <tr key={source.id}>
                  <td style={{ fontWeight: 500 }}>{source.name}</td>
                  <td>
                    <span className="badge badge-info">
                      {sourceTypeLabels[source.source_type] || source.source_type}
                    </span>
                  </td>
                  <td>
                    {source.is_active ? (
                      source.last_error ? (
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} style={{ marginRight: '0.25rem' }} />
                          Error
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                          Active
                        </span>
                      )
                    ) : (
                      <span className="badge badge-danger">
                        <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    {source.last_poll_at ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.875rem' }}>
                        <Clock size={14} />
                        {new Date(source.last_poll_at).toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Never</span>
                    )}
                  </td>
                  <td>
                    {source.last_error && (
                      <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{source.last_error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Plug size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Data Sources</h3>
            <p style={{ color: '#64748b' }}>Add data sources via the API to start integrating meters</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Supported Integration Types</h3>
        <div className="grid grid-3" style={{ gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
            <h4 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Modbus TCP</h4>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Connect to BMS and meters via Modbus TCP protocol
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
            <h4 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>CSV Import</h4>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Bulk import historical data from CSV/Excel files
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
            <h4 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>External API</h4>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Pull data from third-party platforms (SolarEdge, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
