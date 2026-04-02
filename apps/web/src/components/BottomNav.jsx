import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Home, Search, CalendarDays, HeartPulse, UserCircle2 } from 'lucide-react'

const tabs = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Search, label: 'Search', path: '/search' },
  { icon: CalendarDays, label: 'Bookings', authPath: '/patient/dashboard', guestPath: '/patient/login' },
  { icon: HeartPulse, label: 'Records', authPath: '/patient/health-records', guestPath: '/patient/login' },
  { icon: UserCircle2, label: 'Profile', authPath: '/patient/profile', guestPath: '/patient/login' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const path = location.pathname

  // Don't show on staff pages or pages with their own fixed bottom CTA
  const hiddenPages = ['/login', '/reception', '/doctor', '/admin', '/display', '/book/', '/join/', '/payment', '/track-appointment']
  if (hiddenPages.some(p => path.startsWith(p))) return null

  return (
    <nav className="bn-shell">
      {tabs.map(tab => {
        const tabPath = tab.path || (user ? tab.authPath : tab.guestPath)
        const isActive = path === tabPath || (tabPath !== '/' && path.startsWith(tabPath))
        const Icon = tab.icon

        return (
          <button
            key={tab.label}
            onClick={() => navigate(tabPath)}
            className={`bn-tab ${isActive ? 'bn-active' : ''}`}
            aria-label={tab.label}
          >
            {isActive && <div className="bn-indicator" />}
            <Icon
              size={20}
              className="bn-icon"
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className="bn-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}