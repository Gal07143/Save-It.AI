import { useState, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react'

interface DataPoint {
  x: number | string | Date
  y: number
  label?: string
}

interface InteractiveChartProps {
  data: DataPoint[]
  type?: 'line' | 'bar' | 'area'
  title?: string
  xLabel?: string
  yLabel?: string
  color?: string
  height?: number
  onDrillDown?: (point: DataPoint) => void
}

interface ZoomState {
  scale: number
  offsetX: number
  offsetY: number
}

export default function InteractiveChart({
  data,
  type = 'line',
  title,
  xLabel,
  yLabel,
  color = '#10b981',
  height = 300,
  onDrillDown,
}: InteractiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleZoomIn = () => {
    setZoom(prev => ({ ...prev, scale: Math.min(prev.scale * 1.5, 5) }))
  }

  const handleZoomOut = () => {
    setZoom(prev => ({ ...prev, scale: Math.max(prev.scale / 1.5, 0.5) }))
  }

  const handleReset = () => {
    setZoom({ scale: 1, offsetX: 0, offsetY: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - zoom.offsetX, y: e.clientY - zoom.offsetY })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setZoom(prev => ({
        ...prev,
        offsetX: e.clientX - panStart.x,
        offsetY: e.clientY - panStart.y,
      }))
    }
  }, [isPanning, panStart])

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * delta, 0.5), 5),
    }))
  }

  const handlePointHover = (point: DataPoint, e: React.MouseEvent) => {
    setHoveredPoint(point)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  const handlePointClick = (point: DataPoint) => {
    if (onDrillDown) {
      onDrillDown(point)
    }
  }

  const handleExport = () => {
    const csvContent = [
      ['X', 'Y', 'Label'].join(','),
      ...data.map(d => [d.x, d.y, d.label || ''].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title || 'chart'}_data.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!data.length) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#64748b',
      }}>
        No data available
      </div>
    )
  }

  const minY = Math.min(...data.map(d => d.y))
  const maxY = Math.max(...data.map(d => d.y))
  const range = maxY - minY || 1
  const padding = 40
  const chartWidth = 600
  const chartHeight = height - padding * 2

  const getX = (index: number) => padding + (index / (data.length - 1)) * (chartWidth - padding * 2)
  const getY = (value: number) => padding + chartHeight - ((value - minY) / range) * chartHeight

  const pathD = data.map((d, i) => {
    const x = getX(i)
    const y = getY(d.y)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const areaD = `${pathD} L ${getX(data.length - 1)} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
      }}>
        {title && (
          <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#f1f5f9' }}>
            {title}
          </h4>
        )}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            onClick={handleZoomIn}
            style={{
              background: 'rgba(100, 116, 139, 0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.375rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              background: 'rgba(100, 116, 139, 0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.375rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(100, 116, 139, 0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.375rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
            title="Reset view"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleExport}
            style={{
              background: 'rgba(100, 116, 139, 0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.375rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
            title="Export data"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div
        style={{
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'grab',
          borderRadius: '0.5rem',
          background: 'rgba(15, 23, 42, 0.5)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          style={{
            transform: `scale(${zoom.scale}) translate(${zoom.offsetX / zoom.scale}px, ${zoom.offsetY / zoom.scale}px)`,
            transformOrigin: 'center',
            transition: isPanning ? 'none' : 'transform 0.2s',
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
            const y = padding + chartHeight * (1 - tick)
            const value = minY + range * tick
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="4"
                />
                <text
                  x={padding - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                >
                  {value.toFixed(1)}
                </text>
              </g>
            )
          })}

          {type === 'area' && (
            <path
              d={areaD}
              fill={`${color}20`}
            />
          )}

          {type !== 'bar' && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {type === 'bar' ? (
            data.map((d, i) => {
              const barWidth = (chartWidth - padding * 2) / data.length * 0.8
              const x = getX(i) - barWidth / 2
              const barHeight = ((d.y - minY) / range) * chartHeight
              const y = padding + chartHeight - barHeight
              
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx="2"
                  style={{ cursor: onDrillDown ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => handlePointHover(d, e as any)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => handlePointClick(d)}
                />
              )
            })
          ) : (
            data.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d.y)}
                r={hoveredPoint === d ? 6 : 4}
                fill={color}
                stroke="#1e293b"
                strokeWidth="2"
                style={{ cursor: onDrillDown ? 'pointer' : 'default', transition: 'r 0.1s' }}
                onMouseEnter={(e) => handlePointHover(d, e as any)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => handlePointClick(d)}
              />
            ))
          )}

          {yLabel && (
            <text
              x={12}
              y={height / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
              transform={`rotate(-90, 12, ${height / 2})`}
            >
              {yLabel}
            </text>
          )}

          {xLabel && (
            <text
              x={chartWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
            >
              {xLabel}
            </text>
          )}
        </svg>
      </div>

      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            left: tooltipPos.x + 10,
            top: tooltipPos.y - 40,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: '#f1f5f9',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
            {hoveredPoint.label || String(hoveredPoint.x)}
          </div>
          <div style={{ color: color }}>
            {hoveredPoint.y.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChartDrillDown({
  parentData,
  childDataFetcher,
  title,
}: {
  parentData: DataPoint[]
  childDataFetcher: (point: DataPoint) => Promise<DataPoint[]>
  title?: string
}) {
  const [_drillLevel, setDrillLevel] = useState(0)
  const [currentData, setCurrentData] = useState(parentData)
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([title || 'Overview'])
  const [isLoading, setIsLoading] = useState(false)

  const handleDrillDown = async (point: DataPoint) => {
    setIsLoading(true)
    try {
      const childData = await childDataFetcher(point)
      setCurrentData(childData)
      setDrillLevel(prev => prev + 1)
      setBreadcrumbs(prev => [...prev, point.label || String(point.x)])
    } catch (err) {
      console.error('Failed to drill down:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrillUp = (index: number) => {
    if (index === 0) {
      setCurrentData(parentData)
      setDrillLevel(0)
      setBreadcrumbs([title || 'Overview'])
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        fontSize: '0.813rem',
      }}>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {i > 0 && <span style={{ color: '#64748b' }}>/</span>}
            <button
              onClick={() => handleDrillUp(i)}
              style={{
                background: 'transparent',
                border: 'none',
                color: i === breadcrumbs.length - 1 ? '#f1f5f9' : '#10b981',
                cursor: i === breadcrumbs.length - 1 ? 'default' : 'pointer',
                padding: 0,
                textDecoration: i === breadcrumbs.length - 1 ? 'none' : 'underline',
              }}
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {isLoading ? (
        <div style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
        }}>
          Loading...
        </div>
      ) : (
        <InteractiveChart
          data={currentData}
          onDrillDown={handleDrillDown}
          type="bar"
        />
      )}
    </div>
  )
}
