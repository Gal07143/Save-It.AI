import { Link, useLocation } from 'wouter'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
}

const pathLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/sites': 'Sites',
  '/site-dashboard': 'Site Dashboard',
  '/assets': 'Digital Twin',
  '/twin-builder': 'Twin Builder',
  '/meters': 'Meters',
  '/virtual-meters': 'Virtual Meters',
  '/gateways': 'Gateways',
  '/bills': 'Bills',
  '/tariffs': 'Tariffs',
  '/supplier-comparison': 'Supplier Compare',
  '/mv-audit': 'M&V Audit',
  '/tenants': 'Tenants',
  '/pv-systems': 'PV Systems',
  '/storage-units': 'Storage Units',
  '/bess': 'BESS Simulator',
  '/gap-analysis': 'Gap Analysis',
  '/forecasting': 'Forecasting',
  '/data-quality': 'Data Quality',
  '/maintenance': 'Maintenance',
  '/data-ingestion': 'Data Ingestion',
  '/integrations': 'Integrations',
  '/reports': 'Reports',
  '/admin': 'Admin',
  '/settings': 'Settings',
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const [location] = useLocation()
  
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items
    
    const parts = location.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', path: '/' }]
    
    let currentPath = ''
    for (const part of parts) {
      currentPath += '/' + part
      const label = pathLabels[currentPath] || part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      breadcrumbs.push({ label, path: currentPath })
    }
    
    return breadcrumbs
  }
  
  const breadcrumbs = generateBreadcrumbs()
  
  if (breadcrumbs.length <= 1) return null
  
  return (
    <nav 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.875rem',
      }}
      aria-label="Breadcrumb"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1
        
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {index === 0 ? (
              <Link 
                href={item.path || '/'}
                style={{ 
                  color: '#94a3b8', 
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Home size={16} />
              </Link>
            ) : (
              <>
                <ChevronRight size={14} color="#64748b" />
                {isLast ? (
                  <span style={{ color: '#f1f5f9', fontWeight: 500 }}>
                    {item.label}
                  </span>
                ) : (
                  <Link 
                    href={item.path || '/'}
                    style={{ color: '#94a3b8', textDecoration: 'none' }}
                  >
                    {item.label}
                  </Link>
                )}
              </>
            )}
          </div>
        )
      })}
    </nav>
  )
}
