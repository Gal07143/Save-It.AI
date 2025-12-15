import { LucideIcon, Plus, Upload, Search, FileText, Zap } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ 
  icon: Icon = FileText, 
  title, 
  description, 
  action,
  secondaryAction,
}: EmptyStateProps) {
  const ActionIcon = action?.icon || Plus
  
  return (
    <div className="empty-state">
      <div style={{
        width: '80px',
        height: '80px',
        margin: '0 auto 1.5rem',
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={36} color="#10b981" style={{ opacity: 0.8 }} />
      </div>
      
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      
      {(action || secondaryAction) && (
        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {action && (
            <button 
              className="btn btn-primary" 
              onClick={action.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ActionIcon size={18} />
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button 
              className="btn btn-outline" 
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function NoSitesState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Zap}
      title="No Sites Added Yet"
      description="Add your first site to start monitoring energy consumption, managing bills, and optimizing costs."
      action={{ label: 'Add Your First Site', onClick: onAdd }}
    />
  )
}

export function NoMetersState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No Meters Found"
      description="Add meters to track energy consumption. Meters can be linked to assets in your digital twin."
      action={{ label: 'Add Meter', onClick: onAdd }}
    />
  )
}

export function NoBillsState({ onAdd, onImport }: { onAdd: () => void; onImport?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No Bills Uploaded"
      description="Upload utility bills to track costs, validate against meter readings, and identify savings opportunities."
      action={{ label: 'Add Bill', onClick: onAdd }}
      secondaryAction={onImport ? { label: 'Import from PDF', onClick: onImport } : undefined}
    />
  )
}

export function NoDataState({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      icon={Search}
      title={title}
      description={description}
    />
  )
}

export function UploadState({ 
  title, 
  description, 
  onUpload, 
}: { 
  title: string
  description: string
  onUpload: () => void
}) {
  return (
    <EmptyState
      icon={Upload}
      title={title}
      description={description}
      action={{ label: 'Upload File', onClick: onUpload, icon: Upload }}
    />
  )
}
