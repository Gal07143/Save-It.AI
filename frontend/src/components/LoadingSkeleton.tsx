interface SkeletonProps {
  variant?: 'text' | 'title' | 'card' | 'table-row' | 'stat' | 'chart'
  width?: string
  height?: string
  count?: number
}

export default function LoadingSkeleton({ 
  variant = 'text', 
  width, 
  height, 
  count = 1 
}: SkeletonProps) {
  const getStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-loading 1.5s infinite',
      borderRadius: '0.375rem',
    }

    switch (variant) {
      case 'title':
        return { ...baseStyle, height: height || '1.5rem', width: width || '60%' }
      case 'card':
        return { ...baseStyle, height: height || '120px', width: width || '100%' }
      case 'table-row':
        return { ...baseStyle, height: height || '3rem', width: width || '100%', marginBottom: '0.5rem' }
      case 'stat':
        return { ...baseStyle, height: height || '80px', width: width || '100%' }
      case 'chart':
        return { ...baseStyle, height: height || '200px', width: width || '100%' }
      default:
        return { ...baseStyle, height: height || '1rem', width: width || '100%', marginBottom: '0.5rem' }
    }
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={getStyles()} />
      ))}
    </>
  )
}

export function CardSkeleton() {
  return (
    <div className="card">
      <LoadingSkeleton variant="title" width="50%" />
      <div style={{ marginTop: '1rem' }}>
        <LoadingSkeleton count={3} />
      </div>
    </div>
  )
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <LoadingSkeleton variant="stat" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card">
      <LoadingSkeleton variant="title" width="30%" />
      <div style={{ marginTop: '1rem' }}>
        <LoadingSkeleton variant="table-row" count={rows} />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <LoadingSkeleton variant="title" width="40%" />
      <div style={{ marginTop: '1rem' }}>
        <LoadingSkeleton variant="chart" />
      </div>
    </div>
  )
}
