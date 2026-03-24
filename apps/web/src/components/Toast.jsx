import { useState, useEffect, useCallback } from 'react'
import { createContext, useContext } from 'react'

// ─── Toast Context ────────────────────────────────────
const ToastContext = createContext(null)

export const useToast = () => useContext(ToastContext)

// ─── Toast Provider — wrap your app with this ─────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  }

  const icons = { success: '●', error: '■', info: 'i', warning: '▲' }
  const colors = {
    success: { bg: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
    error: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
    info: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
    warning: { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast container */}
      <div style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'calc(100vw - 32px)',
        maxWidth: 400,
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: colors[t.type].bg,
            border: `1px solid ${colors[t.type].border}`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)',
            animation: 'slideDown 0.3s ease',
            fontFamily: 'Manrope, sans-serif'
          }}>
            <span style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              display: 'grid',
              placeItems: 'center',
              border: `1px solid ${colors[t.type].text}`,
              color: colors[t.type].text,
              fontSize: 11,
              fontWeight: 800,
              flexShrink: 0
            }}>{icons[t.type]}</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: colors[t.type].text, margin: 0 }}>{t.message}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
