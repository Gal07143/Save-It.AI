import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { 
  LayoutDashboard, Building2, Network, Gauge, Receipt, Users, 
  Battery, Plug, Search, Settings, DollarSign, FileText,
  ShieldCheck, Calculator, Wrench, Bot, TrendingUp, Shield, LogOut, User,
  FileSpreadsheet, GitBranch, FileCheck, Zap, Activity, Sun,
  ChevronDown, ChevronRight, Menu, X, Command, Sparkles
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import AIAssistant from './AIAssistant'
import GlobalSearch from './GlobalSearch'

interface LayoutProps {
  children: React.ReactNode
  currentSite: number | null
  onSiteChange: (siteId: number | null) => void
}

interface NavGroup {
  label: string
  icon: React.ElementType
  items: Array<{ path: string; icon: React.ElementType; label: string }>
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/sites', icon: Building2, label: 'Sites' },
      { path: '/site-dashboard', icon: Activity, label: 'Site Dashboard' },
    ]
  },
  {
    label: 'Assets & Metering',
    icon: Network,
    items: [
      { path: '/assets', icon: Network, label: 'Digital Twin' },
      { path: '/twin-builder', icon: GitBranch, label: 'Twin Builder' },
      { path: '/meters', icon: Gauge, label: 'Meters' },
      { path: '/virtual-meters', icon: Calculator, label: 'Virtual Meters' },
      { path: '/gateways', icon: Plug, label: 'Gateways' },
    ]
  },
  {
    label: 'Financial',
    icon: DollarSign,
    items: [
      { path: '/bills', icon: Receipt, label: 'Bills' },
      { path: '/tariffs', icon: DollarSign, label: 'Tariffs' },
      { path: '/supplier-comparison', icon: Zap, label: 'Supplier Compare' },
      { path: '/mv-audit', icon: FileCheck, label: 'M&V Audit' },
      { path: '/tenants', icon: Users, label: 'Tenants' },
    ]
  },
  {
    label: 'Energy Systems',
    icon: Sun,
    items: [
      { path: '/pv-systems', icon: Sun, label: 'PV Systems' },
      { path: '/storage-units', icon: Battery, label: 'Storage Units' },
      { path: '/bess', icon: Battery, label: 'BESS Simulator' },
    ]
  },
  {
    label: 'Analysis & AI',
    icon: Bot,
    items: [
      { path: '/gap-analysis', icon: Search, label: 'Gap Analysis' },
      { path: '/forecasting', icon: TrendingUp, label: 'Forecasting' },
      { path: '/data-quality', icon: ShieldCheck, label: 'Data Quality' },
      { path: '/maintenance', icon: Wrench, label: 'Maintenance' },
    ]
  },
  {
    label: 'Data & Reports',
    icon: FileText,
    items: [
      { path: '/data-ingestion', icon: FileSpreadsheet, label: 'Data Ingestion' },
      { path: '/integrations', icon: Plug, label: 'Integrations' },
      { path: '/reports', icon: FileText, label: 'Reports' },
    ]
  },
  {
    label: 'Administration',
    icon: Shield,
    items: [
      { path: '/admin', icon: Shield, label: 'Admin' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ]
  },
]

export default function Layout({ children, currentSite, onSiteChange }: LayoutProps) {
  const [location] = useLocation()
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { user, logout } = useAuth()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Overview']))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    navGroups.forEach(group => {
      if (group.items.some(item => item.path === location || location.startsWith(item.path + '/'))) {
        setExpandedGroups(prev => new Set([...prev, group.label]))
      }
    })
  }, [location])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const isItemActive = (path: string) => {
    if (path === '/') return location === '/'
    return location === path || location.startsWith(path + '/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1001,
          display: 'none',
          padding: '0.5rem',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          color: 'white',
          cursor: 'pointer',
        }}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside 
        style={{
          width: sidebarOpen ? '260px' : '72px',
          background: '#1e293b',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          position: 'fixed',
          top: 0,
          left: mobileMenuOpen ? 0 : undefined,
          bottom: 0,
          zIndex: 1000,
          transform: mobileMenuOpen ? 'translateX(0)' : undefined,
        }}
        className="sidebar"
      >
        <div style={{ 
          padding: '1rem', 
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
        }}>
          {sidebarOpen ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Zap size={18} color="white" />
                </div>
                <span style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>SAVE-IT.AI</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
                aria-label="Collapse sidebar"
              >
                <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
              aria-label="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {sidebarOpen && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                margin: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '0.5rem',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <Search size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
              <kbd style={{
                background: '#1e293b',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.125rem',
              }}>
                <Command size={10} />K
              </kbd>
            </button>

            <div style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>
              <label style={{ 
                fontSize: '0.7rem', 
                color: '#64748b', 
                display: 'block', 
                marginBottom: '0.375rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Active Site
              </label>
              <select
                value={currentSite || ''}
                onChange={(e) => onSiteChange(e.target.value ? Number(e.target.value) : null)}
                aria-label="Select site"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #475569',
                  background: '#334155',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Sites</option>
                {sites?.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }} className="scrollbar-thin">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.label)
            const hasActiveItem = group.items.some(item => isItemActive(item.path))
            
            return (
              <div key={group.label} style={{ marginBottom: '0.25rem' }}>
                {sidebarOpen ? (
                  <>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: hasActiveItem ? '#10b981' : '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textAlign: 'left',
                      }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {group.label}
                    </button>
                    
                    {isExpanded && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {group.items.map((item) => {
                          const isActive = isItemActive(item.path)
                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.625rem 0.75rem 0.625rem 1.75rem',
                                color: isActive ? 'white' : '#94a3b8',
                                background: isActive ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, transparent 100%)' : 'transparent',
                                borderLeft: isActive ? '3px solid #10b981' : '3px solid transparent',
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                transition: 'all 0.15s',
                              }}
                            >
                              <item.icon size={18} />
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.path)
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          title={item.label}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.75rem',
                            color: isActive ? '#10b981' : '#94a3b8',
                            background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            textDecoration: 'none',
                            transition: 'all 0.15s',
                          }}
                        >
                          <item.icon size={20} />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div style={{ 
          padding: sidebarOpen ? '0.75rem' : '0.5rem', 
          borderTop: '1px solid #334155',
        }}>
          {sidebarOpen ? (
            <>
              {user && (
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#334155', 
                  borderRadius: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <User size={14} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {user.first_name || user.email.split('@')[0]}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {user.role.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem',
                background: 'transparent',
                color: '#f87171',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      <main style={{ 
        flex: 1, 
        marginLeft: sidebarOpen ? '260px' : '72px',
        padding: '1.5rem', 
        overflow: 'auto', 
        background: '#0f172a',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease',
      }}>
        {children}
      </main>

      <AIAssistant currentSite={currentSite} currentPath={location} />
      
      {searchOpen && (
        <GlobalSearch 
          onClose={() => setSearchOpen(false)} 
          sites={sites || []}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: block !important;
          }
          .sidebar {
            transform: translateX(-100%);
          }
          main {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
