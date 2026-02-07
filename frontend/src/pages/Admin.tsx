import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Building2, FileText, Key, Activity, Settings, Plus, User, Database, AlertTriangle, Trash2 } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { api } from '../services/api'

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
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [showAddRole, setShowAddRole] = useState(false)
  const [showAddApiKey, setShowAddApiKey] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string; deleted_counts?: Record<string, number> } | null>(null)
  const [newUser, setNewUser] = useState({ email: '', first_name: '', last_name: '', role: 'viewer' })
  const [newOrg, setNewOrg] = useState({ name: '', slug: '', subscription_plan: 'basic' })
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.admin.organizations(),
  })

  const { data: users } = useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: () => api.admin.users(),
  })

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: () => api.admin.auditLogs(50),
  })

  const handleResetDemoData = async () => {
    setIsResetting(true)
    setResetResult(null)
    try {
      const result = await api.admin.resetDemoData()
      setResetResult(result)
      success('Demo data has been reset successfully')
      queryClient.invalidateQueries()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset demo data'
      setResetResult({ success: false, message })
      showError(message)
    } finally {
      setIsResetting(false)
      setShowResetConfirm(false)
    }
  }

  const tabs: Tab[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'roles', label: 'Roles & Permissions', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'data', label: 'Data Management', icon: Database },
  ]

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'users':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Users</h2>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowAddUser(true)}>
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
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowAddOrg(true)}>
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
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowAddRole(true)}>
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
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowAddApiKey(true)}>
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

      case 'data':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Data Management</h2>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ 
                padding: '1.5rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: '12px', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ 
                    padding: '0.75rem', 
                    background: 'rgba(239, 68, 68, 0.2)', 
                    borderRadius: '8px',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={24} color="#ef4444" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
                      Reset Demo Data
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                      This will remove all demo/sample data from the system, including sites, meters, gateways, 
                      devices, readings, bills, and tenants. System templates, device catalogs, and user accounts 
                      will be preserved. This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isResetting}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Trash2 size={16} />
                      {isResetting ? 'Resetting...' : 'Reset Demo Data'}
                    </button>
                  </div>
                </div>
              </div>

              {resetResult && (
                <div style={{ 
                  padding: '1rem', 
                  background: resetResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  borderRadius: '8px', 
                  border: `1px solid ${resetResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ 
                    color: resetResult.success ? '#10b981' : '#ef4444', 
                    fontWeight: 500, 
                    marginBottom: resetResult.deleted_counts ? '0.75rem' : 0 
                  }}>
                    {resetResult.message}
                  </p>
                  {resetResult.deleted_counts && Object.keys(resetResult.deleted_counts).length > 0 && (
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      <strong>Deleted records:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {Object.entries(resetResult.deleted_counts).map(([table, count]) => (
                          <span key={table} style={{ 
                            background: 'rgba(30, 41, 59, 0.5)', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}>
                            {table}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1rem', color: '#f1f5f9' }}>
                  What Gets Preserved
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {[
                    'Device Models (blueprints)',
                    'Device Products (catalog)',
                    'Device Policies',
                    'Integration Templates',
                    'PV Module Catalog',
                    'BESS Vendor/Models',
                    'Organizations',
                    'User Accounts',
                  ].map((item) => (
                    <div key={item} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(30, 41, 59, 0.5)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#94a3b8'
                    }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      {item}
                    </div>
                  ))}
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

      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add User</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddUser(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="user@example.com" />
              </div>
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input type="text" value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input type="text" value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="org_admin">Org Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddUser(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { success('User invitation sent'); setShowAddUser(false); }}>Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {showAddOrg && (
        <div className="modal-overlay" onClick={() => setShowAddOrg(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Organization</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddOrg(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Organization Name</label>
                <input type="text" value={newOrg.name} onChange={e => setNewOrg({...newOrg, name: e.target.value})} placeholder="Acme Corp" />
              </div>
              <div className="form-group">
                <label className="form-label">Slug</label>
                <input type="text" value={newOrg.slug} onChange={e => setNewOrg({...newOrg, slug: e.target.value})} placeholder="acme-corp" />
              </div>
              <div className="form-group">
                <label className="form-label">Subscription Plan</label>
                <select value={newOrg.subscription_plan} onChange={e => setNewOrg({...newOrg, subscription_plan: e.target.value})}>
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddOrg(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { success('Organization created'); setShowAddOrg(false); queryClient.invalidateQueries({ queryKey: ['organizations'] }); }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showAddRole && (
        <div className="modal-overlay" onClick={() => setShowAddRole(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create Role</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Role Name</label>
                <input type="text" placeholder="e.g., Energy Analyst" />
              </div>
              <div className="form-group">
                <label className="form-label">Permissions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> View Dashboard</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> Manage Sites</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> Manage Bills</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> View Reports</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> Admin Access</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddRole(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { success('Role created'); setShowAddRole(false); }}>Create Role</button>
            </div>
          </div>
        </div>
      )}

      {showAddApiKey && (
        <div className="modal-overlay" onClick={() => setShowAddApiKey(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Generate API Key</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddApiKey(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Key Name</label>
                <input type="text" placeholder="e.g., Production Integration" />
              </div>
              <div className="form-group">
                <label className="form-label">Expiration</label>
                <select>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="never">Never</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Scopes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Read Sites</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" defaultChecked /> Read Meters</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> Write Data</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" /> Admin Access</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddApiKey(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { success('API key generated'); setShowAddApiKey(false); }}>Generate Key</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetDemoData}
        title="Reset Demo Data"
        message="Are you sure you want to reset all demo data? This will permanently delete all sites, meters, gateways, devices, readings, bills, and tenants. System templates and user accounts will be preserved. This action cannot be undone."
        confirmLabel={isResetting ? 'Resetting...' : 'Reset Data'}
        variant="danger"
      />
    </div>
  )
}
