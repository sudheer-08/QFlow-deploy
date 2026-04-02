import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useAuthStore } from '../store/authStore'
import {
  getStrongPasswordMessage,
  isEmail,
  isNonEmptyString,
  isPhone,
  isStrongPassword,
  isTimeHHMM,
  normalizeEmail,
  normalizePhone
} from '../utils/validation'
import './ClinicRegisterPage.css'

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
    name: '',
    phone: '',
    specialization: 'Dental',
    openTime: '09:00',
    closeTime: '20:00',
    address: '',
    city: 'Chandigarh',
    lat: '',
    lng: '',
    doctors: [{ name: '', specialization: 'General Dentistry', experience: '5', fee: '300' }],
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

  const generateSubdomain = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').slice(0, 20)
  }

  const canProceed = () => {
    if (step === 0) {
      const cleanName = typeof clinic.name === 'string' ? clinic.name.trim() : clinic.name
      const cleanPhone = normalizePhone(clinic.phone)

      return isNonEmptyString(cleanName, 100)
        && isPhone(cleanPhone)
        && isTimeHHMM(clinic.openTime)
        && isTimeHHMM(clinic.closeTime)
    }
    if (step === 1) return isNonEmptyString(clinic.address, 200) && isNonEmptyString(clinic.city, 50)
    if (step === 2) return clinic.doctors.every(d => isNonEmptyString(d.name, 100) && isNonEmptyString(d.specialization, 100))
    if (step === 3) {
      return isNonEmptyString(clinic.adminName, 100)
        && isEmail(clinic.email)
        && isStrongPassword(clinic.password)
        && clinic.password === clinic.confirmPassword
    }
    return false
  }

  const getAccountValidationMessage = () => {
    if (step !== 3) return ''
    if (!isNonEmptyString(clinic.adminName, 100)) return 'Enter admin name.'
    if (!isEmail(clinic.email)) return 'Enter a valid admin email.'
    if (!isStrongPassword(clinic.password)) return getStrongPasswordMessage()
    if (clinic.password !== clinic.confirmPassword) return 'Password and confirm password must match.'
    return ''
  }

  const passwordChecks = [
    {
      label: 'At least 8 characters',
      pass: clinic.password.length >= 8
    },
    {
      label: 'One uppercase letter (A-Z)',
      pass: /[A-Z]/.test(clinic.password)
    },
    {
      label: 'One lowercase letter (a-z)',
      pass: /[a-z]/.test(clinic.password)
    },
    {
      label: 'One number (0-9)',
      pass: /\d/.test(clinic.password)
    },
    {
      label: 'One special character',
      pass: /[^A-Za-z0-9]/.test(clinic.password)
    },
    {
      label: 'Password and confirm password match',
      pass: !!clinic.password && !!clinic.confirmPassword && clinic.password === clinic.confirmPassword
    }
  ]

  const handleSubmit = async () => {
    const cleanName = clinic.name.trim()
    const cleanPhone = normalizePhone(clinic.phone)
    const cleanAdminName = clinic.adminName.trim()
    const cleanEmail = normalizeEmail(clinic.email)
    const generatedSubdomain = generateSubdomain(cleanName)

    if (!isNonEmptyString(cleanName, 100)) return setError('Clinic name is required.')
    if (!isPhone(cleanPhone)) return setError('Please enter a valid clinic phone number.')
    if (!isTimeHHMM(clinic.openTime) || !isTimeHHMM(clinic.closeTime)) return setError('Opening and closing time must be in HH:MM format.')
    if (!isNonEmptyString(clinic.address, 200)) return setError('Clinic address is required.')
    if (!isNonEmptyString(clinic.city, 50)) return setError('City is required.')
    if (!clinic.doctors.every(d => isNonEmptyString(d.name, 100) && isNonEmptyString(d.specialization, 100))) {
      return setError('Please add valid doctor names and specializations.')
    }
    if (!isNonEmptyString(cleanAdminName, 100)) return setError('Admin name is required.')
    if (!isEmail(cleanEmail)) return setError('Please enter a valid admin email.')
    if (!isStrongPassword(clinic.password)) return setError(getStrongPasswordMessage())
    if (clinic.password !== clinic.confirmPassword) return setError('Passwords do not match.')
    if (!generatedSubdomain) return setError('Clinic name should contain letters or numbers to generate URL.')

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: cleanName,
          subdomain: generatedSubdomain,
          address: clinic.address.trim(),
          city: clinic.city.trim(),
          lat: parseFloat(clinic.lat) || null,
          lng: parseFloat(clinic.lng) || null,
          phone: cleanPhone,
          specialization: clinic.specialization,
          openTime: clinic.openTime,
          closeTime: clinic.closeTime,
          doctors: clinic.doctors.map(doc => ({
            ...doc,
            name: doc.name.trim(),
            specialization: doc.specialization.trim()
          })),
          adminName: cleanAdminName,
          adminEmail: cleanEmail,
          adminPassword: clinic.password
        })
      })

      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return
      }

      await login(data.user, data.accessToken, data.refreshToken)
      navigate('/admin')
    } catch (err) {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
    <div className="cr-shell">
      <div className="cr-orb cr-orb-left" />
      <div className="cr-orb cr-orb-right" />

      <header className="cr-topbar">
        <div className="cr-top-row">
          <button className="cr-back" onClick={() => (step > 0 ? setStep(step - 1) : navigate('/'))}>←</button>
          <div>
            <h1>List Your Clinic</h1>
            <p>Register and start receiving bookings today</p>
          </div>
        </div>

        <div className="cr-stepper">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`cr-step ${i <= step ? 'is-on' : ''} ${i === step ? 'is-current' : ''}`}
              onClick={() => setStep(i)}
            >
              <span className="cr-step-line" />
              <span className="cr-step-label">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="cr-main-card">
        {step === 0 && (
          <section className="cr-section">
            <div className="cr-head">
              <h2>Clinic Information</h2>
              <p>Set core details your patients will see first.</p>
            </div>

            <label className="cr-field">
              <span>Clinic Name *</span>
              <input value={clinic.name} onChange={e => updateClinic('name', e.target.value)} placeholder="e.g. Smile Care Dental Clinic" />
              {clinic.name && <small>Public URL: qflow.com/clinic/{generateSubdomain(clinic.name)}</small>}
            </label>

            <label className="cr-field">
              <span>Clinic Phone *</span>
              <input value={clinic.phone} onChange={e => updateClinic('phone', e.target.value)} placeholder="+91 98765 43210" type="tel" />
            </label>

            <label className="cr-field">
              <span>Specialization *</span>
              <select value={clinic.specialization} onChange={e => updateClinic('specialization', e.target.value)}>
                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <div className="cr-grid2">
              <label className="cr-field">
                <span>Opening Time *</span>
                <input value={clinic.openTime} onChange={e => updateClinic('openTime', e.target.value)} type="time" />
              </label>
              <label className="cr-field">
                <span>Closing Time *</span>
                <input value={clinic.closeTime} onChange={e => updateClinic('closeTime', e.target.value)} type="time" />
              </label>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="cr-section">
            <div className="cr-head">
              <h2>Clinic Location</h2>
              <p>Add address and optionally pin map location for better discovery.</p>
            </div>

            <label className="cr-field">
              <span>Full Address *</span>
              <textarea value={clinic.address} onChange={e => updateClinic('address', e.target.value)} rows={3} placeholder="SCO 45, Sector 17, Chandigarh" />
            </label>

            <div>
              <span className="cr-inline-label">City *</span>
              <div className="cr-chip-row">
                {['Chandigarh', 'Mohali', 'Panchkula'].map(city => (
                  <button
                    key={city}
                    type="button"
                    className={`cr-chip ${clinic.city === city ? 'is-active' : ''}`}
                    onClick={() => updateClinic('city', city)}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="cr-grid2">
              <label className="cr-field">
                <span>Latitude (optional)</span>
                <input value={clinic.lat} onChange={e => updateClinic('lat', e.target.value)} placeholder="30.7414" />
              </label>
              <label className="cr-field">
                <span>Longitude (optional)</span>
                <input value={clinic.lng} onChange={e => updateClinic('lng', e.target.value)} placeholder="76.7682" />
              </label>
            </div>

            <button type="button" className="cr-location-btn" onClick={useCurrentLocation} disabled={locationLoading}>
              {locationLoading ? 'Detecting location...' : 'Use current location'}
            </button>

            {locationError && <div className="cr-error">{locationError}</div>}

            <div className="cr-map-card">
              <div className="cr-map-head">Tap on the map to pin clinic location</div>
              <div className="cr-map-wrap">
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FocusSelectedLocation selectedPosition={selectedPosition} />
                  <LocationSelector selectedPosition={selectedPosition} onSelect={setCoordinates} />
                </MapContainer>
              </div>
            </div>

            <div className="cr-tip">Tip: pinning map location helps patients find your clinic faster.</div>
          </section>
        )}

        {step === 2 && (
          <section className="cr-section">
            <div className="cr-head cr-head-inline">
              <div>
                <h2>Doctors</h2>
                <p>Add up to 5 doctors for appointment routing.</p>
              </div>
              {clinic.doctors.length < 5 && (
                <button type="button" className="cr-add" onClick={addDoctor}>+ Add Doctor</button>
              )}
            </div>

            <div className="cr-stack">
              {clinic.doctors.map((doc, idx) => (
                <article key={idx} className="cr-doctor-card">
                  <div className="cr-doc-head">
                    <strong>Doctor {idx + 1}</strong>
                    {clinic.doctors.length > 1 && (
                      <button type="button" className="cr-remove" onClick={() => removeDoctor(idx)}>Remove</button>
                    )}
                  </div>

                  <label className="cr-field">
                    <span>Doctor Name *</span>
                    <input value={doc.name} onChange={e => updateDoctor(idx, 'name', e.target.value)} placeholder="Doctor full name" />
                  </label>

                  <label className="cr-field">
                    <span>Specialization *</span>
                    <select value={doc.specialization} onChange={e => updateDoctor(idx, 'specialization', e.target.value)}>
                      {doctorSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>

                  <div className="cr-grid2">
                    <label className="cr-field">
                      <span>Experience</span>
                      <input value={doc.experience} onChange={e => updateDoctor(idx, 'experience', e.target.value)} type="number" placeholder="Years" />
                    </label>
                    <label className="cr-field">
                      <span>Consultation Fee</span>
                      <input value={doc.fee} onChange={e => updateDoctor(idx, 'fee', e.target.value)} type="number" placeholder="300" />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="cr-section">
            <div className="cr-head">
              <h2>Create Admin Account</h2>
              <p>This account controls your clinic dashboard and settings.</p>
            </div>

            {error && <div className="cr-error">{error}</div>}

            {[
              { key: 'adminName', label: 'Your Name *', placeholder: 'Clinic owner name', type: 'text' },
              { key: 'email', label: 'Email *', placeholder: 'admin@yourclinic.com', type: 'email' },
              { key: 'password', label: 'Password *', placeholder: '8+ chars, Aa1!', type: 'password' },
              { key: 'confirmPassword', label: 'Confirm Password *', placeholder: 'Re-enter password', type: 'password' }
            ].map(field => (
              <label key={field.key} className="cr-field">
                <span>{field.label}</span>
                <input
                  value={clinic[field.key]}
                  onChange={e => updateClinic(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  type={field.type}
                />
              </label>
            ))}

            <div className="cr-password-checklist">
              {passwordChecks.map((rule) => (
                <div key={rule.label} className={`cr-password-rule ${rule.pass ? 'is-pass' : 'is-fail'}`}>
                  <span>{rule.pass ? '✓' : '•'}</span>
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>

            {!!getAccountValidationMessage() && (
              <div className="cr-tip">{getAccountValidationMessage()}</div>
            )}

            <div className="cr-summary">
              <p className="cr-summary-title">Your clinic will get</p>
              <ul>
                <li>Public page: qflow.com/clinic/{generateSubdomain(clinic.name || 'yourclinic')}</li>
                <li>Online appointment booking</li>
                <li>Admin dashboard and analytics</li>
                <li>Patient notifications</li>
                <li>AI-assisted intake support</li>
              </ul>
            </div>
          </section>
        )}
      </main>

      <div className="cr-inline-actions">
        {step > 0 && (
          <button type="button" className="cr-inline-back" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}

        {step < 3 ? (
          <button type="button" className="cr-inline-next" onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}>
            Next: {STEPS[step + 1]}
          </button>
        ) : (
          <button type="button" className="cr-inline-submit" onClick={handleSubmit} disabled={!canProceed() || loading}>
            {loading ? 'Registering...' : 'Register Clinic'}
          </button>
        )}
      </div>

      <footer className="cr-footer">
        {step > 0 && (
          <button type="button" className="cr-footer-back" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}

        {step < 3 ? (
          <button type="button" className="cr-footer-next" onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}>
            Next: {STEPS[step + 1]}
          </button>
        ) : (
          <button type="button" className="cr-footer-submit" onClick={handleSubmit} disabled={!canProceed() || loading}>
            {loading ? 'Registering...' : 'Register Clinic'}
          </button>
        )}
      </footer>
    </div>
  )
}
