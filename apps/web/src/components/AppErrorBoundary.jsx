import React from 'react'

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('App crashed', { error, info })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f8fafc'
      }}>
        <div style={{
          width: '100%',
          maxWidth: 520,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
        }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: 24 }}>Something went wrong</h1>
          <p style={{ marginTop: 10, marginBottom: 20, color: '#475569', lineHeight: 1.6 }}>
            We could not load this screen. Please refresh or go back to the home page.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={this.handleReload}
              style={{
                border: 'none',
                borderRadius: 10,
                background: '#2563eb',
                color: 'white',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: 'white',
                color: '#0f172a',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
