import { useState, useRef, useEffect, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({ 
  content, 
  children, 
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        let x = rect.left + rect.width / 2
        let y = rect.top
        
        switch (position) {
          case 'bottom':
            y = rect.bottom
            break
          case 'left':
            x = rect.left
            y = rect.top + rect.height / 2
            break
          case 'right':
            x = rect.right
            y = rect.top + rect.height / 2
            break
        }
        
        setCoords({ x, y })
        setVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTooltipStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      background: '#0f172a',
      color: '#f1f5f9',
      padding: '0.5rem 0.75rem',
      borderRadius: '0.5rem',
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      zIndex: 10000,
      pointerEvents: 'none',
      border: '1px solid #334155',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.15s ease',
    }

    switch (position) {
      case 'top':
        return {
          ...base,
          left: coords.x,
          top: coords.y - 8,
          transform: 'translateX(-50%) translateY(-100%)',
        }
      case 'bottom':
        return {
          ...base,
          left: coords.x,
          top: coords.y + 8,
          transform: 'translateX(-50%)',
        }
      case 'left':
        return {
          ...base,
          left: coords.x - 8,
          top: coords.y,
          transform: 'translateX(-100%) translateY(-50%)',
        }
      case 'right':
        return {
          ...base,
          left: coords.x + 8,
          top: coords.y,
          transform: 'translateY(-50%)',
        }
      default:
        return base
    }
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        style={{ display: 'inline-block' }}
      >
        {children}
      </span>
      {visible && (
        <div style={getTooltipStyles()}>
          {content}
        </div>
      )}
    </>
  )
}

export function TooltipIcon({ 
  label, 
  icon: Icon,
  size = 16,
}: { 
  label: string
  icon: React.ElementType
  size?: number
}) {
  return (
    <Tooltip content={label}>
      <span style={{ cursor: 'help', display: 'inline-flex' }}>
        <Icon size={size} color="#64748b" />
      </span>
    </Tooltip>
  )
}
