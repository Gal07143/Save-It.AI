import { Link, useLocation } from 'wouter'
import { 
  LayoutDashboard, Building2, Network, Gauge, Receipt, Users, 
  Battery, Plug, Search, Bell, Settings, DollarSign, Leaf, FileText,
  ShieldCheck, Calculator, Wrench, Bot, TrendingUp, Shield, LogOut, User,
  FileSpreadsheet, GitBranch, FileCheck, Zap
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, Site } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
  currentSite: number | null
  onSiteChange: (siteId: number | null) => void
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/sites', icon: Building2, label: 'Sites' },
  { path: '/assets', icon: Network, label: 'Digital Twin' },
  { path: '/twin-builder', icon: GitBranch, label: 'Twin Builder' },
  { path: '/meters', icon: Gauge, label: 'Meters' },
  { path: '/data-ingestion', icon: FileSpreadsheet, label: 'Data Ingestion' },
  { path: '/bills', icon: Receipt, label: 'Bills' },
  { path: '/mv-audit', icon: FileCheck, label: 'M&V Audit' },
  { path: '/supplier-comparison', icon: Zap, label: 'Supplier Compare' },
  { path: '/tariffs', icon: DollarSign, label: 'Tariffs' },
  { path: '/tenants', icon: Users, label: 'Tenants' },
  { path: '/bess', icon: Battery, label: 'BESS Simulator' },
  { path: '/integrations', icon: Plug, label: 'Integrations' },
  { path: '/gap-analysis', icon: Search, label: 'Gap Analysis' },
  { path: '/carbon', icon: Leaf, label: 'Carbon / ESG' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/data-quality', icon: ShieldCheck, label: 'Data Quality' },
  { path: '/virtual-meters', icon: Calculator, label: 'Virtual Meters' },
  { path: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { path: '/ai-agents', icon: Bot, label: 'AI Agents' },
  { path: '/forecasting', icon: TrendingUp, label: 'Forecasting' },
  { path: '/admin', icon: Shield, label: 'Admin' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children, currentSite, onSiteChange }: LayoutProps) {
  const [location] = useLocation()
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: '240px',
        background: '#1e293b',
        color: 'white',
        padding: '1rem 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '0 1rem 1.5rem', borderBottom: '1px solid #334155' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Battery size={24} color="#10b981" />
            SAVE-IT.AI
          </h1>
        </div>

        <div style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
            Current Site
          </label>
          <select
            value={currentSite || ''}
            onChange={(e) => onSiteChange(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #475569',
              background: '#334155',
              color: 'white',
            }}
          >
            <option value="">All Sites</option>
            {sites?.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = location === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  color: isActive ? 'white' : '#94a3b8',
                  background: isActive ? '#334155' : 'transparent',
                  borderLeft: isActive ? '3px solid #10b981' : '3px solid transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                }}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
          <a href="/api/v1/docs" target="_blank" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#94a3b8',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}>
            <Settings size={16} />
            API Docs
          </a>
          
          {user && (
            <div style={{ 
              padding: '0.75rem', 
              background: '#334155', 
              borderRadius: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <User size={16} color="#10b981" />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {user.first_name || user.email.split('@')[0]}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {user.organization_name || 'Organization'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                {user.role.replace('_', ' ').toUpperCase()}
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
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto', background: '#f1f5f9' }}>
        {children}
      </main>
    </div>
  )
}
