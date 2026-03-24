import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import AIChatbot from '../components/AIChatbot'
import { ClinicCardSkeleton } from '../components/Skeleton'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Specialization icons
const specIcon = (spec) => {
  if (!spec) return '🏥'
  const s = spec.toLowerCase()
  if (s.includes('dental') || s.includes('ortho')) return '🦷'
  if (s.includes('eye') || s.includes('ophthal')) return '👁️'
  if (s.includes('skin') || s.includes('derma')) return '🧴'
  if (s.includes('child') || s.includes('pediatric')) return '👶'
  if (s.includes('heart') || s.includes('cardio')) return '❤️'
  if (s.includes('bone') || s.includes('ortho')) return '🦴'
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
  html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.3)"></div>`,
  iconAnchor: [8, 8]
})

// Component to fly map to location
function FlyToLocation({ location }) {
  const map = useMap()
  useEffect(() => {
    if (location) map.flyTo(location, 14, { duration: 1.5 })
  }, [location])
  return null
}

// Calculate distance between two coordinates in km
const getDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 9999
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function PatientHomePage() {
  const navigate = useNavigate()
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

  // Get user location
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
      (err) => {
        setLocationError('Could not get location. Please allow access.')
        setLocationLoading(false)
      },
      { timeout: 10000 }
    )
  }

  // Get all unique specializations
  const allSpecs = ['all', ...new Set(clinics.map(c => c.specialization).filter(Boolean))]

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

  const isClinicOpen = (openTime, closeTime) => {
    if (!openTime || !closeTime) return true
    const now = new Date()
    const current = now.getHours() * 60 + now.getMinutes()
    const [openH, openM] = openTime.split(':').map(Number)
    const [closeH, closeM] = closeTime.split(':').map(Number)
    return current >= openH * 60 + openM && current <= closeH * 60 + closeM
  }

  const mapCenter = userLocation || [30.7333, 76.7794]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>Q</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>QFlow</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Find Clinics Near You</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/register-clinic')}
            style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + List Clinic
          </button>
          <button onClick={() => navigate('/patient/login')}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </div>

      {/* Hero search */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', padding: '20px 16px' }}>
        <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
          Find Clinics Near You 🏥
        </h1>
        <p style={{ color: '#bfdbfe', fontSize: 13, margin: '0 0 12px' }}>
          Dental, Eye, Skin, ENT — all clinics with live wait times
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clinic, doctor, area..."
            style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none', fontSize: 14, outline: 'none' }}
          />
          {/* Location button */}
          <button
            onClick={getUserLocation}
            disabled={locationLoading}
            style={{ background: userLocation ? '#16a34a' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '11px 14px', color: 'white', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
            title="Use my location"
          >
            {locationLoading ? '⏳' : userLocation ? '📍' : '🧭'}
          </button>
        </div>
        {locationError && <p style={{ color: '#fca5a5', fontSize: 12, margin: '6px 0 0' }}>{locationError}</p>}
        {userLocation && <p style={{ color: '#86efac', fontSize: 12, margin: '6px 0 0' }}>📍 Showing clinics nearest to you first</p>}
      </div>

      {/* Specialization filter */}
      <div style={{ background: 'white', padding: '10px 16px', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
        {allSpecs.map(spec => (
          <button key={spec}
            onClick={() => setSelectedSpec(spec)}
            style={{ padding: '6px 12px', borderRadius: 99, border: '1.5px solid', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', borderColor: selectedSpec === spec ? '#2563eb' : '#e2e8f0', background: selectedSpec === spec ? '#eff6ff' : 'white', color: selectedSpec === spec ? '#2563eb' : '#64748b' }}>
            {spec === 'all' ? '🏥 All' : `${specIcon(spec)} ${spec}`}
          </button>
        ))}
      </div>

      {/* City + Sort filters */}
      <div style={{ background: 'white', padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
        {['all', 'Chandigarh', 'Mohali', 'Panchkula'].map(city => (
          <button key={city}
            onClick={() => setSelectedCity(city)}
            style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', borderColor: selectedCity === city ? '#2563eb' : '#e2e8f0', background: selectedCity === city ? '#eff6ff' : 'white', color: selectedCity === city ? '#2563eb' : '#64748b' }}>
            {city === 'all' ? 'All Areas' : city}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[
            ['wait', '⏱ Wait'],
            ['rating', '⭐ Rating'],
            ...(userLocation ? [['distance', '📍 Nearby']] : [])
          ].map(([val, label]) => (
            <button key={val}
              onClick={() => setSortBy(val)}
              style={{ padding: '5px 12px', borderRadius: 99, border: '1.5px solid', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', borderColor: sortBy === val ? '#2563eb' : '#e2e8f0', background: sortBy === val ? '#eff6ff' : 'white', color: sortBy === val ? '#2563eb' : '#64748b' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 260, position: 'relative' }}>
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FlyToLocation location={userLocation} />

          {/* User location marker */}
          {userLocation && (
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup><strong>📍 You are here</strong></Popup>
            </Marker>
          )}

          {/* Clinic markers */}
          {filtered.map(clinic => clinic.lat && clinic.lng ? (
            <Marker
              key={clinic.id}
              position={[parseFloat(clinic.lat), parseFloat(clinic.lng)]}
              icon={createClinicIcon(clinic.totalWaiting || 0, clinic.specialization)}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{specIcon(clinic.specialization)} {clinic.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{clinic.address}</div>
                  {clinic.distance && <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>📍 {clinic.distance.toFixed(1)} km away</div>}
                  <div style={{ fontSize: 12, marginBottom: 8 }}>⭐ {clinic.rating} · {clinic.totalWaiting || 0} waiting</div>
                  <button
                    onClick={() => navigate(`/clinic/${clinic.subdomain}`)}
                    style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    View & Book
                  </button>
                </div>
              </Popup>
            </Marker>
          ) : null)}
        </MapContainer>
      </div>

      {/* Clinic list */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {filtered.length} Clinics Found
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {sortBy === 'distance' ? '📍 Nearest first' : sortBy === 'wait' ? '⏱ Shortest wait' : '⭐ Top rated'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <ClinicCardSkeleton key={i} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((clinic, idx) => (
              <div key={clinic.id} onClick={() => navigate(`/clinic/${clinic.subdomain}`)}
                style={{ background: 'white', borderRadius: 16, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      {idx === 0 && sortBy === 'wait' && <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>SHORTEST WAIT</span>}
                      {idx === 0 && sortBy === 'rating' && <span style={{ background: '#fef9c3', color: '#ca8a04', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>TOP RATED</span>}
                      {idx === 0 && sortBy === 'distance' && <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>NEAREST</span>}
                      {isClinicOpen(clinic.open_time, clinic.close_time)
                        ? <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>● OPEN</span>
                        : <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>● CLOSED</span>
                      }
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>
                      {specIcon(clinic.specialization)} {clinic.name}
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 3px' }}>📍 {clinic.address}</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      🕐 {clinic.open_time?.slice(0,5)} – {clinic.close_time?.slice(0,5)}
                      {clinic.distance && <span style={{ color: '#2563eb', marginLeft: 8 }}>· 📍 {clinic.distance.toFixed(1)} km</span>}
                    </p>
                  </div>

                  <div style={{ textAlign: 'center', minWidth: 65 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: clinic.totalWaiting > 10 ? '#dc2626' : clinic.totalWaiting > 5 ? '#d97706' : '#16a34a' }}>
                      {clinic.totalWaiting || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>waiting</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>~{((clinic.totalWaiting || 0) * 8)} min</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>👨‍⚕️ {clinic.doctorCount || 1} doctor{clinic.doctorCount > 1 ? 's' : ''}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>{'★'.repeat(Math.round(clinic.rating || 4))}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{clinic.rating}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>({clinic.total_reviews})</span>
                  </div>
                </div>

                <button style={{ width: '100%', marginTop: 10, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  View Clinic & Book Appointment →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Register clinic CTA section */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, #1e40af, #2563eb)', borderRadius: 20, padding: '24px 20px', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏥</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>Own a Clinic?</h3>
          <p style={{ fontSize: 13, color: '#bfdbfe', margin: '0 0 16px', lineHeight: 1.6 }}>
            Join QFlow for free — get online bookings, AI triage, live queue management and patient notifications all in one dashboard.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
            {['📅 Online Bookings', '🤖 AI Triage', '📊 Analytics', '📱 Notifications', '⭐ Reviews'].map(f => (
              <span key={f} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 500 }}>{f}</span>
            ))}
          </div>
          <button
            onClick={() => navigate('/register-clinic')}
            style={{ background: 'white', color: '#1e40af', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
            Register Your Clinic — Free 🚀
          </button>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '8px 0 0' }}>No credit card · Setup in 5 minutes · Cancel anytime</p>
        </div>

      </div>

      <AIChatbot />
    </div>
  )
}
