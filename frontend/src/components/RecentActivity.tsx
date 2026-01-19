import { useQuery } from '@tanstack/react-query'
import { 
  Clock, Building2, Gauge, Receipt, FileText, User,
  Plus, Edit, Trash2, Eye
} from 'lucide-react'

interface Activity {
  id: number
  action: string
  resource_type: string
  resource_id?: number
  description: string
  user_name?: string
  created_at: string
}

const actionIcons: Record<string, React.ElementType> = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  VIEW: Eye,
}

const resourceIcons: Record<string, React.ElementType> = {
  site: Building2,
  meter: Gauge,
  bill: Receipt,
  user: User,
  report: FileText,
}

export default function RecentActivity() {
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['recent-activity'],
    queryFn: () => Promise.resolve([]),
    refetchInterval: 30000,
  })

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

  if (!activities || activities.length === 0) {
    return (
      <div className="card">
        <h3 style={{ 
          margin: 0, 
          marginBottom: '1rem',
          fontSize: '1rem', 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <Clock size={18} color="#10b981" />
          Recent Activity
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
          No recent activity
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 style={{ 
        margin: 0, 
        marginBottom: '1rem',
        fontSize: '1rem', 
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <Clock size={18} color="#10b981" />
        Recent Activity
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {activities.map(activity => {
          const ActionIcon = actionIcons[activity.action] || Eye
          const ResourceIcon = resourceIcons[activity.resource_type] || FileText
          
          return (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.625rem',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ResourceIcon size={14} color="#10b981" />
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.813rem',
                  color: '#f1f5f9',
                  marginBottom: '0.125rem',
                }}>
                  {activity.description}
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  {activity.user_name && (
                    <span>{activity.user_name}</span>
                  )}
                  <span>{formatTime(activity.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
