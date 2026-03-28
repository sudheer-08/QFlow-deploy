import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import socket, { connectPublicClinic } from '../socket'
import { useToast } from '../components/Toast'
import './ClinicDetailPage.css'

export default function ClinicDetailPage() {
  const { subdomain } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const lastToastAtRef = useRef(0)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const { data: clinic, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['clinic-detail', subdomain],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/patient/clinics/${subdomain}`)
        .then(r => r.json()),
    refetchInterval: 30000
  })

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdatedAt(new Date(dataUpdatedAt))
    }
  }, [dataUpdatedAt])

  useEffect(() => {
    if (!subdomain) return
    connectPublicClinic(subdomain)

    const handleClinicUpdate = (payload) => {
      queryClient.invalidateQueries({ queryKey: ['clinic-detail', subdomain] })

      if (payload?.type === 'appointment_booked') {
        const now = Date.now()
        if (now - lastToastAtRef.current > 6000) {
          toast.success('New booking received. Data refreshed.')
          lastToastAtRef.current = now
        }
      }
    }

    socket.on('clinic:updated', handleClinicUpdate)

    return () => {
      socket.off('clinic:updated', handleClinicUpdate)
    }
  }, [subdomain, queryClient])

  if (isLoading) return (
    <div className="cd-state cd-state-loading">
      <div className="cd-state-spinner" />
      <p>Loading clinic details...</p>
      <div className="cd-skeleton-wrap">
        <div className="cd-skeleton cd-skeleton-lg" />
        <div className="cd-skeleton" />
        <div className="cd-skeleton" />
      </div>
    </div>
  )

  if (!clinic || clinic.error) return (
    <div className="cd-state cd-state-error">
      <h2>Clinic not found</h2>
      <p>This link may be invalid or the clinic is unavailable.</p>
      <button className="cd-state-btn" onClick={() => navigate('/')}>Back to home</button>
    </div>
  )

  const waitColor = (count) => count > 10 ? '#dc2626' : count > 5 ? '#d97706' : '#16a34a'

  return (
    <div className="cd-shell">
      <div className="cd-glow cd-glow-left" />
      <div className="cd-glow cd-glow-right" />

      <header className="cd-topbar">
        <button className="cd-back" onClick={() => navigate('/')}>←</button>
        <div>
          <div className="cd-top-name">{clinic.name}</div>
          <div className="cd-top-city">{clinic.city}</div>
          {lastUpdatedAt && (
            <div className="cd-live-status">
              <span className="cd-live-dot" />
              <span>
                Live updated: {lastUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </header>

      <section className="cd-hero">
        <div className="cd-hero-main">
          <div>
            <p className="cd-kicker">Clinic Snapshot</p>
            <h1>{clinic.name}</h1>
            <p className="cd-hero-line">{clinic.address}</p>
            <p className="cd-hero-line">{clinic.open_time?.slice(0,5)} - {clinic.close_time?.slice(0,5)}</p>
            <div className="cd-pills">
              <span>⭐ {clinic.rating}</span>
              <span>{clinic.total_reviews} reviews</span>
              <span>{clinic.specialization}</span>
            </div>
          </div>

          <div className="cd-wait-card">
            <div className="cd-wait-count">{clinic.totalWaiting || 0}</div>
            <div className="cd-wait-label">waiting now</div>
            <div className="cd-wait-time">~{(clinic.totalWaiting || 0) * 8} min</div>
          </div>
        </div>
      </section>

      <section className="cd-contact">
        <div>
          <p className="cd-contact-label">Phone</p>
          <p className="cd-contact-value">{clinic.phone || 'Not listed'}</p>
        </div>
        {clinic.phone ? (
          <a href={`tel:${clinic.phone}`} className="cd-call-btn">Call</a>
        ) : (
          <span className="cd-call-disabled">No phone</span>
        )}
      </section>

      <section className="cd-doctors">
        <div className="cd-section-head">
          <h2>Choose a Doctor</h2>
          <p>{clinic.doctors?.length || 0} available</p>
        </div>

        <div className="cd-doctor-list">
          {(clinic.doctors || []).map(doc => (
            <article
              key={doc.id}
              onClick={() => setSelectedDoctor(doc)}
              className={`cd-doctor-card ${selectedDoctor?.id === doc.id ? 'is-active' : ''}`}
            >
              <div className="cd-doctor-top">
                <div className="cd-doctor-identity">
                  <div className="cd-doctor-avatar">👨‍⚕️</div>
                  <div>
                    <p className="cd-doctor-name">{doc.name}</p>
                    <p className="cd-doctor-spec">{doc.specialization}</p>
                    <p className="cd-doctor-exp">{doc.experience_years} yrs experience</p>
                  </div>
                </div>

                <div className="cd-doctor-queue">
                  <div style={{ color: waitColor(doc.queueCount || 0) }}>{doc.queueCount || 0}</div>
                  <span>waiting</span>
                  <em>~{(doc.queueCount || 0) * 8}m</em>
                </div>
              </div>

              {doc.bio && <p className="cd-doctor-bio">{doc.bio}</p>}
            </article>
          ))}
        </div>
      </section>

      <div className="cd-sticky-cta">
        {selectedDoctor ? (
          <div className="cd-cta-stack">
            <button
              onClick={() => navigate(`/book/${subdomain}?doctor=${selectedDoctor.id}`)}
              className="cd-cta-primary"
            >
              Book appointment with {selectedDoctor.name.split(' ').slice(0, 2).join(' ')}
            </button>
            <button
              onClick={() => navigate(`/join/${subdomain}?doctor=${selectedDoctor.id}`)}
              className="cd-cta-secondary"
            >
              Join walk-in queue
            </button>
          </div>
        ) : (
          <button disabled className="cd-cta-disabled">Select a doctor to continue</button>
        )}
      </div>
    </div>
  )
}