import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Link } from 'react-router-dom'
import {
  Users, Clock, Stethoscope, CheckCircle2, Smartphone, Timer,
  ExternalLink, LogOut, Wifi, WifiOff, RefreshCw,
  TrendingUp, DollarSign, ArrowRight
} from 'lucide-react'

export default function AdminPage() {
  const { user, logout } = useAuthStore()
  const [now, setNow] = useState(Date.now())
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const {
    data: summary,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
    dataUpdatedAt: summaryUpdatedAt
  } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api.get('/analytics/summary/today').then(r => r.data),
    refetchInterval: 30000
  })

  const { data: waitTrends = [] } = useQuery({
    queryKey: ['wait-trends'],
    queryFn: () => api.get('/analytics/wait-times?days=14').then(r => r.data)
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const syncState = useMemo(() => {
    if (!isOnline) return { label: 'Offline', cls: 'qf-sync-offline', Icon: WifiOff }
    if (isSummaryFetching || isSummaryError) return { label: 'Reconnecting', cls: 'qf-sync-reconnecting', Icon: RefreshCw }
    return { label: 'Connected', cls: 'qf-sync-connected', Icon: Wifi }
  }, [isOnline, isSummaryFetching, isSummaryError])

  const lastSyncLabel = summaryUpdatedAt
    ? new Date(summaryUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Not synced yet'

  const dataAgeSeconds = summaryUpdatedAt ? Math.max(0, Math.floor((now - summaryUpdatedAt) / 1000)) : null

  const stats = [
    { label: 'Total Patients', value: summary?.total || 0, Icon: Users, bg: 'linear-gradient(135deg, #1e293b, #334155)' },
    { label: 'Waiting', value: summary?.waiting || 0, Icon: Clock, bg: 'linear-gradient(135deg, #1452ff, #3b82f6)' },
    { label: 'In Progress', value: summary?.inProgress || 0, Icon: Stethoscope, bg: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
    { label: 'Completed', value: summary?.done || 0, Icon: CheckCircle2, bg: 'linear-gradient(135deg, #059669, #10b981)' },
    { label: 'Remote', value: summary?.remote || 0, Icon: Smartphone, bg: 'linear-gradient(135deg, #4338ca, #6366f1)' },
    { label: 'Avg Wait', value: `${summary?.avgWaitMins || 0}m`, Icon: Timer, bg: 'linear-gradient(135deg, #d97706, #f59e0b)' },
  ]

  const quickLinks = [
    { label: 'Patient Join Page', href: `/join/${user?.subdomain}`, icon: '📱', desc: 'Share with patients' },
    { label: 'Queue Display', href: '/display', icon: '📺', desc: 'Open on clinic TV' },
    { label: 'Reception', href: '/reception', icon: '🏥', desc: 'Register walk-ins' },
    { label: 'Doctor View', href: '/doctor', icon: '👨‍⚕️', desc: 'Call patients' },
    { label: 'Advanced Analytics', href: '/admin/analytics', icon: '📊', desc: 'Peak hours & doctor stats' },
    { label: 'Holidays', href: '/admin/holidays', icon: '🗓️', desc: 'Set clinic holidays' },
    { label: 'QR Poster', href: `/clinic/${user?.subdomain}/qr`, icon: '🖨️', desc: 'Print for clinic door' },
    { label: 'Revenue Dashboard', href: '/admin/revenue', icon: '💰', desc: 'Daily earnings & fees' },
    { label: 'Booking Inbox', href: '/reception/bookings', icon: '📥', desc: 'Review appointment requests' },
    { label: 'Waitlist Manager', href: '/reception/waitlist', icon: '📋', desc: 'Manage overflow patients' },
    { label: 'Communication Hub', href: '/admin/communications', icon: '📢', desc: 'Bulk messages & alerts' },
    { label: 'Performance', href: '/admin/performance', icon: '🏆', desc: 'Doctor scorecards' },
    { label: 'Clinic Profile', href: '/admin/profile', icon: '🏥', desc: 'Update clinic info & hours' },
    { label: 'Staff PINs', href: '/admin/pins', icon: '🔐', desc: 'Manage quick PIN login' },
  ]

  return (
    <div className="qf-staff-shell">
      {/* Header */}
      <header className="qf-staff-header">
        <div className="qf-staff-brand">
          <div className="qf-staff-logo">Q</div>
          <div>
            <div className="qf-staff-title">Admin Dashboard</div>
            <div className="qf-staff-subtitle">{user?.clinicName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="hidden md:flex items-center gap-3">
            <span className={`qf-sync-badge ${syncState.cls}`}>
              <syncState.Icon size={12} />
              {syncState.label}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--ui-text-3)' }}>
              Sync: {lastSyncLabel}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--ui-text-3)' }}>
              Age: {dataAgeSeconds !== null ? `${dataAgeSeconds}s` : 'n/a'}
            </span>
          </div>
          <a href="/display" target="_blank" className="qf-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
            <ExternalLink size={14} /> Display Board
          </a>
          <button onClick={logout} className="qf-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <div className="qf-staff-body" style={{ display: 'grid', gap: 20 }}>

        {/* ─── Stats ─── */}
        <section>
          <div className="qf-section-head">
            <h2>Today's Summary</h2>
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          <div className="qf-stat-grid qf-stagger">
            {stats.map(s => (
              <div key={s.label} className="qf-stat-card" style={{ background: s.bg, color: '#fff' }}>
                <span className="qf-stat-icon"><s.Icon size={22} /></span>
                <span className="qf-stat-value">{s.value}</span>
                <span className="qf-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Wait Time Chart ─── */}
        <section className="qf-content-card">
          <div className="qf-section-head">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} style={{ color: 'var(--ui-primary)' }} />
              Average Wait Time — Last 14 Days
            </h2>
          </div>
          {waitTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={waitTrends}>
                <defs>
                  <linearGradient id="waitGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1452ff" />
                    <stop offset="100%" stopColor="#00b48d" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#8a95b7' }}
                  tickFormatter={d => d.slice(5)}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8a95b7' }}
                  unit=" min"
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  formatter={(v) => [`${v} mins`, 'Avg Wait']}
                  labelFormatter={l => `Date: ${l}`}
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid #d8dff7',
                    boxShadow: '0 10px 24px rgba(18, 84, 255, 0.12)',
                    fontSize: 13
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgWaitMins"
                  stroke="url(#waitGrad)"
                  strokeWidth={3}
                  dot={{ fill: '#1452ff', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#1452ff', stroke: '#fff', strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ui-text-3)' }}>
              <p>No data yet — wait times will appear after patients are seen</p>
            </div>
          )}
        </section>

        {/* ─── Revenue Card ─── */}
        <section className="qf-revenue-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.82rem', opacity: 0.85, margin: 0 }}>Today's Revenue</p>
              <p style={{ fontSize: '2.4rem', fontWeight: 800, margin: '4px 0 0', fontFamily: 'Sora, sans-serif' }}>₹0</p>
              <p style={{ fontSize: '0.74rem', opacity: 0.75, marginTop: 4 }}>Click to view full breakdown</p>
            </div>
            <DollarSign size={56} style={{ opacity: 0.2 }} />
          </div>
          <Link
            to="/admin/revenue"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 16, background: '#fff', color: '#059669',
              fontWeight: 700, padding: '10px 18px', borderRadius: 14,
              textDecoration: 'none', fontSize: '0.85rem',
              transition: 'transform 180ms ease, box-shadow 260ms ease'
            }}
          >
            Open Revenue Dashboard <ArrowRight size={14} />
          </Link>
        </section>

        {/* ─── Quick Links ─── */}
        <section className="qf-content-card">
          <div className="qf-section-head">
            <h2>Quick Links</h2>
          </div>
          <div className="qf-link-grid qf-stagger">
            {quickLinks.map(link => (
              <Link key={link.label} to={link.href} className="qf-link-card">
                <div className="qf-link-icon">{link.icon}</div>
                <div className="qf-link-title">{link.label}</div>
                <div className="qf-link-desc">{link.desc}</div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}