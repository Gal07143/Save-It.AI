import { useState } from 'react'
import { Bell, Check, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { api, Notification as AppNotification } from '../services/api'

const typeIcons: Record<string, React.ElementType> = {
  ALERT: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
  SUCCESS: CheckCircle,
}

const typeColors: Record<string, string> = {
  ALERT: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
  SUCCESS: '#10b981',
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  
  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.notifications?.list?.() || Promise.resolve([]),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.notifications?.markRead?.(id) || Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = notifications?.filter(n => !n.is_read)?.length || 0
  const recentNotifications = notifications?.slice(0, 10) || []

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '18px',
            height: '18px',
            background: '#ef4444',
            borderRadius: '50%',
            color: 'white',
            fontSize: '0.65rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: '360px',
            maxHeight: '480px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              borderBottom: '1px solid #334155',
            }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div style={{
              maxHeight: '380px',
              overflowY: 'auto',
            }}>
              {recentNotifications.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#64748b',
                }}>
                  <Bell size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>No notifications</p>
                </div>
              ) : (
                recentNotifications.map(notification => {
                  const Icon = typeIcons[notification.notification_type] || Info
                  const color = typeColors[notification.notification_type] || '#64748b'
                  
                  return (
                    <div
                      key={notification.id}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        padding: '0.875rem 1rem',
                        borderBottom: '1px solid #334155',
                        background: notification.is_read ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: `${color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={16} color={color} />
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.813rem',
                          fontWeight: 500,
                          color: '#f1f5f9',
                          marginBottom: '0.125rem',
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginBottom: '0.25rem',
                          lineHeight: 1.4,
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          fontSize: '0.65rem',
                          color: '#64748b',
                        }}>
                          {formatTime(notification.created_at)}
                        </div>
                      </div>

                      {!notification.is_read && (
                        <button
                          onClick={() => markReadMutation.mutate(notification.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            color: '#64748b',
                          }}
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {recentNotifications.length > 0 && (
              <div style={{
                padding: '0.75rem',
                borderTop: '1px solid #334155',
                textAlign: 'center',
              }}>
                <Link
                  href="/notifications"
                  style={{
                    color: '#10b981',
                    fontSize: '0.813rem',
                    textDecoration: 'none',
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
