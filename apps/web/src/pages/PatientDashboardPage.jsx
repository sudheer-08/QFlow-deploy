import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import './PatientDashboardPage.css'

export default function PatientDashboardPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('upcoming')

  useEffect(() => {
    if (!user) navigate('/patient/login', { replace: true })
  }, [user, navigate])

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => api.get('/appointments/my').then((r) => {
      // API returns paginated payload { page, pageSize, data: [] }.
      // Keep fallback compatibility if a plain array is ever returned.
      if (Array.isArray(r.data)) return r.data
      if (Array.isArray(r.data?.data)) return r.data.data
      return []
    }),
    enabled: !!user
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => api.patch(`/appointments/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries(['my-appointments'])
  })

  const upcoming = appointments.filter(a =>
    ['confirmed', 'pending'].includes(a.status) &&
    new Date(a.appointment_date) >= new Date().setHours(0, 0, 0, 0)
  )
  const past = appointments.filter(a =>
    a.status === 'completed' ||
    (a.status === 'confirmed' && new Date(a.appointment_date) < new Date().setHours(0, 0, 0, 0))
  )
  const cancelled = appointments.filter(a => a.status === 'cancelled')

  const statusConfig = {
    confirmed: { cls: 'pd-badge-confirmed', label: 'Confirmed' },
    completed: { cls: 'pd-badge-completed', label: 'Completed' },
    cancelled: { cls: 'pd-badge-cancelled', label: 'Cancelled' },
    pending: { cls: 'pd-badge-pending', label: 'Pending' }
  }

  const AppointmentCard = ({ appt, showCancel }) => {
    const status = statusConfig[appt.status] || statusConfig.confirmed
    const date = new Date(appt.appointment_date).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short'
    })

    return (
      <article className="pd-card">
        <div className="pd-card-top">
          <div>
            <h3>{appt.tenants?.name || 'Clinic'}</h3>
            <p className="pd-doctor">Doctor: {appt.doctors?.name}</p>
            <p className="pd-address">Address: {appt.tenants?.address}</p>
          </div>
          <span className={`pd-badge ${status.cls}`}>{status.label}</span>
        </div>

        <div className="pd-grid3">
          <div>
            <small>DATE</small>
            <strong>{date}</strong>
          </div>
          <div>
            <small>TIME</small>
            <strong>{appt.slot_time?.slice(0, 5)}</strong>
          </div>
          <div>
            <small>TYPE</small>
            <strong>{appt.visit_type?.replace('_', ' ')}</strong>
          </div>
        </div>

        <div className="pd-actions">
          <button
            type="button"
            className="pd-btn pd-btn-view"
            onClick={() => navigate(`/track-appointment/${appt.tracker_url_token}`)}
          >
            View Details
          </button>

          {showCancel && appt.status === 'confirmed' && (
            <button
              type="button"
              className="pd-btn pd-btn-cancel"
              onClick={() => {
                if (window.confirm('Cancel this appointment?')) cancelMutation.mutate(appt.id)
              }}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </button>
          )}

          {showCancel && appt.status === 'confirmed' && (
            <button
              type="button"
              className="pd-btn pd-btn-reschedule"
              onClick={() => {
                const clinicSubdomain = appt.tenants?.subdomain
                if (!clinicSubdomain) {
                  window.alert('Clinic link is missing for this appointment. Please refresh and try again.')
                  return
                }
                navigate(`/book/${clinicSubdomain}?reschedule=${appt.id}`)
              }}
            >
              Reschedule
            </button>
          )}

          {appt.status === 'completed' && (
            <button
              type="button"
              className="pd-btn pd-btn-rebook"
              onClick={() => {
                const clinicSubdomain = appt.tenants?.subdomain
                if (!clinicSubdomain) {
                  window.alert('Clinic link is missing for this appointment. Please refresh and try again.')
                  return
                }
                navigate(`/book/${clinicSubdomain}`)
              }}
            >
              Rebook
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="pd-shell">
      <div className="pd-orb pd-orb-left" />
      <div className="pd-orb pd-orb-right" />

      <header className="pd-hero">
        <div className="pd-hero-row">
          <div>
            <p className="pd-kicker">Welcome back</p>
            <h1>{user?.name}</h1>
            <p className="pd-email">{user?.email}</p>
          </div>
          <button type="button" className="pd-signout" onClick={logout}>Sign Out</button>
        </div>

        <div className="pd-stats">
          {[
            { label: 'Total', value: appointments.length },
            { label: 'Upcoming', value: upcoming.length },
            { label: 'Completed', value: past.length }
          ].map(stat => (
            <div key={stat.label} className="pd-stat-card">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="pd-main">
        <button type="button" className="pd-quick-book" onClick={() => navigate('/')}>
          Book New Appointment
        </button>

        <div className="pd-tabs">
          {[
            { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { id: 'past', label: `Past (${past.length})` },
            { id: 'cancelled', label: `Cancelled (${cancelled.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`pd-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="pd-list">
          {isLoading && (
            <div className="pd-skeleton-wrap">
              <div className="pd-skeleton pd-skeleton-lg" />
              <div className="pd-skeleton" />
              <div className="pd-skeleton" />
            </div>
          )}

          {!isLoading && activeTab === 'upcoming' && (
            upcoming.length === 0
              ? (
                <div className="pd-empty">
                  <p className="pd-empty-title">No upcoming appointments</p>
                  <p className="pd-empty-copy">Book a clinic visit to see it here.</p>
                  <button type="button" className="pd-empty-cta" onClick={() => navigate('/')}>Book now</button>
                </div>
              )
              : upcoming.map(a => <AppointmentCard key={a.id} appt={a} showCancel={true} />)
          )}

          {!isLoading && activeTab === 'past' && (
            past.length === 0
              ? (
                <div className="pd-empty">
                  <p className="pd-empty-title">No past appointments yet</p>
                  <p className="pd-empty-copy">Completed visits will appear in this tab.</p>
                </div>
              )
              : past.map(a => <AppointmentCard key={a.id} appt={a} showCancel={false} />)
          )}

          {!isLoading && activeTab === 'cancelled' && (
            cancelled.length === 0
              ? (
                <div className="pd-empty">
                  <p className="pd-empty-title">No cancelled appointments</p>
                  <p className="pd-empty-copy">Any cancelled visit will be listed here.</p>
                </div>
              )
              : cancelled.map(a => <AppointmentCard key={a.id} appt={a} showCancel={false} />)
          )}
        </section>
      </main>
    </div>
  )
}
