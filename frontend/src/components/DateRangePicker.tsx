import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

interface DateRange {
  start: Date
  end: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const presets = [
  { label: 'Today', getValue: () => {
    const today = new Date()
    return { start: today, end: today }
  }},
  { label: 'Last 7 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    return { start, end }
  }},
  { label: 'Last 30 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return { start, end }
  }},
  { label: 'This month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start, end }
  }},
  { label: 'Last month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start, end }
  }},
  { label: 'This year', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear(), 11, 31)
    return { start, end }
  }},
  { label: 'Last 12 months', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 12)
    return { start, end }
  }},
]

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customStart, setCustomStart] = useState(formatDateInput(value.start))
  const [customEnd, setCustomEnd] = useState(formatDateInput(value.end))

  function formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  function formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handlePreset = (preset: typeof presets[0]) => {
    const range = preset.getValue()
    onChange(range)
    setCustomStart(formatDateInput(range.start))
    setCustomEnd(formatDateInput(range.end))
    setIsOpen(false)
  }

  const handleCustomApply = () => {
    onChange({
      start: new Date(customStart),
      end: new Date(customEnd),
    })
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          color: '#f1f5f9',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        <Calendar size={16} color="#10b981" />
        <span>{formatDateDisplay(value.start)} - {formatDateDisplay(value.end)}</span>
        <ChevronDown size={16} color="#64748b" />
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            minWidth: '280px',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '0.5rem' }}>
              <div style={{
                fontSize: '0.7rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.5rem 0.75rem',
              }}>
                Quick Select
              </div>
              {presets.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            <div style={{
              borderTop: '1px solid #334155',
              padding: '0.75rem',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}>
                Custom Range
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    color: '#f1f5f9',
                    fontSize: '0.75rem',
                  }}
                />
                <span style={{ color: '#64748b' }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    color: '#f1f5f9',
                    fontSize: '0.75rem',
                  }}
                />
              </div>
              <button
                onClick={handleCustomApply}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.813rem',
                  fontWeight: 500,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
