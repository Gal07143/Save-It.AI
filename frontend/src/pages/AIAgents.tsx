import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Bot, Send, Sparkles, Lightbulb, Search, MessageSquare, Zap, TrendingUp, FileText, GraduationCap, History, Brain } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { api } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Recommendation {
  id: number
  title: string
  priority: string
  category: string
  expected_savings: number | null
}

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<'energy_analyst' | 'detective' | 'recommender'>('energy_analyst')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [_sessionId, setSessionId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('chat')

  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ['recommendations'],
    queryFn: () => api.recommendations.list(),
  })

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.agents.chat(1, selectedAgent, message),
    onSuccess: (data) => {
      setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: input }])
    chatMutation.mutate(input)
    setInput('')
  }

  const agents = [
    { id: 'energy_analyst', name: 'Energy Analyst', icon: Sparkles, color: '#3b82f6', desc: 'Analyze consumption patterns and anomalies' },
    { id: 'detective', name: 'Detective', icon: Search, color: '#8b5cf6', desc: 'Investigate unassigned loads and hypotheses' },
    { id: 'recommender', name: 'Recommender', icon: Lightbulb, color: '#f59e0b', desc: 'Get optimization recommendations' },
  ]

  const suggestions = [
    'Why did consumption spike last month?',
    'Analyze my peak demand patterns',
    'Find energy saving opportunities',
  ]

  const tabs: Tab[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
    { id: 'insights', label: 'Insights', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'training', label: 'Training', icon: GraduationCap },
    { id: 'history', label: 'History', icon: History },
  ]

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'chat':
        return (
          <>
            <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(agent.id as 'energy_analyst' | 'detective' | 'recommender')
                    setMessages([])
                    setSessionId(null)
                  }}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: selectedAgent === agent.id ? `2px solid ${agent.color}` : '1px solid #334155',
                    background: selectedAgent === agent.id ? `${agent.color}10` : undefined,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.5rem',
                      background: `${agent.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <agent.icon size={20} color={agent.color} />
                    </div>
                    <span style={{ fontWeight: 600 }}>{agent.name}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{agent.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-3" style={{ gap: '1.5rem' }}>
              <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', height: '500px' }}>
                <div className="card-header">
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={18} />
                    Chat with {agents.find(a => a.id === selectedAgent)?.name}
                  </h2>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                      <Bot size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Start a conversation</p>
                      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Ask me about your energy data and I'll help analyze it</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setInput(suggestion)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '999px',
                              fontSize: '0.875rem',
                              color: '#94a3b8',
                              cursor: 'pointer',
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '80%',
                          padding: '0.75rem 1rem',
                          borderRadius: '0.75rem',
                          background: msg.role === 'user' ? '#3b82f6' : '#1e293b',
                          color: 'white',
                        }}>
                          <p style={{ fontSize: '0.875rem' }}>{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {chatMutation.isPending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <span style={{ width: '8px', height: '8px', background: '#64748b', borderRadius: '50%', animation: 'bounce 1s infinite' }}></span>
                          <span style={{ width: '8px', height: '8px', background: '#64748b', borderRadius: '50%', animation: 'bounce 1s infinite 0.1s' }}></span>
                          <span style={{ width: '8px', height: '8px', background: '#64748b', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask a question about your energy data..."
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleSend}
                      disabled={!input.trim() || chatMutation.isPending}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb size={18} color="#f59e0b" />
                    Quick Recommendations
                  </h2>
                </div>
                
                {(recommendations?.length || 0) === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <Lightbulb size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 500 }}>No recommendations yet</p>
                    <p style={{ fontSize: '0.875rem' }}>Chat with the AI to get insights</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recommendations?.slice(0, 5).map((rec) => (
                      <div key={rec.id} style={{ 
                        padding: '0.75rem', 
                        background: '#1e293b', 
                        borderRadius: '0.5rem' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span className={`badge badge-${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'secondary'}`}>
                            {rec.priority}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{rec.category}</span>
                        </div>
                        <h3 style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{rec.title}</h3>
                        {rec.expected_savings && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#10b981' }}>
                            <Zap size={12} />
                            Est. savings: ${rec.expected_savings.toLocaleString()}/yr
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )

      case 'recommendations':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lightbulb size={18} color="#f59e0b" />
                AI-Generated Recommendations
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <Lightbulb size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>AI-Powered Suggestions</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto' }}>
                Get personalized recommendations based on your energy consumption patterns, equipment efficiency, and optimization opportunities.
              </p>
            </div>
          </div>
        )

      case 'insights':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="#10b981" />
                Automated Pattern Detection
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <Brain size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Pattern Analysis & Insights</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto' }}>
                AI automatically detects anomalies, usage patterns, and trends in your energy data to surface actionable insights.
              </p>
            </div>
          </div>
        )

      case 'reports':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="#8b5cf6" />
                AI-Written Summaries
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <FileText size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Automated Report Generation</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto' }}>
                Generate comprehensive energy reports with AI-written executive summaries, trend analysis, and actionable recommendations.
              </p>
            </div>
          </div>
        )

      case 'training':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={18} color="#ec4899" />
                Model Training & Feedback
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <GraduationCap size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Improve AI Accuracy</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto' }}>
                Provide feedback on AI predictions and recommendations to help improve model accuracy and personalization over time.
              </p>
            </div>
          </div>
        )

      case 'history':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#06b6d4" />
                Conversation History
              </h2>
            </div>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
              <History size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Past Conversations</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto' }}>
                Review your previous AI conversations, search through past queries, and continue from where you left off.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={24} color="#3b82f6" />
          AI Agents
        </h1>
        <p style={{ color: '#64748b' }}>Intelligent assistants for energy analysis and optimization</p>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="underline"
      >
        {renderTabContent}
      </TabPanel>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
