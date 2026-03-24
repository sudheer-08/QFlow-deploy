import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const path = location.pathname

  const tabs = [
    { icon: '🏠', label: 'Home', path: '/' },
    { icon: '🔍', label: 'Search', path: '/search' },
    { icon: '📋', label: 'Bookings', path: user ? '/patient/dashboard' : '/patient/login' },
    { icon: '🏥', label: 'Records', path: user ? '/patient/health-records' : '/patient/login' },
    { icon: '👤', label: 'Profile', path: user ? '/patient/profile' : '/patient/login' },
  ]

  // Don't show on staff pages or pages with their own fixed bottom CTA
  const hiddenPages = ['/login', '/reception', '/doctor', '/admin', '/display', '/book/', '/join/', '/payment', '/track-appointment']
  if (hiddenPages.some(p => path.startsWith(p))) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      left: 10,
      right: 10,
      background: 'rgba(255,255,255,0.88)',
      border: '1px solid rgba(203,213,225,0.7)',
      borderRadius: 18,
      backdropFilter: 'blur(10px)',
      display: 'flex',
      zIndex: 500,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)'
    }}>
      {tabs.map(tab => {
        const isActive = path === tab.path || (tab.path !== '/' && path.startsWith(tab.path))
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              padding: '10px 4px 9px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              position: 'relative'
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: 3,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 28,
                height: 4,
                background: 'linear-gradient(90deg, #2f76ff, #00a6a6)',
                borderRadius: 99
              }} />
            )}
            <span style={{
              fontSize: 19,
              transform: isActive ? 'translateY(-1px)' : 'none',
              transition: 'transform 160ms ease'
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 800 : 600,
              color: isActive ? '#1752d1' : '#64748b',
              fontFamily: 'Manrope, sans-serif',
              letterSpacing: 0.2
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}