import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Bell, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  critical: { icon: XCircle, color: '#dc2626', bg: '#fee2e2' },
  warning: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' },
  info: { icon: Info, color: '#2563eb', bg: '#dbeafe' },
}

interface NotificationsProps {
  currentSite?: number | null
}

export default function Notifications({ currentSite: _currentSite }: NotificationsProps) {
  const queryClient = useQueryClient()
  
  const { data: notifications, isLoading } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: () => api.notifications.list() 
  })

  const markReadMutation = useMutation({
    mutationFn: api.notifications.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const resolveMutation = useMutation({
    mutationFn: api.notifications.resolve,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0
  const unresolvedCount = notifications?.filter(n => !n.is_resolved).length || 0

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          <Bell size={24} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Notifications
        </h1>
        <p style={{ color: '#64748b' }}>AI-generated alerts and system notifications</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #1e40af' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total</h3>
          <div className="stat-value">{notifications?.length || 0}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Unread</h3>
          <div className="stat-value">{unreadCount}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Unresolved</h3>
          <div className="stat-value">{unresolvedCount}</div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p>Loading notifications...</p>
        ) : notifications && notifications.length > 0 ? (
          <div>
            {notifications.map((notification) => {
              const config = severityConfig[notification.severity] || severityConfig.info
              const Icon = config.icon
              
              return (
                <div
                  key={notification.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1rem',
                    borderBottom: '1px solid #e2e8f0',
                    background: notification.is_read ? 'transparent' : '#f8fafc',
                    opacity: notification.is_resolved ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.5rem',
                    background: config.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={20} color={config.color} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          {notification.title}
                          {!notification.is_read && (
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              background: '#1e40af', 
                              borderRadius: '50%',
                              display: 'inline-block',
                              marginLeft: '0.5rem',
                            }} />
                          )}
                        </h4>
                        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{notification.message}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className={`badge badge-${notification.severity === 'critical' ? 'danger' : notification.severity === 'warning' ? 'warning' : 'info'}`}>
                          {notification.severity}
                        </span>
                        {notification.is_resolved && (
                          <span className="badge badge-success">
                            <CheckCircle size={12} style={{ marginRight: '0.25rem' }} />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(notification.created_at).toLocaleString()}
                        {notification.agent_name && ` • ${notification.agent_name}`}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!notification.is_read && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => markReadMutation.mutate(notification.id)}
                          >
                            Mark Read
                          </button>
                        )}
                        {!notification.is_resolved && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => resolveMutation.mutate(notification.id)}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Bell size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Notifications</h3>
            <p style={{ color: '#64748b' }}>You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  )
}
