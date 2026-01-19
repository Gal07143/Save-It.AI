import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Users, Building2, FileText, Key, Activity, Settings, Plus, User } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'

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

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users')

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

  const tabs: Tab[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'roles', label: 'Roles & Permissions', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'health', label: 'System Health', icon: Activity },
  ]

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'users':
        return (
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
        )

      case 'organizations':
        return (
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
        )

      case 'roles':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Roles & Permissions</h2>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={16} />
                Create Role
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Settings size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Role-Based Access Control</p>
              <p style={{ fontSize: '0.875rem' }}>Configure roles and permissions for your organization</p>
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px', margin: '1.5rem auto 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                  <span style={{ fontWeight: 500, color: '#f1f5f9' }}>Super Admin</span>
                  <span className="badge badge-danger">Full Access</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                  <span style={{ fontWeight: 500, color: '#f1f5f9' }}>Org Admin</span>
                  <span className="badge badge-warning">Organization</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                  <span style={{ fontWeight: 500, color: '#f1f5f9' }}>Site Manager</span>
                  <span className="badge badge-info">Site Level</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                  <span style={{ fontWeight: 500, color: '#f1f5f9' }}>Viewer</span>
                  <span className="badge badge-secondary">Read Only</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'audit':
        return (
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
        )

      case 'apikeys':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">API Keys</h2>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={16} />
                Generate API Key
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Key size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No API keys yet</p>
              <p style={{ fontSize: '0.875rem' }}>Generate API keys for external integrations and third-party access</p>
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', maxWidth: '500px', margin: '1.5rem auto 0' }}>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'left' }}>
                  API keys provide secure access to the SAVE-IT.AI API for:
                </p>
                <ul style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'left', marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                  <li>Third-party integrations</li>
                  <li>Automated data ingestion</li>
                  <li>Custom dashboards and reports</li>
                  <li>Mobile applications</li>
                </ul>
              </div>
            </div>
          </div>
        )

      case 'health':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">System Health</h2>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>API Server</span>
                  </div>
                  <span className="badge badge-success">Healthy</span>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>Database</span>
                  </div>
                  <span className="badge badge-success">Connected</span>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>Cache</span>
                  </div>
                  <span className="badge badge-success">Active</span>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>Background Jobs</span>
                  </div>
                  <span className="badge badge-success">Running</span>
                </div>
              </div>
              
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1rem', color: '#f1f5f9' }}>System Metrics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Uptime</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9' }}>99.9%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>API Response Time</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9' }}>45ms avg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Active Connections</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9' }}>24</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Memory Usage</span>
                    <span style={{ fontWeight: 500, color: '#f1f5f9' }}>1.2 GB / 4 GB</span>
                  </div>
                </div>
              </div>
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={24} color="#ef4444" />
          Admin Console
        </h1>
        <p style={{ color: '#64748b' }}>Manage organizations, users, roles, and system settings</p>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="underline"
      >
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
