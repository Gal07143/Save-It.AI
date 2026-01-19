import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { FileText, Download, FileSpreadsheet, Building2, Gauge, Receipt, BarChart3, Sun, Zap, DollarSign, Shield, Wrench, Clock, Calendar, Mail, Plus } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'

export default function Reports({ currentSite }: { currentSite: number | null }) {
  const [activeTab, setActiveTab] = useState('site-summary')
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const tabs: Tab[] = [
    { id: 'site-summary', label: 'Site Summary', icon: Building2 },
    { id: 'energy-analysis', label: 'Energy Analysis', icon: BarChart3 },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'custom-builder', label: 'Custom Builder', icon: Wrench },
    { id: 'scheduled', label: 'Scheduled', icon: Clock },
  ]

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

  const renderSiteSummary = () => (
    <>
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

      <div className="card">
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
    </>
  )

  const renderEnergyAnalysis = () => (
    <>
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
    </>
  )

  const renderFinancial = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign size={20} color="#10b981" />
          Financial Reports
        </h2>
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <DollarSign size={32} color="#10b981" />
          </div>
          <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Cost Analysis</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Detailed breakdown of energy costs by site, meter, and time period
          </p>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6 }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <BarChart3 size={32} color="#3b82f6" />
          </div>
          <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Savings Reports</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Track energy savings from optimization and efficiency measures
          </p>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6 }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(249, 115, 22, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Receipt size={32} color="#f97316" />
          </div>
          <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Budget vs Actual</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Compare budgeted energy costs against actual spending
          </p>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6 }}>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  )

  const renderCompliance = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="#8b5cf6" />
          Compliance & Regulatory Reports
        </h2>
      </div>
      <div className="grid grid-2" style={{ gap: '1rem' }}>
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.5rem',
              background: 'rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={24} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>ISO 50001 Report</div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Energy management system compliance</div>
            </div>
          </div>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6, width: '100%' }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.5rem',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={24} color="#10b981" />
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>Carbon Disclosure</div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>CDP and GHG Protocol reports</div>
            </div>
          </div>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6, width: '100%' }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building2 size={24} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>NABERS Rating</div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>National Australian Built Environment Rating</div>
            </div>
          </div>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6, width: '100%' }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e2e8f0', 
          borderRadius: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '0.5rem',
              background: 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BarChart3 size={24} color="#eab308" />
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>Energy Performance Certificate</div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>EPC compliance documentation</div>
            </div>
          </div>
          <button className="btn btn-secondary" disabled style={{ opacity: 0.6, width: '100%' }}>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  )

  const renderCustomBuilder = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={20} color="#f59e0b" />
          Custom Report Builder
        </h2>
      </div>
      <div style={{ 
        padding: '3rem', 
        textAlign: 'center',
        border: '2px dashed #e2e8f0',
        borderRadius: '0.5rem',
        background: 'rgba(241, 245, 249, 0.5)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <Plus size={40} color="#f59e0b" />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>
          Build Custom Reports
        </h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          Create tailored reports by selecting metrics, date ranges, and visualization options that match your specific needs.
        </p>
        <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}>
          <Plus size={16} style={{ marginRight: '0.5rem' }} />
          Create Custom Report (Coming Soon)
        </button>
      </div>
    </div>
  )

  const renderScheduled = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} color="#3b82f6" />
          Scheduled Reports
        </h2>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          Set up automated report delivery to receive reports on a regular schedule.
        </p>
      </div>
      
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        background: 'rgba(241, 245, 249, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem'
            }}>
              <Calendar size={28} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Daily, Weekly, Monthly</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem'
            }}>
              <Mail size={28} color="#10b981" />
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Email Delivery</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem'
            }}>
              <FileText size={28} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>PDF & Excel Formats</div>
          </div>
        </div>
        <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}>
          <Plus size={16} style={{ marginRight: '0.5rem' }} />
          Schedule New Report (Coming Soon)
        </button>
      </div>
    </div>
  )

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'site-summary':
        return renderSiteSummary()
      case 'energy-analysis':
        return renderEnergyAnalysis()
      case 'financial':
        return renderFinancial()
      case 'compliance':
        return renderCompliance()
      case 'custom-builder':
        return renderCustomBuilder()
      case 'scheduled':
        return renderScheduled()
      default:
        return renderSiteSummary()
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Reports & Exports</h1>
        <p style={{ color: '#64748b' }}>Download Excel exports and PDF reports for your energy data</p>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="default"
        size="md"
      >
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
