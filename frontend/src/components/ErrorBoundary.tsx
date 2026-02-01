import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          padding: '2rem',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: '#1e293b',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #334155',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '0.5rem',
            }}>
              Something went wrong
            </h1>
            
            <p style={{
              color: '#94a3b8',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}>
              An unexpected error occurred. Please try refreshing the page or return to the dashboard.
            </p>

            {this.state.error && (
              <div style={{
                background: '#0f172a',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                border: '1px solid #334155',
              }}>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  fontFamily: 'monospace',
                }}>
                  Error Details:
                </p>
                <p style={{
                  fontSize: '0.813rem',
                  color: '#ef4444',
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                }}>
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                Refresh Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Home size={16} />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
