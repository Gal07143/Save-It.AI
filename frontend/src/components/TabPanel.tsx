import { useState, ReactNode } from 'react'

export interface Tab {
  id: string
  label: string
  icon?: React.ElementType
  badge?: number | string
  disabled?: boolean
}

interface TabPanelProps {
  tabs: Tab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  children: (activeTab: string) => ReactNode
  variant?: 'default' | 'pills' | 'underline'
  size?: 'sm' | 'md' | 'lg'
}

export default function TabPanel({ 
  tabs, 
  activeTab: controlledActiveTab, 
  onTabChange, 
  children,
  variant = 'default',
  size = 'md'
}: TabPanelProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id || '')
  const activeTab = controlledActiveTab ?? internalActiveTab

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId)
    } else {
      setInternalActiveTab(tabId)
    }
  }

  const sizeStyles = {
    sm: { padding: '0.375rem 0.75rem', fontSize: '0.75rem', iconSize: 14 },
    md: { padding: '0.5rem 1rem', fontSize: '0.875rem', iconSize: 16 },
    lg: { padding: '0.625rem 1.25rem', fontSize: '1rem', iconSize: 18 }
  }

  const getTabStyle = (tab: Tab, isActive: boolean) => {
    const base: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: sizeStyles[size].padding,
      fontSize: sizeStyles[size].fontSize,
      fontWeight: 500,
      border: 'none',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      opacity: tab.disabled ? 0.5 : 1,
      whiteSpace: 'nowrap'
    }

    if (variant === 'default') {
      return {
        ...base,
        background: isActive ? '#10b981' : 'rgba(30, 41, 59, 0.5)',
        color: isActive ? 'white' : '#94a3b8',
        borderRadius: '6px'
      }
    }

    if (variant === 'pills') {
      return {
        ...base,
        background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        color: isActive ? '#10b981' : '#94a3b8',
        borderRadius: '9999px',
        border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
      }
    }

    if (variant === 'underline') {
      return {
        ...base,
        background: 'transparent',
        color: isActive ? '#10b981' : '#94a3b8',
        borderRadius: 0,
        borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
        marginBottom: '-1px'
      }
    }

    return base
  }

  const containerStyle: React.CSSProperties = variant === 'underline' 
    ? { 
        display: 'flex', 
        gap: '0.25rem', 
        borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        scrollbarWidth: 'thin'
      }
    : { 
        display: 'flex', 
        gap: '0.5rem', 
        background: 'rgba(15, 23, 42, 0.5)', 
        padding: '0.5rem', 
        borderRadius: '8px',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        scrollbarWidth: 'thin'
      }

  return (
    <div>
      <div style={containerStyle} role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              style={getTabStyle(tab, isActive)}
            >
              {Icon && <Icon size={sizeStyles[size].iconSize} />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: isActive ? 'white' : '#10b981',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">
        {children(activeTab)}
      </div>
    </div>
  )
}

export function TabContent({ 
  children, 
  className 
}: { 
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={className} style={{ animation: 'fadeIn 0.2s ease' }}>
      {children}
    </div>
  )
}
