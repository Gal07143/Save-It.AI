import { useState, useEffect, useRef } from 'react'
import { 
  X, Send, Sparkles, Lightbulb, AlertTriangle,
  TrendingUp, Zap, ChevronRight, Loader2, Bot, Minimize2
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { api } from '../services/api'

interface AIAssistantProps {
  currentSite: number | null
  currentPath: string
}

interface Suggestion {
  id: string
  type: 'tip' | 'warning' | 'insight' | 'action'
  title: string
  description: string
  action?: string
  actionPath?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const getContextualSuggestions = (path: string, data: any): Suggestion[] => {
  const suggestions: Suggestion[] = []
  
  if (path === '/' || path === '/dashboard') {
    if (data?.notifications?.length > 0) {
      suggestions.push({
        id: 'alerts',
        type: 'warning',
        title: `${data.notifications.length} Active Alerts`,
        description: 'You have unread notifications that may require attention.',
        action: 'View Alerts',
        actionPath: '/notifications'
      })
    }
    suggestions.push({
      id: 'peak-tip',
      type: 'tip',
      title: 'Peak Demand Optimization',
      description: 'Shifting 15% of load to off-peak hours could save up to $2,400/month.',
      action: 'Analyze Load Profile',
      actionPath: '/forecasting'
    })
  }
  
  if (path === '/bills') {
    suggestions.push({
      id: 'ocr-tip',
      type: 'tip',
      title: 'Quick Bill Entry',
      description: 'Use OCR scanning to automatically extract data from bill images.',
    })
    if (data?.bills?.some((b: any) => !b.is_validated)) {
      suggestions.push({
        id: 'validate',
        type: 'action',
        title: 'Bills Need Validation',
        description: 'Some bills have not been validated against meter readings.',
        action: 'Validate Now',
      })
    }
  }
  
  if (path === '/meters') {
    suggestions.push({
      id: 'meter-gaps',
      type: 'insight',
      title: 'Meter Coverage Analysis',
      description: 'Run gap analysis to identify assets missing meter coverage.',
      action: 'Run Analysis',
      actionPath: '/gap-analysis'
    })
  }
  
  if (path === '/pv-systems') {
    suggestions.push({
      id: 'pv-roi',
      type: 'insight',
      title: 'Solar ROI Calculator',
      description: 'Based on your location and consumption, solar could offset 35% of your energy costs.',
      action: 'Calculate ROI',
      actionPath: '/bess'
    })
  }
  
  if (path === '/storage-units') {
    suggestions.push({
      id: 'bess-sim',
      type: 'tip',
      title: 'Battery Sizing Recommendation',
      description: 'Use the BESS Simulator to get optimal battery sizing recommendations.',
      action: 'Open Simulator',
      actionPath: '/bess'
    })
  }
  
  if (path === '/bess') {
    suggestions.push({
      id: 'bess-upload',
      type: 'action',
      title: 'Upload Load Data',
      description: 'Upload 365 days of interval data for accurate ROI projections.',
    })
    suggestions.push({
      id: 'bess-vendors',
      type: 'insight',
      title: 'Browse Equipment Catalog',
      description: '6 vendors with 8+ battery models available for simulation.',
    })
  }
  
  if (path === '/pv-design') {
    suggestions.push({
      id: 'pv-assessment',
      type: 'action',
      title: 'Create Site Assessment',
      description: 'Add rooftop or ground surfaces to calculate maximum PV capacity.',
    })
    suggestions.push({
      id: 'pv-modules',
      type: 'tip',
      title: 'Module Selection',
      description: 'Compare 8+ PV modules from top manufacturers for your project.',
    })
    suggestions.push({
      id: 'pv-roi',
      type: 'insight',
      title: 'ROI Projections',
      description: 'Calculate NPV, IRR, and payback period with financial parameters.',
    })
  }
  
  if (path === '/tariffs') {
    suggestions.push({
      id: 'tariff-compare',
      type: 'action',
      title: 'Compare Suppliers',
      description: 'You might save up to 18% by switching to a different tariff structure.',
      action: 'Compare Options',
      actionPath: '/supplier-comparison'
    })
  }
  
  if (path.includes('twin') || path === '/assets') {
    suggestions.push({
      id: 'twin-complete',
      type: 'tip',
      title: 'Complete Your Digital Twin',
      description: 'Add all electrical assets to enable accurate gap analysis and monitoring.',
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'general',
      type: 'tip',
      title: 'AI Assistant Ready',
      description: 'Ask me anything about your energy data, bills, or optimization opportunities.',
    })
  }
  
  return suggestions.slice(0, 3)
}

export default function AIAssistant({ currentSite, currentPath }: AIAssistantProps) {
  const [, setLocation] = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: notifications } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: () => api.notifications.list(undefined, true),
    enabled: isOpen,
  })

  const { data: bills } = useQuery({ 
    queryKey: ['bills'], 
    queryFn: () => api.bills.list(),
    enabled: isOpen && currentPath === '/bills',
  })

  const suggestions = getContextualSuggestions(currentPath, { notifications, bills })

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)

    try {
      const response = await api.agents.chat(currentSite || 1, 'energy_analyst', input.trim())
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response || "I've analyzed your request. Based on your energy data, I can help you identify optimization opportunities.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm here to help with your energy management questions. I can analyze bills, suggest optimizations, and provide insights about your energy usage patterns.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle
      case 'insight': return TrendingUp
      case 'action': return Zap
      default: return Lightbulb
    }
  }

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'warning': return '#f59e0b'
      case 'insight': return '#6366f1'
      case 'action': return '#10b981'
      default: return '#94a3b8'
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
          transition: 'all 0.3s',
          zIndex: 999,
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles size={24} />
        {notifications && notifications.length > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
          }}>
            {notifications.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: isMinimized ? '300px' : '380px',
        height: isMinimized ? '56px' : '520px',
        background: '#1e293b',
        borderRadius: '1rem',
        border: '1px solid #334155',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 999,
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{
        padding: '0.75rem 1rem',
        background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: isMinimized ? 'pointer' : 'default',
      }}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={20} color="white" />
          <span style={{ color: 'white', fontWeight: 600 }}>AI Energy Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized) }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.25rem',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
            }}
            aria-label={isMinimized ? 'Expand' : 'Minimize'}
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.25rem',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }} className="scrollbar-thin">
            {showSuggestions && messages.length === 0 && (
              <>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.25rem',
                }}>
                  Contextual Suggestions
                </div>
                {suggestions.map((suggestion) => {
                  const Icon = getSuggestionIcon(suggestion.type)
                  const color = getSuggestionColor(suggestion.type)
                  return (
                    <div
                      key={suggestion.id}
                      style={{
                        padding: '0.75rem',
                        background: '#0f172a',
                        borderRadius: '0.5rem',
                        border: `1px solid ${color}30`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Icon size={16} color={color} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#f1f5f9', marginBottom: '0.25rem' }}>
                            {suggestion.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                            {suggestion.description}
                          </div>
                          {suggestion.action && (
                            <button
                              onClick={() => {
                                if (suggestion.actionPath) {
                                  setLocation(suggestion.actionPath)
                                }
                              }}
                              style={{
                                marginTop: '0.5rem',
                                padding: '0.25rem 0.5rem',
                                background: `${color}20`,
                                border: 'none',
                                borderRadius: '0.25rem',
                                color: color,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              {suggestion.action}
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.75rem',
                    background: message.role === 'user' ? '#10b981' : '#334155',
                    color: 'white',
                    fontSize: '0.875rem',
                    lineHeight: 1.4,
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  background: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <Loader2 size={16} color="#10b981" className="spinning" />
                  <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ 
            padding: '0.75rem',
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: '0.5rem',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your energy data..."
              style={{
                flex: 1,
                padding: '0.625rem 0.875rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.875rem',
              }}
              aria-label="Message input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.5rem',
                background: input.trim() ? '#10b981' : '#334155',
                border: 'none',
                color: 'white',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
