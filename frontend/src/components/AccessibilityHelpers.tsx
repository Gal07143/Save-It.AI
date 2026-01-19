import { useEffect, useRef, ReactNode } from 'react'

export function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        background: '#10b981',
        color: 'white',
        padding: '0.5rem 1rem',
        zIndex: 10000,
        textDecoration: 'none',
        borderRadius: '0 0 0.5rem 0',
      }}
      onFocus={e => e.currentTarget.style.top = '0'}
      onBlur={e => e.currentTarget.style.top = '-40px'}
    >
      Skip to main content
    </a>
  )
}

export function FocusTrap({ children, active }: { children: ReactNode; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    firstElement?.focus()
    containerRef.current.addEventListener('keydown', handleKeyDown)
    
    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown)
    }
  }, [active])

  return <div ref={containerRef}>{children}</div>
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  )
}

export function LiveRegion({ 
  message, 
  politeness = 'polite',
}: { 
  message: string
  politeness?: 'polite' | 'assertive'
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  )
}

export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return ref
}

export function useAnnounce() {
  const announce = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('a11y-announcer')
    if (announcer) {
      announcer.setAttribute('aria-live', politeness)
      announcer.textContent = message
    }
  }

  return announce
}

export function A11yAnnouncer() {
  return (
    <div
      id="a11y-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    />
  )
}

export function ReducedMotion({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const prefersReducedMotion = 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion && fallback) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export function useHighContrast() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: more)').matches
}
