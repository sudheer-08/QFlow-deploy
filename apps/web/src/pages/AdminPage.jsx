import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Link } from 'react-router-dom'

export default function AdminPage() {
  const { user, logout } = useAuthStore()

  const { data: summary } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api.get('/analytics/summary/today').then(r => r.data),
    refetchInterval: 30000
  })

  const { data: waitTrends = [] } = useQuery({
    queryKey: ['wait-trends'],
    queryFn: () => api.get('/analytics/wait-times?days=14').then(r => r.data)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">{user?.clinicName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/display" target="_blank"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            📺 Display Board
          </a>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Today's stats */}
        <div>
          <h2 className="font-bold text-gray-700 mb-4">Today's Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Patients', value: summary?.total || 0,             icon: '👥', color: 'bg-gray-800 text-white' },
              { label: 'Waiting',        value: summary?.waiting || 0,           icon: '⏳', color: 'bg-blue-600 text-white' },
              { label: 'In Progress',    value: summary?.inProgress || 0,        icon: '🩺', color: 'bg-purple-600 text-white' },
              { label: 'Completed',      value: summary?.done || 0,              icon: '✅', color: 'bg-green-600 text-white' },
              { label: 'Remote',         value: summary?.remote || 0,            icon: '📱', color: 'bg-indigo-600 text-white' },
              { label: 'Avg Wait',       value: `${summary?.avgWaitMins || 0}m`, icon: '⏱️', color: 'bg-amber-500 text-white' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-2xl p-5 text-center`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-3xl font-black">{s.value}</div>
                <div className="text-xs opacity-80 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wait time chart */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-bold text-gray-900 mb-6">Average Wait Time — Last 14 Days</h2>
          {waitTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={waitTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} unit=" min" />
                <Tooltip
                  formatter={(v) => [`${v} mins`, 'Avg Wait']}
                  labelFormatter={l => `Date: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="avgWaitMins"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>No data yet — wait times will appear after patients are seen</p>
            </div>
          )}
        </div>

        {/* Revenue Summary Card */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">Today's Revenue</p>
              <p className="text-4xl font-black">₹0</p>
              <p className="text-green-200 text-xs mt-1">Click to view full breakdown</p>
            </div>
            <div className="text-right">
              <p className="text-6xl">💰</p>
            </div>
          </div>
          <Link to="/admin/revenue"
            className="inline-block mt-4 bg-white text-green-700 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-green-50 transition-colors">
            Open Revenue Dashboard →
          </Link>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Patient Join Page',  href: `/join/${user?.subdomain}`,      icon: '📱', desc: 'Share with patients' },
              { label: 'Queue Display',      href: '/display',                       icon: '📺', desc: 'Open on clinic TV' },
              { label: 'Reception',          href: '/reception',                     icon: '🏥', desc: 'Register walk-ins' },
              { label: 'Doctor View',        href: '/doctor',                        icon: '👨‍⚕️', desc: 'Call patients' },
              { label: 'Advanced Analytics', href: '/admin/analytics',               icon: '📊', desc: 'Peak hours & doctor stats' },
              { label: 'Holidays',           href: '/admin/holidays',                icon: '🗓️', desc: 'Set clinic holidays' },
              { label: 'QR Poster',          href: `/clinic/${user?.subdomain}/qr`,  icon: '🖨️', desc: 'Print for clinic door' },
              { label: 'Revenue Dashboard',  href: '/admin/revenue',                 icon: '💰', desc: 'Daily earnings & fee tracking' },
              { label: 'Booking Inbox',      href: '/reception/bookings',            icon: '📥', desc: 'Review appointment requests' },
              { label: 'Waitlist Manager',   href: '/reception/waitlist',            icon: '📋', desc: 'Manage overflow patients' },
              { label: 'Communication Hub', href: '/admin/communications', icon: '📢', desc: 'Bulk messages & alerts' },
              { label: 'Performance', href: '/admin/performance', icon: '🏆', desc: 'Doctor scorecards & peak hours' },
              { label: 'Clinic Profile',  href: '/admin/profile', icon: '🏥', desc: 'Update clinic info & hours' },
              { label: 'Staff PINs',      href: '/admin/pins',    icon: '🔐', desc: 'Manage quick PIN login' },


            ].map(link => (
              <Link
                key={link.label}
                to={link.href}
                className="block border-2 border-gray-100 hover:border-blue-300 rounded-xl p-4 transition-colors">
                <div className="text-2xl mb-2">{link.icon}</div>
                <p className="font-semibold text-gray-800 text-sm">{link.label}</p>
                <p className="text-xs text-gray-400 mt-1">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}