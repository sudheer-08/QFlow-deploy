import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { UserCircle2, LogOut } from 'lucide-react'
import L from 'leaflet'
import AIChatbot from '../components/AIChatbot'
import { ClinicCardSkeleton } from '../components/Skeleton'
import { useAuthStore } from '../store/authStore'
import './PatientHomePage.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const specIcon = (spec) => {
  if (!spec) return '🏥'
  const s = spec.toLowerCase()
  if (s.includes('dental') || s.includes('ortho')) return '🦷'
  if (s.includes('eye') || s.includes('ophthal')) return '👁️'
  if (s.includes('skin') || s.includes('derma')) return '🧴'
  if (s.includes('child') || s.includes('pediatric')) return '👶'
  if (s.includes('heart') || s.includes('cardio')) return '❤️'
  if (s.includes('bone')) return '🦴'
  if (s.includes('ent')) return '👂'
  return '🏥'
}

const createClinicIcon = (waitCount, spec) => L.divIcon({
  className: '',
  html: `<div style="background:${waitCount > 10 ? '#dc2626' : waitCount > 5 ? '#d97706' : '#16a34a'};color:white;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${specIcon(spec)} ${waitCount} waiting</div>`,
  iconAnchor: [40, 10]
})

const userLocationIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.3)"></div>',
  iconAnchor: [8, 8]
})

function FlyToLocation({ location }) {
  const map = useMap()

  useEffect(() => {
    if (location) {
      map.flyTo(location, 14, { duration: 1.5 })
    }
  }, [location, map])

  return null
}

const getDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 9999
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function PatientHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('wait')
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedSpec, setSelectedSpec] = useState('all')
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')

  const { data: rawClinics, isLoading } = useQuery({
    queryKey: ['clinics-map'],
    queryFn: async () => {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/patient/clinics`)
      const data = await r.json()
      return Array.isArray(data) ? data : []
    },
    refetchInterval: 30000
  })

  const clinics = rawClinics || []
  const cityOptions = ['all', ...new Set(clinics.map(c => c.city).filter(Boolean))]
  const allSpecs = ['all', ...new Set(clinics.map(c => c.specialization).filter(Boolean))]

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported on this device')
      return
    }

    setLocationLoading(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        setSortBy('distance')
        setLocationLoading(false)
      },
      () => {
        setLocationError('Could not get location. Please allow access.')
        setLocationLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const filtered = clinics
    .filter(c => {
      const matchSearch = !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.address?.toLowerCase().includes(search.toLowerCase()) ||
        c.specialization?.toLowerCase().includes(search.toLowerCase())
      const matchCity = selectedCity === 'all' || c.city === selectedCity
      const matchSpec = selectedSpec === 'all' || c.specialization?.includes(selectedSpec)
      return matchSearch && matchCity && matchSpec
    })
    .map(c => ({
      ...c,
      distance: userLocation ? getDistance(userLocation[0], userLocation[1], parseFloat(c.lat), parseFloat(c.lng)) : null
    }))
    .sort((a, b) => {
      if (sortBy === 'wait') return (a.totalWaiting || 0) - (b.totalWaiting || 0)
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'distance') return (a.distance || 9999) - (b.distance || 9999)
      return 0
    })

  const clinicCountLabel = isLoading ? '…' : filtered.length

  const isClinicOpen = (openTime, closeTime) => {
    if (!openTime || !closeTime) return true
    const now = new Date()
    const current = now.getHours() * 60 + now.getMinutes()
    const [openH, openM] = openTime.split(':').map(Number)
    const [closeH, closeM] = closeTime.split(':').map(Number)
    return current >= openH * 60 + openM && current <= closeH * 60 + closeM
  }

  const mapCenter = userLocation || [30.7333, 76.7794]
  const topClinic = filtered[0]
  const metricLabel = sortBy === 'distance'
    ? 'Nearest first'
    : sortBy === 'wait'
      ? 'Shortest wait first'
      : 'Highest rated first'

  return (
    <div className="ph-shell">
      <div className="ph-orb ph-orb-left" />
      <div className="ph-orb ph-orb-right" />

      <header className="ph-topbar">
        <div className="ph-brand-wrap">
          <div className="ph-brand-badge">Q</div>
          <div>
            <div className="ph-brand-title">QFlow</div>
            <div className="ph-brand-subtitle">Find clinics with real-time queues</div>
          </div>
        </div>

        <div className="ph-topbar-actions">
          <button className="ph-btn ph-btn-secondary" onClick={() => navigate('/register-clinic')}>
            + List Clinic
          </button>
          <button className="ph-btn ph-btn-secondary" onClick={() => navigate('/login')}>
            Clinic Staff Login
          </button>
          {user?.role === 'patient' ? (
            <>
              <button className="ph-btn ph-btn-primary" onClick={() => navigate('/patient/profile')}>
                <UserCircle2 size={14} style={{ marginRight: 6 }} /> My Profile
              </button>
              <button
                className="ph-btn ph-btn-secondary"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                <LogOut size={14} style={{ marginRight: 6 }} /> Sign Out
              </button>
            </>
          ) : (
            <button className="ph-btn ph-btn-primary" onClick={() => navigate('/patient/login')}>
              Patient Sign In
            </button>
          )}
        </div>
      </header>

      <section className="ph-hero">
        <div className="ph-hero-copy">
          <p className="ph-kicker">Live Care Discovery</p>
          <h1>Choose the right clinic in minutes, not hours.</h1>
          <p className="ph-hero-text">
            Compare wait times, ratings, and distance in one place. Built for faster, smarter patient decisions.
          </p>
        </div>

        <div className="ph-search-panel">
          <div className="ph-search-row">
            <span className="ph-search-icon">⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clinic, doctor, specialization, area..."
              className="ph-search-input"
            />
            <button
              className={`ph-locate-btn ${userLocation ? 'is-active' : ''}`}
              onClick={getUserLocation}
              disabled={locationLoading}
              title="Use my location"
            >
              {locationLoading ? 'Locating...' : userLocation ? 'Nearby' : 'Use location'}
            </button>
          </div>

          <div className="ph-metrics-grid">
            <div className="ph-metric-card">
              <span>Clinics Found</span>
              <strong>{clinicCountLabel}</strong>
            </div>
            <div className="ph-metric-card">
              <span>Sorting</span>
              <strong>{metricLabel}</strong>
            </div>
            <div className="ph-metric-card">
              <span>Best Pick</span>
              <strong>{isLoading ? 'Loading...' : topClinic ? topClinic.name : 'No results'}</strong>
            </div>
          </div>

          {locationError && <p className="ph-error">{locationError}</p>}
          {userLocation && <p className="ph-success">Location enabled. Distance sort is now available.</p>}
        </div>
      </section>

      <section className="ph-controls">
        <div className="ph-chip-row">
          <span className="ph-chip-label">Specialties</span>
          {allSpecs.map(spec => (
            <button
              key={spec}
              onClick={() => setSelectedSpec(spec)}
              className={`ph-chip ${selectedSpec === spec ? 'is-active' : ''}`}
            >
              {spec === 'all' ? 'All Clinics' : `${specIcon(spec)} ${spec}`}
            </button>
          ))}
        </div>

        <div className="ph-chip-row">
          <span className="ph-chip-label">Areas</span>
          {cityOptions.map(city => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`ph-chip ph-chip-city ${selectedCity === city ? 'is-active' : ''}`}
            >
              {city === 'all' ? 'All Areas' : city}
            </button>
          ))}
        </div>

        <div className="ph-chip-row">
          <span className="ph-chip-label">Sort by</span>
          {[
            ['wait', 'Shortest wait'],
            ['rating', 'Best rating'],
            ...(userLocation ? [['distance', 'Nearest']] : [])
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              className={`ph-chip ph-chip-sort ${sortBy === value ? 'is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="ph-content-grid">
        <div className="ph-map-card">
          <div className="ph-map-head">
            <h2>Live Clinic Map</h2>
            <span>{isLoading ? 'Loading...' : `${filtered.length} results`}</span>
          </div>

          <div className="ph-map-wrap">
            <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FlyToLocation location={userLocation} />

              {userLocation && (
                <Marker position={userLocation} icon={userLocationIcon}>
                  <Popup><strong>You are here</strong></Popup>
                </Marker>
              )}

              {filtered.map(clinic => clinic.lat && clinic.lng ? (
                <Marker
                  key={clinic.id}
                  position={[parseFloat(clinic.lat), parseFloat(clinic.lng)]}
                  icon={createClinicIcon(clinic.totalWaiting || 0, clinic.specialization)}
                >
                  <Popup>
                    <div style={{ minWidth: 170 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{specIcon(clinic.specialization)} {clinic.name}</div>
                      <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6 }}>{clinic.address}</div>
                      {clinic.distance && <div style={{ fontSize: 12, color: '#1254ff', marginBottom: 6 }}>{clinic.distance.toFixed(1)} km away</div>}
                      <div style={{ fontSize: 12, marginBottom: 8 }}>⭐ {clinic.rating || 0} · {clinic.totalWaiting || 0} waiting</div>
                      <button
                        onClick={() => navigate(`/clinic/${clinic.subdomain}`)}
                        style={{ width: '100%', background: '#1254ff', color: 'white', border: 'none', borderRadius: 8, padding: '7px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Open Clinic
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ) : null)}
            </MapContainer>
          </div>
        </div>

        <div className="ph-list-col">
          <div className="ph-list-head">
            <h2>{filtered.length} Clinics</h2>
            <p>{metricLabel}</p>
          </div>

          {isLoading ? (
            <div className="ph-list-stack">
              {[1, 2, 3].map(i => <ClinicCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="ph-empty-state">
              <h3>No clinics match these filters</h3>
              <p>Try clearing a few filters or search another area or specialty.</p>
            </div>
          ) : (
            <div className="ph-list-stack">
              {filtered.map((clinic, idx) => (
                <article
                  key={clinic.id}
                  className="ph-clinic-card"
                  onClick={() => navigate(`/clinic/${clinic.subdomain}`)}
                >
                  <div className="ph-card-top">
                    <div className="ph-card-main">
                      <div className="ph-badges">
                        {idx === 0 && sortBy === 'wait' && <span className="ph-badge ph-badge-green">Shortest Wait</span>}
                        {idx === 0 && sortBy === 'rating' && <span className="ph-badge ph-badge-amber">Top Rated</span>}
                        {idx === 0 && sortBy === 'distance' && <span className="ph-badge ph-badge-blue">Nearest</span>}
                        {isClinicOpen(clinic.open_time, clinic.close_time)
                          ? <span className="ph-badge ph-badge-open">Open Now</span>
                          : <span className="ph-badge ph-badge-closed">Closed</span>
                        }
                      </div>

                      <h3>{specIcon(clinic.specialization)} {clinic.name}</h3>
                      <p>{clinic.address}</p>
                      <div className="ph-meta-line">
                        <span>{clinic.open_time?.slice(0, 5)} - {clinic.close_time?.slice(0, 5)}</span>
                        {clinic.distance && <span>{clinic.distance.toFixed(1)} km away</span>}
                      </div>
                    </div>

                    <div className="ph-queue-block">
                      <strong className={`ph-queue-num ${(clinic.totalWaiting || 0) > 10 ? 'is-high' : (clinic.totalWaiting || 0) > 5 ? 'is-mid' : 'is-low'}`}>
                        {clinic.totalWaiting || 0}
                      </strong>
                      <span>in queue</span>
                      <em>~{(clinic.totalWaiting || 0) * 8} min</em>
                    </div>
                  </div>

                  <div className="ph-card-bottom">
                    <span>{clinic.doctorCount || 1} doctor{clinic.doctorCount > 1 ? 's' : ''}</span>
                    <span>⭐ {clinic.rating || 0} ({clinic.total_reviews || 0})</span>
                  </div>

                  <button className="ph-card-cta">View Clinic & Book Appointment</button>
                </article>
              ))}
            </div>
          )}

          <aside className="ph-owner-cta">
            <div className="ph-owner-kicker">For Clinic Owners</div>
            <h3>Turn your front desk into a smart queue engine</h3>
            <p>Get bookings, reminders, and live queue visibility in one dashboard your team can run from day one.</p>
            <div className="ph-owner-tags">
              {['Online booking', 'AI triage', 'Queue board', 'Patient alerts', 'Analytics'].map(tag => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <button className="ph-owner-btn" onClick={() => navigate('/register-clinic')}>
              Register Your Clinic
            </button>
          </aside>
        </div>
      </section>

      <AIChatbot />
    </div>
  )
}
