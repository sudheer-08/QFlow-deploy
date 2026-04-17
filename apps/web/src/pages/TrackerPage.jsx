import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import socket, { connectTracker } from '../socket'
import ShareToken from '../components/ShareToken'
import './TrackerPage.css' // Premium Tracker Styles

// Public page — no login needed
// URL: /track/:trackerToken
export default function TrackerPage() {
  const { trackerToken } = useParams()
  const [liveData, setLiveData] = useState(null)
  const [arrivedConfirmed, setArrivedConfirmed] = useState(false)
  const [called, setCalled] = useState(false)

  // Fetch initial tracker data
  const { data, isLoading, error } = useQuery({
    queryKey: ['tracker', trackerToken],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/public/track/${trackerToken}`)
        .then(r => r.json()),
    refetchInterval: 60000
  })

  const info = liveData || data

  const arrivalMutation = useMutation({
    mutationFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/public/track/${trackerToken}/arrived`, {
        method: 'POST'
      }).then(r => r.json()),
    onSuccess: () => setArrivedConfirmed(true)
  })

  useEffect(() => {
    if (!trackerToken) return
    connectTracker(trackerToken)

    socket.on('patient:position_update', (update) => {
      setLiveData(prev => ({ ...prev, ...update }))
    })

    socket.on('patient:called', (update) => {
      setCalled(true)
      setLiveData(prev => ({ ...prev, status: 'called', ...update }))
    })

    return () => {
      socket.off('patient:position_update')
      socket.off('patient:called')
    }
  }, [trackerToken])

  if (isLoading) return (
    <div className="tp-state-screen">
      <div className="tp-state-loader" />
      <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--qf-text-variant)' }}>Loading your queue status...</p>
    </div>
  )

  if (error || data?.error) return (
    <div className="tp-state-screen">
      <div className="tp-state-emoji">❌</div>
      <h2 style={{ fontFamily: 'Manrope, sans-serif' }}>Token not found</h2>
      <p style={{ color: 'var(--qf-text-variant)' }}>This link may have expired or is invalid.</p>
    </div>
  )

  if (info?.status === 'called' || called) return (
    <div className="tp-state-screen called">
      <div className="tp-state-emoji animate-bounce">🔔</div>
      <h1>Your Turn!</h1>
      <p className="tp-token">{info?.token}</p>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.25rem', marginBottom: '2rem' }}>
        {info?.doctorName} is ready for you
      </p>
      <div className="tp-room-card">
        <p>Please proceed to the</p>
        <p>Consultation Room</p>
      </div>
    </div>
  )

  if (info?.status === 'done') return (
    <div className="tp-state-screen done">
      <div className="tp-state-emoji">✅</div>
      <h1>Consultation Complete</h1>
      <p style={{ color: 'var(--qf-text-variant)', fontSize: '1.1rem' }}>Thank you for visiting {info?.clinicName}</p>
    </div>
  )

  const progressPercent = info?.tokensAhead === 0 ? 100 : Math.max(10, 100 - (info?.tokensAhead * 15))

  return (
    <div className="tp-shell">
      <div className="tp-content-wrapper">
        <div className="tp-header">
          <p className="tp-header-clinic">{info?.clinicName}</p>
          <h1 className="tp-header-token">{info?.token}</h1>
          <p className="tp-header-greeting">Hi {info?.patientName}! 👋</p>
        </div>

        <div className="tp-main">
          {called && (
            <div className="tp-called-alert">
              🔔 The doctor is calling you now!
            </div>
          )}

          <div className="tp-position-wrapper">
            <div className="tp-live-queue-capsule">
              <div className="tp-queue-pulse"></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="tp-position-num">{info?.position}</span>
                <span className="tp-position-divider">/</span>
                <div className="tp-position-status">
                  <strong>queue</strong>
                  <span>{info?.tokensAhead === 0 ? 'You are next! 🎉' : `${info?.tokensAhead} patient${info?.tokensAhead === 1 ? '' : 's'} ahead`}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="tp-progress-bar">
            <div className="tp-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="tp-info-grid">
            <div className="tp-info-card primary-tonal">
              <div className="tp-info-val">{info?.estimatedWaitMins}</div>
              <div className="tp-info-label">Est. minutes</div>
            </div>
            <div className="tp-info-card">
              <div className="tp-info-val-text">{info?.doctorName}</div>
              <div className="tp-info-label">Your doctor</div>
            </div>
          </div>

          {info?.arrivalStatus === 'at_home' && !arrivedConfirmed && (
            <div className="tp-arrival-box">
              <h3>Are you at the clinic?</h3>
              <p>Tap below when you arrive so the receptionist knows you're here.</p>
              <button
                onClick={() => arrivalMutation.mutate()}
                disabled={arrivalMutation.isPending}
                className="tp-btn-confirm"
              >
                {arrivalMutation.isPending ? 'Confirming...' : "✅ I've Arrived"}
              </button>
            </div>
          )}

          {(info?.arrivalStatus === 'arrived' || arrivedConfirmed) && (
            <div className="tp-arrival-success">
              ✅ Arrival confirmed! The clinic knows you're here.
            </div>
          )}

          <div className="tp-share-wrapper">
            <ShareToken
              token={info?.token}
              clinicName={info?.clinicName}
              patientName={info?.patientName}
              trackerUrl={window.location.href}
            />
          </div>

          <div className="tp-tips-box">
            <div className="tp-tips-head">While you wait</div>
            <div className="tp-tips-list">
              <p>📱 Wait page updates live. Do not close.</p>
              <p>🕒 Make sure to reach the clinic when you are 3rd in queue.</p>
              <p>👨‍⚕️ Present your phone upon entering the consultation room.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
