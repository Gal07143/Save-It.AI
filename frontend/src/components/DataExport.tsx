import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, File, ChevronDown } from 'lucide-react'

interface DataExportProps {
  data: unknown[]
  filename: string
  columns?: { key: string; header: string }[]
}

export default function DataExport({ data, filename, columns }: DataExportProps) {
  const [isOpen, setIsOpen] = useState(false)

  const exportCSV = () => {
    if (!data.length) return

    const headers = columns?.map(c => c.header) || Object.keys(data[0] as object)
    const keys = columns?.map(c => c.key) || Object.keys(data[0] as object)

    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        keys.map(key => {
          const value = (row as Record<string, unknown>)[key]
          if (value === null || value === undefined) return ''
          const strVal = String(value)
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`
          }
          return strVal
        }).join(',')
      )
    ].join('\n')

    downloadFile(csvContent, `${filename}.csv`, 'text/csv')
    setIsOpen(false)
  }

  const exportJSON = () => {
    const jsonContent = JSON.stringify(data, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json')
    setIsOpen(false)
  }

  const downloadFile = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.75rem',
          background: 'transparent',
          border: '1px solid #475569',
          borderRadius: '0.5rem',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '0.813rem',
        }}
      >
        <Download size={16} />
        Export
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            right: 0,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            minWidth: '160px',
            overflow: 'hidden',
          }}>
            <button
              onClick={exportCSV}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.875rem',
                background: 'transparent',
                border: 'none',
                color: '#f1f5f9',
                cursor: 'pointer',
                fontSize: '0.813rem',
                textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#334155'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <FileSpreadsheet size={16} color="#10b981" />
              Export as CSV
            </button>
            <button
              onClick={exportJSON}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.875rem',
                background: 'transparent',
                border: 'none',
                color: '#f1f5f9',
                cursor: 'pointer',
                fontSize: '0.813rem',
                textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#334155'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <FileText size={16} color="#3b82f6" />
              Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  )
}
