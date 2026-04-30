import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import VoiceInput from '../components/VoiceInput'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { isEmail, isNonEmptyString, isPhone, normalizeEmail, normalizePhone } from '../utils/validation'
import socket, { connectPublicClinic } from '../socket'
import './BookAppointmentPage.css'

const getDoctorId = (doctor) => {
  if (!doctor) return ''
  const candidates = [doctor.id, doctor.doctorId, doctor.doctor_id, doctor.userId, doctor.user_id]
  const match = candidates.find(v => v !== null && v !== undefined && String(v).trim())
  return match ? String(match).trim() : ''
}

const hasValidDoctorId = (value) => {
  const clean = String(value ?? '').trim()
  return Boolean(clean) && clean !== 'undefined' && clean !== 'null'
}

const normalizeText = (value) => String(value ?? '').trim().toLowerCase()
const normalizeDoctorName = (value) => normalizeText(value).replace(/\./g, '').replace(/\s+/g, ' ')

const matchesDoctorParam = (doctor, rawDoctorParam) => {
  if (!doctor || !rawDoctorParam) return false
  const candidates = [doctor.id, doctor.doctorId, doctor.doctor_id, doctor.userId, doctor.user_id]
  const cleanParam = normalizeText(rawDoctorParam)
  if (candidates.some(v => normalizeText(v) === cleanParam)) {
    return true
  }
  return normalizeDoctorName(doctor.name) === normalizeDoctorName(rawDoctorParam)
}

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || `Request failed (${response.status})`)
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

export default function BookAppointmentPage() {
  const { subdomain } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const lastToastAtRef = useRef(0)
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const preselectedDoctor = searchParams.get('doctor')
  const rescheduleId = searchParams.get('reschedule')
  const isReschedule = !!rescheduleId
  const accessToken = useAuthStore(state => state.accessToken)

  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState({
    doctorId: '',
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    slot: '',
    fee: 0
  })
  const [form, setForm] = useState({
    patientName: '', phone: '', email: '', symptoms: '', visitType: 'first_visit'
  })
  const [formError, setFormError] = useState('')
  const [booking, setBooking] = useState(null)
  const [oldAppointment, setOldAppointment] = useState(null)
  const [rescheduleError, setRescheduleError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const safeSubdomain = subdomain && subdomain !== 'undefined' ? subdomain : ''
  const resolvedSubdomain = safeSubdomain || oldAppointment?.tenants?.subdomain || ''

  const validateDetailsStep = () => {
    const cleanName = form.patientName.trim()
    const cleanPhone = normalizePhone(form.phone)
    const cleanEmail = form.email ? normalizeEmail(form.email) : ''

    if (!isNonEmptyString(cleanName, 100)) return 'Please enter your full name.'
    if (!isPhone(cleanPhone)) return 'Please enter a valid phone number.'
    if (form.email && !isEmail(cleanEmail)) return 'Please enter a valid email address.'
    return ''
  }

  const { data: clinic, dataUpdatedAt: clinicUpdatedAt } = useQuery({
    queryKey: ['clinic', resolvedSubdomain],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics/${resolvedSubdomain}`).then(r => r.json()),
    enabled: !!resolvedSubdomain
  })

  const selectedDoctorId = String(selected.doctorId ?? '').trim()
  const fallbackDoctor = clinic?.doctors?.find(d => normalizeDoctorName(d.name) === normalizeDoctorName(selected.doctorName))
  const fallbackDoctorId = getDoctorId(fallbackDoctor)
  const resolvedDoctorId = hasValidDoctorId(selectedDoctorId) ? selectedDoctorId : fallbackDoctorId
  const selectedDoctorIdIsValid = hasValidDoctorId(resolvedDoctorId)

  // Load old appointment if rescheduling
  const { data: oldApptData } = useQuery({
    queryKey: ['appointment', rescheduleId],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/appointments/${rescheduleId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }).then(r => r.json()),
    enabled: isReschedule && !!user && !!accessToken
  })

  useEffect(() => {
    if (clinicUpdatedAt) {
      setLastUpdatedAt(new Date(clinicUpdatedAt))
    }
  }, [clinicUpdatedAt])

  // Load old appointment data and pre-select doctor if rescheduling
  useEffect(() => {
    if (!oldApptData || oldAppointment) return

    if (oldApptData.error || !oldApptData.doctor_id) {
      setRescheduleError(oldApptData.error || 'Unable to load appointment details for reschedule.')
      return
    }

      setOldAppointment(oldApptData)
      // Pre-select the doctor from old appointment
      const doctorId = oldApptData.doctor_id
      const doctorName = oldApptData.doctors?.name || oldApptData.users?.name || ''
      const fee = 300
      setSelected(prev => ({
        ...prev,
        doctorId,
        doctorName,
        fee
      }))
  }, [oldApptData, oldAppointment])

  useEffect(() => {
    if (!clinic?.doctors?.length) return
    if (selectedDoctorIdIsValid) return

    const docFromQuery = preselectedDoctor
      ? clinic.doctors.find(d => matchesDoctorParam(d, preselectedDoctor))
      : null

    const docFromName = selected.doctorName
      ? clinic.doctors.find(d => normalizeDoctorName(d.name) === normalizeDoctorName(selected.doctorName))
      : null

    const matchedDoctor = docFromQuery || docFromName
    const doctorId = getDoctorId(matchedDoctor)

    if (matchedDoctor && hasValidDoctorId(doctorId)) {
      setSelected(prev => ({
        ...prev,
        doctorId,
        doctorName: matchedDoctor.name,
        fee: prev.fee || matchedDoctor.consultationFee || 300
      }))
    }
  }, [clinic, preselectedDoctor, selected.doctorName, selectedDoctorIdIsValid])

  useEffect(() => {
    if (!clinic?.doctors || selectedDoctorIdIsValid || !selected.doctorName) return
    const doc = clinic.doctors.find(d => normalizeText(d.name) === normalizeText(selected.doctorName))
    const doctorId = getDoctorId(doc)
    if (doc && hasValidDoctorId(doctorId)) {
      setSelected(prev => ({
        ...prev,
        doctorId,
        doctorName: doc.name,
        fee: prev.fee || doc.consultationFee || 300
      }))
    }
  }, [clinic, selected.doctorName, selectedDoctorIdIsValid])

  useEffect(() => {
    if (step >= 2 && !selectedDoctorIdIsValid) {
      setStep(1)
      setSelected(prev => ({ ...prev, slot: '' }))
      toast.error('Please select a doctor before choosing a time slot.')
    }
  }, [step, selectedDoctorIdIsValid, toast])

  useEffect(() => {
    if (user && user.role === 'patient') {
      setForm(prev => ({
        ...prev,
        patientName: prev.patientName || user.name || '',
        phone: prev.phone || user.phone || '',
        email: prev.email || user.email || ''
      }))
    }
  }, [user])

  useEffect(() => {
    if (!resolvedSubdomain) return
    connectPublicClinic(resolvedSubdomain)

    const handleClinicUpdate = (payload) => {
      queryClient.invalidateQueries({ queryKey: ['clinic', resolvedSubdomain] })

      if (payload?.type === 'appointment_booked') {
        const now = Date.now()
        if (now - lastToastAtRef.current > 6000) {
          toast.success('New booking received. Slots updated.')
          lastToastAtRef.current = now
        }
      }

      if (selectedDoctorIdIsValid && selected.date) {
        const matchesCurrentDoctor = !payload?.doctorId || payload.doctorId === resolvedDoctorId
        const matchesCurrentDate = !payload?.date || payload.date === selected.date
        if (matchesCurrentDoctor && matchesCurrentDate) {
          queryClient.invalidateQueries({ queryKey: ['slots', resolvedDoctorId, selected.date] })
        }
      }
    }

    socket.on('clinic:updated', handleClinicUpdate)

    return () => {
      socket.off('clinic:updated', handleClinicUpdate)
    }
  }, [resolvedSubdomain, queryClient, selected.doctorId, selected.date, selectedDoctorIdIsValid, resolvedDoctorId])

  const { data: slotsData, isLoading: loadingSlots, dataUpdatedAt: slotsUpdatedAt } = useQuery({
    queryKey: ['slots', selectedDoctorIdIsValid ? resolvedDoctorId : 'invalid-doctor', selected.date],
    queryFn: async () => {
      if (!hasValidDoctorId(resolvedDoctorId)) {
        return { slots: [], error: 'Please select a doctor first.' }
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/appointments/slots?doctorId=${encodeURIComponent(resolvedDoctorId)}&date=${selected.date}`)
      return response.json()
    },
    enabled: selectedDoctorIdIsValid && !!selected.date && step >= 2
  })

  useEffect(() => {
    if (step !== 2) return
    if (slotsData?.error !== 'doctorId is required') return
    setStep(1)
    toast.error('Doctor selection expired. Please choose doctor again.')
  }, [step, slotsData?.error, toast])

  useEffect(() => {
    if (slotsUpdatedAt) {
      setLastUpdatedAt(new Date(slotsUpdatedAt))
    }
  }, [slotsUpdatedAt])

  const bookMutation = useMutation({
    mutationFn: (data) => {
      if (isReschedule && rescheduleId) {
        // Reschedule endpoint: PATCH /api/appointments/:id/reschedule
        return fetchJsonWithTimeout(`${import.meta.env.VITE_API_URL}/appointments/${rescheduleId}/reschedule`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            date: data.date,
            slotTime: data.slotTime
          })
        })
      } else {
        // New booking endpoint: POST /api/appointments/book
        return fetchJsonWithTimeout(`${import.meta.env.VITE_API_URL}/appointments/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      }
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error)
        return
      }
      if (isReschedule) {
        toast.success('Appointment rescheduled successfully!')
        // Redirect to appointments page
        setTimeout(() => navigate('/'), 2000)
      } else {
        toast.success('Appointment booked successfully!')
        setBooking(data)
        navigate('/payment', { state: data })
      }
    },
    onError: (err) => toast.error(err?.message || 'Failed. Please try again.')
  })

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    }
  })

  // Mark old appointment slot as unavailable when rescheduling
  const processedSlotsData = isReschedule && oldAppointment && slotsData
    ? {
        ...slotsData,
        slots: slotsData.slots.map(s => ({
          ...s,
          available: oldAppointment.appointment_date === selected.date && s.time === oldAppointment.slot_time
            ? false
            : s.available
        }))
      }
    : slotsData

  const morningSlots = processedSlotsData?.slots?.filter(s => Number(s.time.split(':')[0]) < 13) || []
  const eveningSlots = processedSlotsData?.slots?.filter(s => Number(s.time.split(':')[0]) >= 13) || []

  if (step === 5 && booking) {
    return (
      <div className="ba-success-shell">
        <div className="ba-success-card">
          <div className="ba-success-emoji">🎉</div>
          <h2>Appointment Booked!</h2>
          <p>Check your WhatsApp for confirmation.</p>

          <div className="ba-summary-grid">
            {[
              ['Clinic', booking.clinicName],
              ['Doctor', booking.doctorName],
              ['Date', new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
              ['Time', booking.slotTime],
              ['Fee', `₹${booking.consultationFee}`]
            ].map(([label, value]) => (
              <div key={label} className="ba-summary-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <button className="ba-success-primary" onClick={() => navigate(`/track-appointment/${booking.trackerToken}`)}>
            Track My Appointment
          </button>
          <button className="ba-success-secondary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const renderStepOne = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>{isReschedule ? 'Pick New Date & Time' : 'Choose Doctor & Date'}</h2>
        <p>{isReschedule ? 'Your appointment will be moved.' : 'Start by selecting who and when.'}</p>
      </div>

      {!isReschedule && (
        <>
          <p className="ba-label">Select Doctor</p>
          <div className="ba-doctor-grid">
            {(clinic?.doctors || []).map(doc => {
              const doctorId = getDoctorId(doc)
              const isActive = selected.doctorId.trim() === doctorId
              return (
                <button
                  key={doctorId || doc.id || doc.name}
                  type="button"
                  disabled={!hasValidDoctorId(doctorId)}
                  className={`ba-doctor-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    if (!hasValidDoctorId(doctorId)) return
                    setSelected(prev => ({ ...prev, doctorId, doctorName: doc.name, fee: doc.consultationFee || 300 }))
                  }}
                >
                  <div className="ba-doctor-line">
                    <div>
                      <strong>{doc.name}</strong>
                      <span>{doc.specialization}</span>
                    </div>
                    <div className="ba-doctor-meta">
                      <em>₹{doc.consultationFee || 300}</em>
                      <small>{doc.queueCount || 0} waiting</small>
                    </div>
                  </div>
                  {isActive && <span className="ba-doctor-selected">Selected</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {isReschedule && oldAppointment && (
        <div className="ba-ok">
          <strong>Current appointment:</strong> {oldAppointment.tenants?.name} with {selected.doctorName} on {new Date(oldAppointment.appointment_date).toLocaleDateString('en-IN')} at {oldAppointment.slot_time?.slice(0, 5)}
        </div>
      )}

      <p className="ba-label">Select Date</p>
      <div className="ba-chip-row">
        {next7Days.map(day => (
          <button
            key={day.value}
            type="button"
            className={`ba-chip ${selected.date === day.value ? 'is-active' : ''}`}
            onClick={() => setSelected(prev => ({ ...prev, date: day.value }))}
          >
            {day.label}
          </button>
        ))}
      </div>
    </section>
  )

  const renderSlotGrid = (title, slots) => (
    <div className="ba-slot-block">
      <p className="ba-label">{title}</p>
      <div className="ba-slot-grid">
        {slots.map(slot => (
          <button
            key={slot.time}
            type="button"
            disabled={!slot.available}
            className={`ba-slot ${selected.slot === slot.time ? 'is-active' : ''} ${!slot.available ? 'is-disabled' : ''}`}
            onClick={() => slot.available && setSelected(prev => ({ ...prev, slot: slot.time, fee: slot.consultationFee }))}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  )

  const renderStepTwo = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>Pick a Time Slot</h2>
        <p>{selected.doctorName} • {new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {loadingSlots && <div className="ba-empty">Loading available slots...</div>}
      {!loadingSlots && slotsData?.error && <div className="ba-error">{slotsData.error}</div>}
      {!loadingSlots && !slotsData?.error && morningSlots.length === 0 && eveningSlots.length === 0 && (
        <div className="ba-empty">
          No slots available for this date.
          <button className="ba-inline-btn" onClick={() => setStep(1)}>Change Date</button>
        </div>
      )}
      {!loadingSlots && !slotsData?.error && (
        <>
          {morningSlots.length > 0 && renderSlotGrid('Morning', morningSlots)}
          {eveningSlots.length > 0 && renderSlotGrid('Evening', eveningSlots)}
        </>
      )}
    </section>
  )

  const renderStepThree = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>Your Details</h2>
        <p>We will use these for confirmation messages.</p>
      </div>

      {formError && <div className="ba-error">{formError}</div>}
      {user?.role === 'patient' && (
        <div className="ba-ok">Logged in as <strong>{user.name}</strong>. Details auto-filled.</div>
      )}

      <div className="ba-form-grid">
        {[
          { key: 'patientName', label: 'Full Name *', type: 'text', placeholder: 'Your full name' },
          { key: 'phone', label: 'WhatsApp Number *', type: 'tel', placeholder: '+91 98765 43210' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'you@email.com' }
        ].map(field => (
          <label key={field.key} className="ba-field">
            <span>{field.label}</span>
            <input
              value={form[field.key]}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
              type={field.type}
              placeholder={field.placeholder}
            />
          </label>
        ))}

        <label className="ba-field">
          <span>Symptoms / Reason for Visit</span>
          <VoiceInput onResult={(text) => setForm({ ...form, symptoms: text })} placeholder="Tap mic or type symptoms" />
          <textarea
            value={form.symptoms}
            onChange={e => setForm({ ...form, symptoms: e.target.value })}
            rows={3}
            placeholder="e.g. Toothache, cavity, cleaning..."
          />
        </label>

        <div className="ba-visit-row">
          {[
            ['first_visit', 'First Visit'],
            ['follow_up', 'Follow Up']
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`ba-visit ${form.visitType === val ? 'is-active' : ''}`}
              onClick={() => setForm({ ...form, visitType: val })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )

  const renderStepFour = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>{isReschedule ? 'Confirm New Date & Time' : 'Confirm Appointment'}</h2>
        <p>{isReschedule ? 'Review your rescheduled appointment.' : 'Review before you lock this slot.'}</p>
      </div>

      <div className="ba-summary-grid">
        {[
          ['Clinic', isReschedule ? oldAppointment?.tenants?.name : clinic?.name],
          ['Doctor', selected.doctorName],
          ['Date', new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
          ['Time', selected.slot],
          ...(isReschedule ? [] : [['Patient', form.patientName]]),
          ...(isReschedule ? [] : [['WhatsApp', form.phone]])
        ].map(([label, value]) => (
          <div key={label} className="ba-summary-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        {!isReschedule && (
          <div className="ba-summary-total">
            <span>Consultation Fee</span>
            <strong>₹{selected.fee || 300}</strong>
          </div>
        )}
      </div>

      {!isReschedule && (
        <div className="ba-note">Fee is paid at the clinic. Slot gets confirmed immediately after submission.</div>
      )}
    </section>
  )

  return (
    <div className="ba-shell">
      <div className="ba-bg-orb ba-bg-orb-left" />
      <div className="ba-bg-orb ba-bg-orb-right" />

      <header className="ba-topbar">
        <button
          className="ba-back"
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(resolvedSubdomain ? `/clinic/${resolvedSubdomain}` : '/patient/dashboard'))}
        >
          ←
        </button>
        <div>
          <h1>{isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}</h1>
          <p>{clinic?.name || oldAppointment?.tenants?.name || 'Loading clinic...'}</p>
          {lastUpdatedAt && (
            <p className="ba-live-status">
              <span className="ba-live-dot" />
              <span>
                Live updated: {lastUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </p>
          )}
        </div>
        <div className="ba-progress">
          {[1, 2, isReschedule ? 4 : 3, 4].map((stepNum, idx) => {
            const displayNum = idx + 1
            const isOn = isReschedule 
              ? (stepNum === 1 && step >= 1) || (stepNum === 2 && step >= 2) || (stepNum === 4 && step >= 4)
              : step >= stepNum
            return <span key={stepNum} className={isOn ? 'is-on' : ''} />
          })}
        </div>
      </header>

      <main className="ba-main">
        {rescheduleError && (
          <section className="ba-step-card">
            <div className="ba-error">{rescheduleError}</div>
          </section>
        )}
        {!rescheduleError && step === 1 && renderStepOne()}
        {!rescheduleError && step === 2 && renderStepTwo()}
        {!rescheduleError && step === 3 && !isReschedule && renderStepThree()}
        {!rescheduleError && step === 4 && renderStepFour()}
      </main>

      <footer className="ba-footer">
        {step === 1 && (
          <button
            className={`ba-cta ${selectedDoctorIdIsValid ? '' : 'is-disabled'}`}
            onClick={() => selectedDoctorIdIsValid && setStep(isReschedule ? 2 : 2)}
            disabled={!selectedDoctorIdIsValid}
          >
            Next • Pick Time Slot
          </button>
        )}

        {step === 2 && (
          <button
            className={`ba-cta ${selected.slot ? '' : 'is-disabled'}`}
            onClick={() => selected.slot && setStep(isReschedule ? 4 : 3)}
            disabled={!selected.slot}
          >
            {selected.slot ? `Continue with ${selected.slot}` : 'Select a time slot'}
          </button>
        )}

        {step === 3 && !isReschedule && (
          <button
            className="ba-cta"
            onClick={() => {
              const err = validateDetailsStep()
              if (err) {
                setFormError(err)
                toast.error(err)
                return
              }
              setFormError('')
              setStep(4)
            }}
          >
            Review Appointment
          </button>
        )}

        {step === 4 && (
          <button
            className="ba-cta ba-cta-confirm"
            onClick={() => {
              if (!isReschedule) {
                const err = validateDetailsStep()
                if (err) {
                  toast.error(err)
                  return
                }
              }

              if (isReschedule) {
                // Reschedule: only date and slotTime
                bookMutation.mutate({
                  date: selected.date,
                  slotTime: selected.slot
                })
              } else {
                // New booking: full details
                bookMutation.mutate({
                  tenantId: clinic?.id,
                  doctorId: resolvedDoctorId,
                  date: selected.date,
                  slotTime: selected.slot,
                  patientName: form.patientName.trim(),
                  phone: normalizePhone(form.phone),
                  email: form.email ? normalizeEmail(form.email) : '',
                  symptoms: form.symptoms,
                  visitType: form.visitType,
                  patientId: user?.id || null
                })
              }
            }}
            disabled={bookMutation.isPending}
          >
            {bookMutation.isPending ? (isReschedule ? 'Rescheduling...' : 'Booking...') : (isReschedule ? 'Confirm Reschedule' : 'Confirm Appointment')}
          </button>
        )}
      </footer>
    </div>
  )
}
