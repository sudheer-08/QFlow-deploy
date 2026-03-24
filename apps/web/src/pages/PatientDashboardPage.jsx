import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function PatientDashboardPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('upcoming')

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate('/patient/login')
  }, [user])

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => api.get('/appointments/my').then(r => r.data),
    enabled: !!user
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id) => api.patch(`/appointments/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries(['my-appointments'])
  })

  const upcoming = appointments.filter(a =>
    ['confirmed', 'pending'].includes(a.status) &&
    new Date(a.appointment_date) >= new Date().setHours(0,0,0,0)
  )
  const past = appointments.filter(a =>
    a.status === 'completed' ||
    (a.status === 'confirmed' && new Date(a.appointment_date) < new Date().setHours(0,0,0,0))
  )
  const cancelled = appointments.filter(a => a.status === 'cancelled')

  const statusConfig = {
    confirmed: { bg: '#eff6ff', color: '#1d4ed8', label: 'Confirmed' },
    completed: { bg: '#f0fdf4', color: '#15803d', label: 'Completed' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
    pending:   { bg: '#fefce8', color: '#ca8a04', label: 'Pending' },
  }

  const AppointmentCard = ({ appt, showCancel }) => {
    const status = statusConfig[appt.status] || statusConfig.confirmed
    const date = new Date(appt.appointment_date).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short'
    })

    return (
      <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>
              {appt.tenants?.name || 'Clinic'}
            </h3>
            <p style={{ fontSize: 13, color: '#2563eb', fontWeight: 500, margin: '0 0 3px' }}>
              👨‍⚕️ {appt.doctors?.name}
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              📍 {appt.tenants?.address}
            </p>
          </div>
          <span style={{ background: status.bg, color: status.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99 }}>
            {status.label}
          </span>
        </div>

        {/* Date + time */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>DATE</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{date}</p>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>TIME</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{appt.slot_time?.slice(0,5)}</p>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>TYPE</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'capitalize' }}>
              {appt.visit_type?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate(`/track-appointment/${appt.tracker_url_token}`)}
            style={{ flex: 2, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            View Details
          </button>
          {showCancel && appt.status === 'confirmed' && (
            <button
              onClick={() => {
                if (window.confirm('Cancel this appointment?')) {
                  cancelMutation.mutate(appt.id)
                }
              }}
              disabled={cancelMutation.isPending}
              style={{ flex: 1, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          {showCancel && appt.status === 'confirmed' && (
            <button
              onClick={() => navigate(`/book/${appt.tenants?.subdomain}?reschedule=${appt.id}`)}
              style={{ flex: 1, background: '#fffbeb', color: '#d97706', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Reschedule
            </button>
          )}
          {appt.status === 'completed' && (
            <button
              onClick={() => navigate(`/book/${appt.tenants?.subdomain}`)}
              style={{ flex: 1, background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Rebook
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '32px 16px 20px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 13, color: '#bfdbfe', margin: '0 0 4px' }}>Welcome back 👋</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{user?.name}</h1>
            <p style={{ fontSize: 13, color: '#bfdbfe', margin: 0 }}>{user?.email}</p>
          </div>
          <button
            onClick={logout}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
          {[
            { label: 'Total', value: appointments.length, icon: '📋' },
            { label: 'Upcoming', value: upcoming.length, icon: '📅' },
            { label: 'Completed', value: past.length, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#bfdbfe' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick book button */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={() => navigate('/')}
          style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          🦷 Book New Appointment
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 4, display: 'flex', border: '1px solid #e2e8f0' }}>
          {[
            { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { id: 'past', label: `Past (${past.length})` },
            { id: 'cancelled', label: `Cancelled (${cancelled.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, padding: '9px 6px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeTab === tab.id ? '#2563eb' : 'transparent', color: activeTab === tab.id ? 'white' : '#64748b', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment list */}
      <div style={{ padding: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : (
          <>
            {activeTab === 'upcoming' && (
              upcoming.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                  <p style={{ color: '#64748b', margin: '0 0 16px' }}>No upcoming appointments</p>
                  <button onClick={() => navigate('/')}
                    style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Book Now
                  </button>
                </div>
              ) : upcoming.map(a => <AppointmentCard key={a.id} appt={a} showCancel={true} />)
            )}
            {activeTab === 'past' && (
              past.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                  <p style={{ color: '#64748b' }}>No past appointments yet</p>
                </div>
              ) : past.map(a => <AppointmentCard key={a.id} appt={a} showCancel={false} />)
            )}
            {activeTab === 'cancelled' && (
              cancelled.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <p style={{ color: '#64748b' }}>No cancelled appointments</p>
                </div>
              ) : cancelled.map(a => <AppointmentCard key={a.id} appt={a} showCancel={false} />)
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex' }}>
        {[
          { icon: '🏠', label: 'Home', path: '/' },
          { icon: '📋', label: 'Bookings', path: '/patient/dashboard', active: true },
          { icon: '🏥', label: 'Records', path: '/patient/health-records' },
          { icon: '👨‍👩‍👧', label: 'Family', path: '/patient/family' },
        ].map(item => (
          <button key={item.label} onClick={() => navigate(item.path)}
            style={{ flex: 1, padding: '12px 8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: item.active ? '#2563eb' : '#94a3b8' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
