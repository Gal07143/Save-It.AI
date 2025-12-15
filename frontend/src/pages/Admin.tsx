import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Users, Building2, FileText, Lock } from 'lucide-react';

const API_BASE = '/api/v1';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'orgs' | 'users' | 'audit' | 'periods'>('orgs');

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/organizations`);
      return response.json();
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/users`);
      return response.json();
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/audit-logs?limit=50`);
      return response.json();
    },
  });

  const { data: periodLocks } = useQuery({
    queryKey: ['period-locks'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/period-locks`);
      return response.json();
    },
  });

  const tabs = [
    { id: 'orgs', label: 'Organizations', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'periods', label: 'Period Locks', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-red-600" />
          Admin Console
        </h1>
        <p className="text-gray-500 mt-1">Manage organizations, users, roles, and system settings</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'orgs' && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Add Organization
            </button>
          </div>
          
          {(organizations?.length || 0) === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No organizations yet</p>
              <p className="text-sm mt-1">Create your first organization to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">MFA Required</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {organizations?.map((org: any) => (
                    <tr key={org.id} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-gray-900">{org.name}</td>
                      <td className="py-3 text-gray-600">{org.slug}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {org.subscription_plan}
                        </span>
                      </td>
                      <td className="py-3">{org.mfa_required ? 'Yes' : 'No'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          org.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
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
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Add User
            </button>
          </div>
          
          {(users?.length || 0) === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No users yet</p>
              <p className="text-sm mt-1">Add users to your organization</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">MFA</th>
                    <th className="pb-3 font-medium">Last Login</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {users?.map((user: any) => (
                    <tr key={user.id} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-gray-900">{user.email}</td>
                      <td className="py-3 text-gray-600">{user.first_name} {user.last_name}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'super_admin' ? 'bg-red-100 text-red-700' :
                          user.role === 'org_admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'site_manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3">{user.mfa_enabled ? '✓' : '-'}</td>
                      <td className="py-3 text-gray-500">{user.last_login_at || 'Never'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
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
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Logs</h2>
          
          {(auditLogs?.length || 0) === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No audit logs yet</p>
              <p className="text-sm mt-1">Actions will be logged here automatically</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Entity</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {auditLogs?.map((log: any) => (
                    <tr key={log.id} className="border-b border-gray-50">
                      <td className="py-3 text-gray-600">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.action === 'create' ? 'bg-green-100 text-green-700' :
                          log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                          log.action === 'delete' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">{log.entity_type} #{log.entity_id}</td>
                      <td className="py-3 text-gray-600">User #{log.user_id || '-'}</td>
                      <td className="py-3 text-gray-500">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'periods' && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Period Locks</h2>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Create Period Lock
            </button>
          </div>
          
          {(periodLocks?.length || 0) === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Lock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No period locks</p>
              <p className="text-sm mt-1">Lock billing periods to prevent edits to historical data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Period Type</th>
                    <th className="pb-3 font-medium">Start</th>
                    <th className="pb-3 font-medium">End</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Locked At</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {periodLocks?.map((lock: any) => (
                    <tr key={lock.id} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-gray-900">{lock.period_type}</td>
                      <td className="py-3 text-gray-600">{lock.period_start}</td>
                      <td className="py-3 text-gray-600">{lock.period_end}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          lock.status === 'locked' ? 'bg-red-100 text-red-700' :
                          lock.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {lock.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">{lock.locked_at || '-'}</td>
                      <td className="py-3">
                        {lock.status === 'open' && (
                          <button className="text-red-600 hover:text-red-800 text-sm">Lock</button>
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
  );
}
