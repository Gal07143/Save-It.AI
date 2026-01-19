import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface TourStep {
  target: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

interface GuidedTourProps {
  tourId: string
  steps: TourStep[]
  onComplete?: () => void
}

export default function GuidedTour({ tourId, steps, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const hasCompleted = localStorage.getItem(`tour_${tourId}_completed`)
    const hasStarted = localStorage.getItem(`tour_${tourId}_started`)
    
    if (!hasCompleted && !hasStarted) {
      setTimeout(() => setIsActive(true), 1000)
      localStorage.setItem(`tour_${tourId}_started`, 'true')
    }
  }, [tourId])

  useEffect(() => {
    if (!isActive || !steps[currentStep]) return

    const findTarget = () => {
      const target = document.querySelector(steps[currentStep].target)
      if (target) {
        setTargetRect(target.getBoundingClientRect())
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    findTarget()
    const interval = setInterval(findTarget, 500)
    return () => clearInterval(interval)
  }, [isActive, currentStep, steps])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(`tour_${tourId}_completed`, 'true')
    setIsActive(false)
  }

  const handleComplete = () => {
    localStorage.setItem(`tour_${tourId}_completed`, 'true')
    setIsActive(false)
    onComplete?.()
  }

  if (!isActive || !targetRect) return null

  const step = steps[currentStep]
  const position = step.position || 'bottom'

  const getTooltipStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10001,
      width: '320px',
      background: '#1e293b',
      border: '1px solid #10b981',
      borderRadius: '0.75rem',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      animation: 'scaleIn 0.3s ease-out',
    }

    switch (position) {
      case 'top':
        return {
          ...base,
          left: targetRect.left + targetRect.width / 2 - 160,
          top: targetRect.top - 20,
          transform: 'translateY(-100%)',
        }
      case 'bottom':
        return {
          ...base,
          left: targetRect.left + targetRect.width / 2 - 160,
          top: targetRect.bottom + 20,
        }
      case 'left':
        return {
          ...base,
          left: targetRect.left - 340,
          top: targetRect.top + targetRect.height / 2 - 80,
        }
      case 'right':
        return {
          ...base,
          left: targetRect.right + 20,
          top: targetRect.top + targetRect.height / 2 - 80,
        }
      default:
        return base
    }
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
      }} />
      
      <div style={{
        position: 'fixed',
        left: targetRect.left - 8,
        top: targetRect.top - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        borderRadius: '0.5rem',
        border: '2px solid #10b981',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        pointerEvents: 'none',
      }} />

      <div style={getTooltipStyles()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid #334155',
        }}>
          <span style={{ 
            color: '#10b981', 
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>
        
        <div style={{ padding: '1rem' }}>
          <h4 style={{ 
            margin: 0, 
            marginBottom: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#f1f5f9',
          }}>
            {step.title}
          </h4>
          <p style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#94a3b8',
            lineHeight: 1.5,
          }}>
            {step.content}
          </p>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          borderTop: '1px solid #334155',
        }}>
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'transparent',
              border: 'none',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              color: currentStep === 0 ? '#475569' : '#94a3b8',
              fontSize: '0.813rem',
            }}
          >
            <ChevronLeft size={14} />
            Back
          </button>
          
          <button
            onClick={handleNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 1rem',
              background: '#10b981',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              color: 'white',
              fontSize: '0.813rem',
              fontWeight: 500,
            }}
          >
            {currentStep === steps.length - 1 ? (
              <>
                <Check size={14} />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export function resetTour(tourId: string): void {
  localStorage.removeItem(`tour_${tourId}_completed`)
  localStorage.removeItem(`tour_${tourId}_started`)
}

export const dashboardTourSteps: TourStep[] = [
  {
    target: '[data-tour="site-selector"]',
    title: 'Select a Site',
    content: 'Use the site selector to switch between different locations you manage.',
    position: 'bottom',
  },
  {
    target: '[data-tour="search"]',
    title: 'Quick Search',
    content: 'Press Ctrl+K (or Cmd+K) to quickly search for pages, sites, and actions.',
    position: 'bottom',
  },
  {
    target: '[data-tour="nav-overview"]',
    title: 'Navigation',
    content: 'Navigate through different sections using the sidebar. Groups can be expanded or collapsed.',
    position: 'right',
  },
]
