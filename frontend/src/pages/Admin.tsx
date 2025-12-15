import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Users, Building2, FileText, Lock, Plus, User } from 'lucide-react'

const API_BASE = '/api/v1'

interface Organization {
  id: number
  name: string
  slug: string
  subscription_plan: string
  mfa_required: boolean
  is_active: boolean
}

interface UserRecord {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  mfa_enabled: boolean
  is_active: boolean
  last_login_at: string | null
}

interface AuditLog {
  id: number
  action: string
  entity_type: string
  entity_id: number
  user_id: number | null
  ip_address: string | null
  created_at: string
}

interface PeriodLock {
  id: number
  period_type: string
  period_start: string
  period_end: string
  status: string
  locked_at: string | null
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'orgs' | 'users' | 'audit' | 'periods'>('orgs')

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/organizations`)
      return response.json()
    },
  })

  const { data: users } = useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/users`)
      return response.json()
    },
  })

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/audit-logs?limit=50`)
      return response.json()
    },
  })

  const { data: periodLocks } = useQuery<PeriodLock[]>({
    queryKey: ['period-locks'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/period-locks`)
      return response.json()
    },
  })

  const tabs = [
    { id: 'orgs', label: 'Organizations', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'periods', label: 'Period Locks', icon: Lock },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={24} color="#ef4444" />
          Admin Console
        </h1>
        <p style={{ color: '#64748b' }}>Manage organizations, users, roles, and system settings</p>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #334155', marginBottom: '1.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'orgs' | 'users' | 'audit' | 'periods')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'orgs' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Organizations</h2>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} />
              Add Organization
            </button>
          </div>
          
          {(organizations?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Building2 size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No organizations yet</p>
              <p style={{ fontSize: '0.875rem' }}>Create your first organization to get started</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Plan</th>
                    <th>MFA Required</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations?.map((org) => (
                    <tr key={org.id}>
                      <td style={{ fontWeight: 500 }}>{org.name}</td>
                      <td style={{ color: '#94a3b8' }}>{org.slug}</td>
                      <td>
                        <span className="badge badge-info">{org.subscription_plan}</span>
                      </td>
                      <td>{org.mfa_required ? 'Yes' : 'No'}</td>
                      <td>
                        <span className={`badge badge-${org.is_active ? 'success' : 'secondary'}`}>
                          {org.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Users</h2>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} />
              Add User
            </button>
          </div>
          
          {(users?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <User size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No users yet</p>
              <p style={{ fontSize: '0.875rem' }}>Add users to your organization</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>MFA</th>
                    <th>Last Login</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 500 }}>{user.email}</td>
                      <td style={{ color: '#94a3b8' }}>{user.first_name} {user.last_name}</td>
                      <td>
                        <span className={`badge badge-${
                          user.role === 'super_admin' ? 'danger' :
                          user.role === 'org_admin' ? 'warning' :
                          user.role === 'site_manager' ? 'info' : 'secondary'
                        }`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{user.mfa_enabled ? '✓' : '-'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <span className={`badge badge-${user.is_active ? 'success' : 'secondary'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Audit Logs</h2>
          </div>
          
          {(auditLogs?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <FileText size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No audit logs yet</p>
              <p style={{ fontSize: '0.875rem' }}>Actions will be logged here automatically</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>User</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs?.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge badge-${
                          log.action === 'create' ? 'success' :
                          log.action === 'update' ? 'info' :
                          log.action === 'delete' ? 'danger' : 'secondary'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: '#94a3b8' }}>{log.entity_type} #{log.entity_id}</td>
                      <td style={{ color: '#94a3b8' }}>User #{log.user_id || '-'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.875rem' }}>{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'periods' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Period Locks</h2>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} />
              Create Period Lock
            </button>
          </div>
          
          {(periodLocks?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Lock size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No period locks</p>
              <p style={{ fontSize: '0.875rem' }}>Lock billing periods to prevent edits to historical data</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Period Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th>Locked At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periodLocks?.map((lock) => (
                    <tr key={lock.id}>
                      <td style={{ fontWeight: 500 }}>{lock.period_type}</td>
                      <td style={{ color: '#94a3b8' }}>{lock.period_start}</td>
                      <td style={{ color: '#94a3b8' }}>{lock.period_end}</td>
                      <td>
                        <span className={`badge badge-${
                          lock.status === 'locked' ? 'danger' :
                          lock.status === 'closed' ? 'secondary' : 'success'
                        }`}>
                          {lock.status}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.875rem' }}>{lock.locked_at || '-'}</td>
                      <td>
                        {lock.status === 'open' && (
                          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                            Lock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
