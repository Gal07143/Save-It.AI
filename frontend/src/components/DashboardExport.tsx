/**
 * Dashboard Export Component
 * Provides PNG, PDF, and CSV export functionality for dashboards.
 */

import { useState } from 'react'
import {
  Download, X, FileImage, FileText, FileSpreadsheet,
  Loader2, CheckCircle, AlertCircle
} from 'lucide-react'

type ExportFormat = 'png' | 'pdf' | 'csv'
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error'

interface ExportOption {
  format: ExportFormat
  name: string
  description: string
  icon: typeof FileImage
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'png',
    name: 'PNG Image',
    description: 'Export dashboard as a high-resolution image',
    icon: FileImage,
  },
  {
    format: 'pdf',
    name: 'PDF Report',
    description: 'Generate a formatted PDF document',
    icon: FileText,
  },
  {
    format: 'csv',
    name: 'CSV Data',
    description: 'Export widget data as spreadsheet',
    icon: FileSpreadsheet,
  },
]

interface DashboardExportProps {
  isOpen: boolean
  onClose: () => void
  dashboardId?: number
  dashboardName?: string
  containerRef?: React.RefObject<HTMLElement>
  widgetData?: Array<{
    id: number
    title: string
    type: string
    data: Record<string, unknown>
  }>
}

export default function DashboardExport({
  isOpen,
  onClose,
  dashboardId,
  dashboardName = 'Dashboard',
  containerRef,
  widgetData,
}: DashboardExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png')
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [includeTimestamp, setIncludeTimestamp] = useState(true)
  const [includeWidgetData, setIncludeWidgetData] = useState(true)

  if (!isOpen) return null

  const handleExport = async () => {
    setStatus('exporting')
    setErrorMessage('')

    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${dashboardName.replace(/\s+/g, '-').toLowerCase()}-${timestamp}`

      switch (selectedFormat) {
        case 'png':
          await exportAsPng(filename, containerRef)
          break
        case 'pdf':
          await exportAsPdf(filename, dashboardId)
          break
        case 'csv':
          await exportAsCsv(filename, widgetData)
          break
      }

      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        onClose()
      }, 1500)
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Export failed')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={20} />
            Export Dashboard
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Export Format
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {EXPORT_OPTIONS.map(option => {
                const Icon = option.icon
                return (
                  <button
                    key={option.format}
                    onClick={() => setSelectedFormat(option.format)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: selectedFormat === option.format ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                      border: `1px solid ${selectedFormat === option.format ? '#10b981' : '#334155'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.5rem',
                      background: selectedFormat === option.format ? 'rgba(16, 185, 129, 0.2)' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={20} color={selectedFormat === option.format ? '#10b981' : '#64748b'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: '#f1f5f9' }}>{option.name}</div>
                      <div style={{ fontSize: '0.813rem', color: '#64748b' }}>{option.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={e => setIncludeTimestamp(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ color: '#f1f5f9' }}>Include timestamp in filename</span>
              </label>
              {selectedFormat === 'csv' && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={includeWidgetData}
                    onChange={e => setIncludeWidgetData(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ color: '#f1f5f9' }}>Include all widget data</span>
                </label>
              )}
            </div>
          </div>

          {status === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              color: '#f87171',
            }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '0.875rem' }}>{errorMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              color: '#34d399',
            }}>
              <CheckCircle size={18} />
              <span style={{ fontSize: '0.875rem' }}>Export completed successfully!</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={status === 'exporting'}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={status === 'exporting'}
            style={{ minWidth: '120px' }}
          >
            {status === 'exporting' ? (
              <>
                <Loader2 size={16} className="spinning" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/**
 * Export dashboard container as PNG image.
 * Uses html2canvas library (would need to be installed).
 */
async function exportAsPng(filename: string, containerRef?: React.RefObject<HTMLElement>): Promise<void> {
  // Check if html2canvas is available
  if (typeof window !== 'undefined') {
    try {
      // Dynamic import of html2canvas
      const html2canvas = (await import('html2canvas')).default

      const element = containerRef?.current || document.querySelector('.page-container') || document.body

      const canvas = await html2canvas(element as HTMLElement, {
        backgroundColor: '#0f172a',
        scale: 2, // Higher resolution
        logging: false,
        useCORS: true,
      })

      // Convert to blob and download
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${filename}.png`
          a.click()
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    } catch (error) {
      // Fallback: Create a simple canvas screenshot
      console.warn('html2canvas not available, using fallback method')
      throw new Error('PNG export requires html2canvas library. Please install it: npm install html2canvas')
    }
  }
}

/**
 * Export dashboard as PDF.
 * Would typically call a backend endpoint for server-side PDF generation.
 */
async function exportAsPdf(filename: string, dashboardId?: number): Promise<void> {
  if (dashboardId) {
    // Call backend PDF export endpoint
    const response = await fetch(`/api/v1/dashboards/${dashboardId}/export/pdf`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('PDF export failed. Backend endpoint may not be available.')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } else {
    // Fallback: Use browser print
    window.print()
  }
}

/**
 * Export widget data as CSV.
 */
async function exportAsCsv(
  filename: string,
  widgetData?: Array<{ id: number; title: string; type: string; data: Record<string, unknown> }>
): Promise<void> {
  if (!widgetData || widgetData.length === 0) {
    throw new Error('No widget data available for export')
  }

  // Build CSV content
  const rows: string[] = []

  // Header
  rows.push('Widget ID,Widget Title,Widget Type,Data Key,Data Value')

  // Data rows
  for (const widget of widgetData) {
    if (widget.data && typeof widget.data === 'object') {
      for (const [key, value] of Object.entries(widget.data)) {
        const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
        rows.push(`${widget.id},"${widget.title}",${widget.type},"${key}","${formattedValue}"`)
      }
    } else {
      rows.push(`${widget.id},"${widget.title}",${widget.type},-,-`)
    }
  }

  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Utility hook for dashboard export
 */
export function useDashboardExport(
  dashboardId?: number,
  dashboardName?: string,
  containerRef?: React.RefObject<HTMLElement>
) {
  const [isExportOpen, setIsExportOpen] = useState(false)

  const openExport = () => setIsExportOpen(true)
  const closeExport = () => setIsExportOpen(false)

  const ExportModal = ({ widgetData }: { widgetData?: Array<{ id: number; title: string; type: string; data: Record<string, unknown> }> }) => (
    <DashboardExport
      isOpen={isExportOpen}
      onClose={closeExport}
      dashboardId={dashboardId}
      dashboardName={dashboardName}
      containerRef={containerRef}
      widgetData={widgetData}
    />
  )

  return {
    isExportOpen,
    openExport,
    closeExport,
    ExportModal,
  }
}
