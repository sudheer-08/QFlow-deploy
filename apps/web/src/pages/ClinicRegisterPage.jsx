import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useAuthStore } from '../store/authStore'

const STEPS = ['Clinic Info', 'Location', 'Doctors', 'Account']
const DEFAULT_MAP_CENTER = [30.7333, 76.7794]

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

function LocationSelector({ selectedPosition, onSelect }) {
  useMapEvents({
    click: (event) => {
      const { lat, lng } = event.latlng
      onSelect(lat, lng)
    }
  })

  if (!selectedPosition) return null
  return <Marker position={selectedPosition} />
}

function FocusSelectedLocation({ selectedPosition }) {
  const map = useMap()

  useEffect(() => {
    if (selectedPosition) {
      map.setView(selectedPosition, 16, { animate: true })
    }
  }, [map, selectedPosition])

  return null
}

export default function ClinicRegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [error, setError] = useState('')

  const [clinic, setClinic] = useState({
    // Step 1 — Clinic info
    name: '',
    phone: '',
    specialization: 'Dental',
    openTime: '09:00',
    closeTime: '20:00',
    // Step 2 — Location
    address: '',
    city: 'Chandigarh',
    lat: '',
    lng: '',
    // Step 3 — Doctors
    doctors: [{ name: '', specialization: 'General Dentistry', experience: '5', fee: '300' }],
    // Step 4 — Admin account
    adminName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const updateClinic = (field, value) => setClinic(prev => ({ ...prev, [field]: value }))

  const parsedLat = parseFloat(clinic.lat)
  const parsedLng = parseFloat(clinic.lng)
  const hasValidCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
  const selectedPosition = hasValidCoordinates ? [parsedLat, parsedLng] : null
  const mapCenter = selectedPosition || DEFAULT_MAP_CENTER

  const setCoordinates = (lat, lng) => {
    updateClinic('lat', lat.toFixed(6))
    updateClinic('lng', lng.toFixed(6))
    setLocationError('')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported on this device.')
      return
    }

    setLocationLoading(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(position.coords.latitude, position.coords.longitude)
        setLocationLoading(false)
      },
      () => {
        setLocationError('Could not get current location. Please allow location access.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (step !== 1) {
      setLocationError('')
    }
  }, [step])

  const updateDoctor = (idx, field, value) => {
    const updated = [...clinic.doctors]
    updated[idx] = { ...updated[idx], [field]: value }
    setClinic(prev => ({ ...prev, doctors: updated }))
  }

  const addDoctor = () => {
    if (clinic.doctors.length >= 5) return
    setClinic(prev => ({
      ...prev,
      doctors: [...prev.doctors, { name: '', specialization: 'General Dentistry', experience: '5', fee: '300' }]
    }))
  }

  const removeDoctor = (idx) => {
    if (clinic.doctors.length === 1) return
    setClinic(prev => ({ ...prev, doctors: prev.doctors.filter((_, i) => i !== idx) }))
  }

  // Generate subdomain from clinic name
  const generateSubdomain = (name) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .slice(0, 20)
  }

  const handleSubmit = async () => {
    if (clinic.password !== clinic.confirmPassword) {
      return setError('Passwords do not match')
    }
    if (clinic.password.length < 6) {
      return setError('Password must be at least 6 characters')
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinic.name,
          subdomain: generateSubdomain(clinic.name),
          address: clinic.address,
          city: clinic.city,
          lat: parseFloat(clinic.lat) || null,
          lng: parseFloat(clinic.lng) || null,
          phone: clinic.phone,
          specialization: clinic.specialization,
          openTime: clinic.openTime,
          closeTime: clinic.closeTime,
          doctors: clinic.doctors,
          adminName: clinic.adminName,
          adminEmail: clinic.email,
          adminPassword: clinic.password
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        return
      }

      // Auto login after registration
      login(data.user, data.accessToken, data.refreshToken)
      navigate('/admin')

    } catch (err) {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 0) return clinic.name && clinic.phone && clinic.openTime && clinic.closeTime
    if (step === 1) return clinic.address && clinic.city
    if (step === 2) return clinic.doctors.every(d => d.name && d.specialization)
    if (step === 3) return clinic.adminName && clinic.email && clinic.password && clinic.confirmPassword
    return false
  }

  const specializations = [
    'Dental', 'Dental & Orthodontics', 'Pediatric Dentistry',
    'Oral Surgery', 'Cosmetic Dentistry', 'General Medicine',
    'Dermatology', 'Orthopedics', 'ENT', 'Gynecology'
  ]

  const doctorSpecializations = [
    'General Dentistry', 'Orthodontics', 'Pediatric Dentistry',
    'Oral Surgery', 'Cosmetic Dentistry', 'Endodontics',
    'Periodontics', 'Implantology', 'General Medicine'
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 160 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '28px 20px 20px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 16 }}>←</button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Register Your Clinic</h1>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>Join QFlow — Start accepting bookings today</p>
          </div>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((s, i) => (
            <div key={s} onClick={() => setStep(i)} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
              <div style={{ height: 4, borderRadius: 99, background: i <= step ? 'white' : 'rgba(255,255,255,0.3)', marginBottom: 4, transition: 'all 0.2s' }} />
              <span style={{ fontSize: 10, color: i <= step ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: i === step ? 700 : 400 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Step 0 — Clinic Info */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Basic Information</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Clinic Name *</label>
                <input value={clinic.name} onChange={e => updateClinic('name', e.target.value)}
                  placeholder="e.g. Smile Care Dental Clinic"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                {clinic.name && (
                  <p style={{ fontSize: 11, color: '#2563eb', margin: '4px 0 0' }}>
                    Your URL: qflow.com/clinic/{generateSubdomain(clinic.name)}
                  </p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Clinic Phone *</label>
                <input value={clinic.phone} onChange={e => updateClinic('phone', e.target.value)}
                  placeholder="+91 98765 43210" type="tel"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Specialization *</label>
                <select value={clinic.specialization} onChange={e => updateClinic('specialization', e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white' }}>
                  {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Opening Time *</label>
                  <input value={clinic.openTime} onChange={e => updateClinic('openTime', e.target.value)}
                    type="time"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Closing Time *</label>
                  <input value={clinic.closeTime} onChange={e => updateClinic('closeTime', e.target.value)}
                    type="time"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <button onClick={() => setStep(step - 1)}
                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
                  style={{ background: canProceed() ? '#2563eb' : '#e2e8f0', color: canProceed() ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>
                  Next → {STEPS[step + 1]}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Location */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Clinic Location</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Full Address *</label>
                <textarea value={clinic.address} onChange={e => updateClinic('address', e.target.value)}
                  placeholder="e.g. SCO 45, Sector 17, Chandigarh - 160017"
                  rows={3}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>City *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Chandigarh', 'Mohali', 'Panchkula'].map(city => (
                    <button key={city} onClick={() => updateClinic('city', city)}
                      style={{ flex: 1, padding: '10px', border: `2px solid ${clinic.city === city ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: clinic.city === city ? '#eff6ff' : 'white', color: clinic.city === city ? '#2563eb' : '#374151' }}>
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Latitude (optional)</label>
                  <input value={clinic.lat} onChange={e => updateClinic('lat', e.target.value)}
                    placeholder="e.g. 30.7414"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Longitude (optional)</label>
                  <input value={clinic.lng} onChange={e => updateClinic('lng', e.target.value)}
                    placeholder="e.g. 76.7682"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <button
                onClick={useCurrentLocation}
                disabled={locationLoading}
                style={{
                  background: locationLoading ? '#e2e8f0' : '#eff6ff',
                  color: locationLoading ? '#94a3b8' : '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 10,
                  padding: '11px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: locationLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {locationLoading ? '⏳ Detecting your location...' : '📍 Use Current Location'}
              </button>

              {locationError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 10, fontSize: 12, color: '#b91c1c' }}>
                  {locationError}
                </div>
              )}

              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, color: '#475569', fontWeight: 600 }}>
                  Tap on the map to pin your clinic location
                </div>
                <div style={{ height: 260 }}>
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FocusSelectedLocation selectedPosition={selectedPosition} />
                    <LocationSelector selectedPosition={selectedPosition} onSelect={setCoordinates} />
                  </MapContainer>
                </div>
              </div>

              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, fontSize: 12, color: '#1d4ed8' }}>
                💡 Tip: Use current location or tap on map for instant coordinates. You can still edit values manually.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <button onClick={() => setStep(step - 1)}
                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
                  style={{ background: canProceed() ? '#2563eb' : '#e2e8f0', color: canProceed() ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>
                  Next → {STEPS[step + 1]}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Doctors */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Your Doctors</h2>
              {clinic.doctors.length < 5 && (
                <button onClick={addDoctor}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  + Add Doctor
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {clinic.doctors.map((doc, idx) => (
                <div key={idx} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Doctor {idx + 1}</span>
                    {clinic.doctors.length > 1 && (
                      <button onClick={() => removeDoctor(idx)}
                        style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input value={doc.name} onChange={e => updateDoctor(idx, 'name', e.target.value)}
                      placeholder="Doctor full name *"
                      style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    <select value={doc.specialization} onChange={e => updateDoctor(idx, 'specialization', e.target.value)}
                      style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                      {doctorSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input value={doc.experience} onChange={e => updateDoctor(idx, 'experience', e.target.value)}
                        placeholder="Experience (years)"
                        type="number"
                        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      <input value={doc.fee} onChange={e => updateDoctor(idx, 'fee', e.target.value)}
                        placeholder="Consultation fee ₹"
                        type="number"
                        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <button onClick={() => setStep(step - 1)}
                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
                style={{ background: canProceed() ? '#2563eb' : '#e2e8f0', color: canProceed() ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>
                Next → {STEPS[step + 1]}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Admin account */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Create Admin Account</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>This account manages your clinic dashboard</p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'adminName', label: 'Your Name *', placeholder: 'Clinic owner name', type: 'text' },
                { key: 'email', label: 'Email *', placeholder: 'admin@yourclinic.com', type: 'email' },
                { key: 'password', label: 'Password *', placeholder: 'Min 6 characters', type: 'password' },
                { key: 'confirmPassword', label: 'Confirm Password *', placeholder: 'Re-enter password', type: 'password' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <input value={clinic[field.key]} onChange={e => updateClinic(field.key, e.target.value)}
                    placeholder={field.placeholder} type={field.type}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', margin: '0 0 8px' }}>✅ Your clinic will get:</p>
              <div style={{ fontSize: 12, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ margin: 0 }}>🌐 Public page: qflow.com/clinic/{generateSubdomain(clinic.name)}</p>
                <p style={{ margin: 0 }}>📅 Online appointment booking</p>
                <p style={{ margin: 0 }}>📊 Admin dashboard with analytics</p>
                <p style={{ margin: 0 }}>📱 SMS + WhatsApp notifications</p>
                <p style={{ margin: 0 }}>🤖 AI symptom triage</p>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={!canProceed() || loading}
              style={{ width: '100%', background: canProceed() && !loading ? '#16a34a' : '#e2e8f0', color: canProceed() && !loading ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: canProceed() && !loading ? 'pointer' : 'not-allowed', marginTop: 10 }}>
              {loading ? '⏳ Registering clinic...' : '🏥 Register My Clinic — Free'}
            </button>

            <button onClick={() => step > 0 && setStep(step - 1)}
              style={{ width: '100%', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
              ← Back to Doctors
            </button>
          </div>
        )}

      </div>

      {/* Bottom CTA */}
      <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)}
            style={{ flex: '0 0 80px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ← Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={() => canProceed() && setStep(step + 1)}
            disabled={!canProceed()}
            style={{ flex: 1, background: canProceed() ? '#2563eb' : '#e2e8f0', color: canProceed() ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>
            Next → {STEPS[step + 1]}
          </button>
        ) : (
          <button onClick={handleSubmit}
            disabled={!canProceed() || loading}
            style={{ flex: 1, background: canProceed() && !loading ? '#16a34a' : '#e2e8f0', color: canProceed() && !loading ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: canProceed() && !loading ? 'pointer' : 'not-allowed' }}>
            {loading ? '⏳ Registering...' : '🏥 Register Free'}
          </button>
        )}
      </div>
    </div>
  )
}
