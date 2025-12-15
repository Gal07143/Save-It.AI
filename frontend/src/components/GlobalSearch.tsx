import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { 
  Search, Building2, Gauge, Receipt, FileText, Settings,
  Network, Sun, Battery, TrendingUp, Users, DollarSign,
  LayoutDashboard, Activity, Wrench, Shield, Calculator, Plug,
  FileSpreadsheet, GitBranch, FileCheck, Zap, ShieldCheck
} from 'lucide-react'

interface GlobalSearchProps {
  onClose: () => void
  sites: Array<{ id: number; name: string; address?: string }>
}

interface SearchResult {
  type: 'page' | 'site' | 'action'
  icon: React.ElementType
  title: string
  subtitle?: string
  path: string
}

const pages = [
  { path: '/', icon: LayoutDashboard, title: 'Dashboard', subtitle: 'Overview and stats' },
  { path: '/sites', icon: Building2, title: 'Sites', subtitle: 'Manage locations' },
  { path: '/site-dashboard', icon: Activity, title: 'Site Dashboard', subtitle: 'Live site monitoring' },
  { path: '/assets', icon: Network, title: 'Digital Twin', subtitle: 'Asset hierarchy' },
  { path: '/twin-builder', icon: GitBranch, title: 'Twin Builder', subtitle: 'Build SLD diagram' },
  { path: '/meters', icon: Gauge, title: 'Meters', subtitle: 'Energy meters' },
  { path: '/virtual-meters', icon: Calculator, title: 'Virtual Meters', subtitle: 'Calculated meters' },
  { path: '/gateways', icon: Plug, title: 'Gateways', subtitle: 'Data collection' },
  { path: '/bills', icon: Receipt, title: 'Bills', subtitle: 'Utility bills' },
  { path: '/tariffs', icon: DollarSign, title: 'Tariffs', subtitle: 'Rate structures' },
  { path: '/supplier-comparison', icon: Zap, title: 'Supplier Compare', subtitle: 'Compare providers' },
  { path: '/mv-audit', icon: FileCheck, title: 'M&V Audit', subtitle: 'Measurement & verification' },
  { path: '/tenants', icon: Users, title: 'Tenants', subtitle: 'Sub-billing' },
  { path: '/pv-systems', icon: Sun, title: 'PV Systems', subtitle: 'Solar monitoring' },
  { path: '/storage-units', icon: Battery, title: 'Storage Units', subtitle: 'Battery storage' },
  { path: '/bess', icon: Battery, title: 'BESS Simulator', subtitle: 'Battery ROI analysis' },
  { path: '/gap-analysis', icon: Search, title: 'Gap Analysis', subtitle: 'Find unmetered loads' },
  { path: '/forecasting', icon: TrendingUp, title: 'Forecasting', subtitle: 'Load predictions' },
  { path: '/data-quality', icon: ShieldCheck, title: 'Data Quality', subtitle: 'Data validation' },
  { path: '/maintenance', icon: Wrench, title: 'Maintenance', subtitle: 'Predictive maintenance' },
  { path: '/data-ingestion', icon: FileSpreadsheet, title: 'Data Ingestion', subtitle: 'Import data' },
  { path: '/integrations', icon: Plug, title: 'Integrations', subtitle: 'Connected services' },
  { path: '/reports', icon: FileText, title: 'Reports', subtitle: 'Generate reports' },
  { path: '/admin', icon: Shield, title: 'Admin', subtitle: 'Administration' },
  { path: '/settings', icon: Settings, title: 'Settings', subtitle: 'Preferences' },
]

export default function GlobalSearch({ onClose, sites }: GlobalSearchProps) {
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, query])

  const getResults = (): SearchResult[] => {
    if (!query.trim()) {
      return pages.slice(0, 6).map(p => ({
        type: 'page' as const,
        icon: p.icon,
        title: p.title,
        subtitle: p.subtitle,
        path: p.path,
      }))
    }

    const q = query.toLowerCase()
    const results: SearchResult[] = []

    pages.forEach(page => {
      if (
        page.title.toLowerCase().includes(q) ||
        page.subtitle?.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'page',
          icon: page.icon,
          title: page.title,
          subtitle: page.subtitle,
          path: page.path,
        })
      }
    })

    sites.forEach(site => {
      if (
        site.name.toLowerCase().includes(q) ||
        site.address?.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'site',
          icon: Building2,
          title: site.name,
          subtitle: site.address || 'Site',
          path: `/site-dashboard/${site.id}`,
        })
      }
    })

    return results.slice(0, 10)
  }

  const results = getResults()

  const handleSelect = (result: SearchResult) => {
    setLocation(result.path)
    onClose()
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '540px',
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid #334155',
        }}>
          <Search size={20} color="#94a3b8" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Search pages, sites, or actions..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1rem',
              outline: 'none',
            }}
            aria-label="Search"
          />
          <button
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ESC
          </button>
        </div>

        <div 
          ref={resultsRef}
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
          }}
          className="scrollbar-thin"
        >
          {results.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#64748b',
            }}>
              No results found for "{query}"
            </div>
          ) : (
            <>
              <div style={{
                padding: '0.5rem 1rem',
                fontSize: '0.7rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {query ? 'Results' : 'Quick Access'}
              </div>
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.path}`}
                  onClick={() => handleSelect(result)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: index === selectedIndex ? '#334155' : 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0.5rem',
                    background: result.type === 'site' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <result.icon size={18} color={result.type === 'site' ? '#10b981' : '#a5b4fc'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {result.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {result.subtitle}
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      Press Enter
                    </div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          fontSize: '0.75rem',
          color: '#64748b',
        }}>
          <span>
            <kbd style={{ background: '#334155', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', marginRight: '0.25rem' }}>↑↓</kbd>
            Navigate
          </span>
          <span>
            <kbd style={{ background: '#334155', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', marginRight: '0.25rem' }}>↵</kbd>
            Select
          </span>
          <span>
            <kbd style={{ background: '#334155', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', marginRight: '0.25rem' }}>esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}
