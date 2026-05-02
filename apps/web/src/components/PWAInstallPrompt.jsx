import { useState, useEffect } from 'react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Check if dismissed before
    if (localStorage.getItem('pwa_dismissed')) return

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show prompt after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000)
    })

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShowPrompt(false)
    })
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa_dismissed', 'true')
  }

  if (!showPrompt || installed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: 16,
      right: 16,
      background: 'white',
      borderRadius: 16,
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0',
      zIndex: 998,
      fontFamily: 'sans-serif',
      animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ 
          width: 44, 
          height: 44, 
          background: '#2563eb', 
          borderRadius: 12, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: 22, 
          flexShrink: 0,
          animation: 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
        }}>🦷</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: '0 0 2px' }}>Add QFlow to Home Screen</p>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Install for faster access — works like an app!</p>
        </div>
        <button onClick={handleDismiss} style={{ 
          marginLeft: 'auto', 
          background: 'none', 
          border: 'none', 
          fontSize: 18, 
          cursor: 'pointer', 
          color: '#94a3b8', 
          flexShrink: 0,
          transition: 'all 0.3s ease',
          padding: '4px',
          borderRadius: '50%',
          hover: 'background-color: #f1f5f9'
        }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleDismiss} style={{ 
          flex: 1, 
          background: '#f1f5f9', 
          color: '#64748b', 
          border: 'none', 
          borderRadius: 10, 
          padding: '10px', 
          fontSize: 13, 
          fontWeight: 600, 
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} onMouseEnter={(e) => {
          e.target.style.background = '#e2e8f0';
          e.target.style.transform = 'translateY(-2px)';
        }} onMouseLeave={(e) => {
          e.target.style.background = '#f1f5f9';
          e.target.style.transform = 'translateY(0)';
        }}>
          Not now
        </button>
        <button onClick={handleInstall} style={{ 
          flex: 2, 
          background: '#2563eb', 
          color: 'white', 
          border: 'none', 
          borderRadius: 10, 
          padding: '10px', 
          fontSize: 13, 
          fontWeight: 700, 
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
        }} onMouseEnter={(e) => {
          e.target.style.background = '#1d4ed8';
          e.target.style.transform = 'translateY(-3px)';
          e.target.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.4)';
        }} onMouseLeave={(e) => {
          e.target.style.background = '#2563eb';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
        }}>
          📲 Install App
        </button>
      </div>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}
