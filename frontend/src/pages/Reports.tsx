import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { FileText, Download, FileSpreadsheet, Building2, Gauge, Receipt, BarChart3, Sun, Zap } from 'lucide-react'

export default function Reports({ currentSite }: { currentSite: number | null }) {
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const excelExports = [
    {
      title: 'Sites Export',
      description: 'Export all sites with addresses and configuration',
      icon: Building2,
      color: '#1e40af',
      url: api.exports.sitesUrl(),
      filename: 'sites_export.xlsx'
    },
    {
      title: 'Meters Export',
      description: 'Export all meters with readings and status',
      icon: Gauge,
      color: '#10b981',
      url: api.exports.metersUrl(currentSite || undefined),
      filename: 'meters_export.xlsx'
    },
    {
      title: 'Bills Export',
      description: 'Export utility bills with validation status',
      icon: Receipt,
      color: '#f59e0b',
      url: api.exports.billsUrl(currentSite || undefined),
      filename: 'bills_export.xlsx'
    },
  ]

  const pdfReports = sites?.map(site => ({
    title: `${site.name} - Site Summary`,
    description: 'Comprehensive site report with assets, meters, and bills',
    icon: FileText,
    color: '#8b5cf6',
    url: api.reports.siteSummaryUrl(site.id),
    filename: `site_${site.id}_summary.pdf`
  })) || []

  const energyReports = sites?.map(site => ({
    title: `${site.name} - Energy Analysis`,
    description: '12-month energy consumption and cost analysis',
    icon: BarChart3,
    color: '#ef4444',
    url: api.reports.energyAnalysisUrl(site.id),
    filename: `energy_analysis_${site.id}.pdf`
  })) || []

  const pvGenerationReports = sites?.map(site => ({
    title: `${site.name} - PV Generation`,
    description: 'Solar production, capacity factor, and performance ratio',
    icon: Sun,
    color: '#f59e0b',
    url: `/api/v1/reports/pv-generation/${site.id}`,
    filename: `pv_generation_${site.id}.pdf`
  })) || []

  const gridExportReports = sites?.map(site => ({
    title: `${site.name} - Grid Export`,
    description: 'Energy sold to grid, feed-in revenue, and export summary',
    icon: Zap,
    color: '#10b981',
    url: `/api/v1/reports/grid-export/${site.id}`,
    filename: `grid_export_${site.id}.pdf`
  })) || []

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Reports & Exports</h1>
        <p style={{ color: '#64748b' }}>Download Excel exports and PDF reports for your energy data</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={20} color="#10b981" />
            Excel Exports
          </h2>
        </div>
        <div className="grid grid-3" style={{ gap: '1rem' }}>
          {excelExports.map((exp) => (
            <div 
              key={exp.title} 
              style={{ 
                padding: '1.5rem', 
                border: '1px solid #e2e8f0', 
                borderRadius: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '0.5rem',
                  background: `${exp.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <exp.icon size={24} color={exp.color} />
                </div>
                <div>
                  <div style={{ fontWeight: '600' }}>{exp.title}</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{exp.description}</div>
                </div>
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => handleDownload(exp.url, exp.filename)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Download size={16} />
                Download Excel
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="#8b5cf6" />
            Site Summary Reports (PDF)
          </h2>
        </div>
        {pdfReports.length > 0 ? (
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            {pdfReports.map((report) => (
              <div 
                key={report.title} 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <report.icon size={24} color={report.color} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{report.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{report.description}</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleDownload(report.url, report.filename)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Download size={14} />
                  PDF
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            No sites available. Create a site first to generate reports.
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} color="#ef4444" />
            Energy Analysis Reports (PDF)
          </h2>
        </div>
        {energyReports.length > 0 ? (
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            {energyReports.map((report) => (
              <div 
                key={report.title} 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <report.icon size={24} color={report.color} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{report.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{report.description}</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleDownload(report.url, report.filename)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Download size={14} />
                  PDF
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            No sites available. Create a site first to generate reports.
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sun size={20} color="#f59e0b" />
            Power Generation Reports (PDF)
          </h2>
        </div>
        {pvGenerationReports.length > 0 ? (
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            {pvGenerationReports.map((report) => (
              <div 
                key={report.title} 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <report.icon size={24} color={report.color} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{report.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{report.description}</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleDownload(report.url, report.filename)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Download size={14} />
                  PDF
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            No sites available. Create a site first to generate reports.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={20} color="#10b981" />
            Grid Export Reports (PDF)
          </h2>
        </div>
        {gridExportReports.length > 0 ? (
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            {gridExportReports.map((report) => (
              <div 
                key={report.title} 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <report.icon size={24} color={report.color} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{report.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{report.description}</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleDownload(report.url, report.filename)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Download size={14} />
                  PDF
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            No sites available. Create a site first to generate reports.
          </p>
        )}
      </div>
    </div>
  )
}
