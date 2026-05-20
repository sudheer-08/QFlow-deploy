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
const normalizeDoctorName = (value) => normalizeText(value)
  .replace(/\./g, '')
  .replace(/^dr\s+/i, '')
  .replace(/^doctor\s+/i, '')
  .replace(/\s+/g, ' ')

const matchesDoctorParam = (doctor, rawDoctorParam) => {
  if (!doctor || !rawDoctorParam) return false
  const candidates = [doctor.id, doctor.doctorId, doctor.doctor_id, doctor.userId, doctor.user_id]
  const cleanParam = normalizeText(rawDoctorParam)
  if (candidates.some(v => normalizeText(v) === cleanParam)) {
    return true
  }
  const normalizedDoc = normalizeDoctorName(doctor.name)
  const normalizedParam = normalizeDoctorName(rawDoctorParam)
  return normalizedDoc === normalizedParam || normalizedDoc.includes(normalizedParam) || normalizedParam.includes(normalizedDoc)
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

const VISIT_TYPES = [
  { key: 'new', label: 'First visit / New problem', description: 'For new patients or a new health concern.' },
  { key: 'followup', label: 'Follow-up visit', description: 'For reviewing progress on a previous issue.' },
  { key: 'prescription', label: 'Prescription renewal only', description: 'A quick visit just to renew medication.' },
  { key: 'report_review', label: 'Review my test results', description: 'To discuss recent lab or imaging results.' },
  { key: 'procedure', label: 'A procedure or treatment', description: 'For planned treatments like dressings, etc.' },
];

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

  const [step, setStep] = useState(0) // Start at step 0 for visit type
  const [selected, setSelected] = useState({
    visitType: '', // new, followup, etc.
    doctorId: '',
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    slot: '',
    fee: 0
  })
  const [form, setForm] = useState({
    patientName: '', phone: '', email: '', symptoms: '',
    bookingFor: 'self', // 'self' or 'other'
    familyName: '',
    familyRelation: ''
  })
  const [formError, setFormError] = useState('')
  const [booking, setBooking] = useState(null)
  const [oldAppointment, setOldAppointment] = useState(null)
  const [rescheduleError, setRescheduleError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const safeSubdomain = subdomain && subdomain !== 'undefined' ? subdomain : ''
  const resolvedSubdomain = safeSubdomain || oldAppointment?.tenants?.subdomain || ''

  const validateDetailsStep = () => {
    const isBookingForOther = form.bookingFor === 'other';
    const patientName = isBookingForOther ? form.familyName : form.patientName;
    const cleanName = patientName.trim();
    const cleanPhone = normalizePhone(form.phone);
    const cleanEmail = form.email ? normalizeEmail(form.email) : '';

    if (!isNonEmptyString(cleanName, 100)) return `Please enter the patient's full name.`;
    if (isBookingForOther && !isNonEmptyString(form.familyRelation, 50)) return `Please specify the relationship to the patient.`;
    if (!isPhone(cleanPhone)) return 'Please enter a valid contact phone number.';
    if (form.email && !isEmail(cleanEmail)) return 'Please enter a valid email address.';
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
    if (hasValidDoctorId(selected.doctorId)) return

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
  }, [clinic, preselectedDoctor, selected.doctorId, selected.doctorName])

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

  const { data: durationStats } = useQuery({
    queryKey: ['durationStats', resolvedDoctorId, selected.visitType],
    queryFn: () => 
      fetch(`${import.meta.env.VITE_API_URL}/doctors/${resolvedDoctorId}/durations?visitType=${selected.visitType}`)
      .then(r => r.json()),
    enabled: !!resolvedDoctorId && !!selected.visitType && step === 1,
  });

  // ... existing useEffects ...

  useEffect(() => {
    if (step >= 1 && !selected.visitType) {
      setStep(0);
      toast.error('Please select a visit type first.');
    }
    if (step >= 2 && !selectedDoctorIdIsValid) {
      setStep(1);
      setSelected(prev => ({ ...prev, slot: '' }));
      toast.error('Please select a doctor before choosing a time slot.');
    }
  }, [step, selected.visitType, selectedDoctorIdIsValid, toast]);

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
      const params = new URLSearchParams({
        date: selected.date,
        ...(hasValidDoctorId(resolvedDoctorId) ? { doctorId: resolvedDoctorId } : {}),
        ...(selected.doctorName ? { doctorName: selected.doctorName } : {}),
        ...(resolvedSubdomain ? { subdomain: resolvedSubdomain } : {})
      })
      const response = await fetch(`${import.meta.env.VITE_API_URL}/appointments/slots?${params.toString()}`)
      return response.json()
    },
    enabled: !!selected.date && step >= 2 && (selectedDoctorIdIsValid || !!selected.doctorName)
  })

  useEffect(() => {
    if (slotsUpdatedAt) {
      setLastUpdatedAt(new Date(slotsUpdatedAt))
    }
  }, [slotsUpdatedAt])

  const bookMutation = useMutation({
    mutationFn: async () => {
      const clinicId = clinic?.id
      const doctorId = resolvedDoctorId
      const selectedSlot = null
      const bookingData = {
        clinic_id: clinicId,
        doctor_id: doctorId,
        appointment_time: new Date(selected.date).toISOString(),
        patient_name: form.bookingFor === 'other' ? form.familyName : form.patientName,
        patient_phone: normalizePhone(form.phone),
        patient_email: form.email ? normalizeEmail(form.email) : null,
        symptoms: form.symptoms,
        visit_type: form.visitType,
        booked_by_patient_id: user?.id,
        booking_for: form.bookingFor,
        family_member_name: form.bookingFor === 'other' ? form.familyName : null,
        family_member_relation: form.bookingFor === 'other' ? form.familyRelation : null
      }

      const { data, error } = await supabase
        .post('/api/appointments/book', bookingData, {
          headers: { 'Content-Type': 'application/json' }
        })

      return data
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
['Time', `~${booking.estimatedTime}`], // Show ETA
          ['Fee', `₹${booking.consultationFee}`]
        ].map(([label, value]) => (
          <div key={label} className="ba-summary-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="ba-note">Your appointment time is an estimate. Please track the live queue for updates.</div>

          <button className="ba-success-primary" onClick={() => navigate(`/track/${booking.appointmentId}`)}>
            Track My Appointment
          </button>
          <button className="ba-success-secondary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const renderStepZero = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>What is the reason for your visit?</h2>
        <p>This helps us estimate your consultation time accurately.</p>
      </div>
      <div className="ba-visit-type-grid">
        {VISIT_TYPES.map(vt => (
          <button
            key={vt.key}
            type="button"
            className={`ba-visit-type-card ${selected.visitType === vt.key ? 'is-active' : ''}`}
            onClick={() => setSelected(prev => ({ ...prev, visitType: vt.key }))}
          >
            <strong>{vt.label}</strong>
            <span>{vt.description}</span>
          </button>
        ))}
      </div>
    </section>
  )

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

  

  

  const renderStepThree = () => (
    <section className="ba-step-card">
      <div className="ba-step-head">
        <h2>Your Details</h2>
        <p>This information will be used for the appointment.</p>
      </div>

      {formError && <div className="ba-error">{formError}</div>}
      
      <div className="ba-label">Who is this appointment for?</div>
      <div className="ba-radio-group">
        <button
          className={`ba-radio-btn ${form.bookingFor === 'self' ? 'is-active' : ''}`}
          onClick={() => setForm(prev => ({ ...prev, bookingFor: 'self' }))}
        >
          Myself
        </button>
        <button
          className={`ba-radio-btn ${form.bookingFor === 'other' ? 'is-active' : ''}`}
          onClick={() => setForm(prev => ({ ...prev, bookingFor: 'other' }))}
        >
          Someone Else
        </button>
      </div>

      {form.bookingFor === 'self' && user?.role === 'patient' && (
        <div className="ba-ok">Logged in as <strong>{user.name}</strong>. Details auto-filled.</div>
      )}

      <div className="ba-form-grid">
        {form.bookingFor === 'other' && (
          <>
            <label className="ba-field">
              <span>Patient's Full Name *</span>
              <input
                value={form.familyName}
                onChange={e => setForm({ ...form, familyName: e.target.value })}
                type="text"
                placeholder="e.g. John Doe"
              />
            </label>
            <label className="ba-field">
              <span>Relationship to You *</span>
              <input
                value={form.familyRelation}
                onChange={e => setForm({ ...form, familyRelation: e.target.value })}
                type="text"
                placeholder="e.g. Spouse, Child, Parent"
              />
            </label>
          </>
        )}

        {form.bookingFor === 'self' && (
          <label className="ba-field">
            <span>Your Full Name *</span>
            <input
              value={form.patientName}
              onChange={e => setForm({ ...form, patientName: e.target.value })}
              type="text"
              placeholder="Your full name"
            />
          </label>
        )}

        <label className="ba-field">
          <span>Contact WhatsApp Number *</span>
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            type="tel"
            placeholder="+91 98765 43210"
          />
        </label>
        
        <label className="ba-field">
          <span>Contact Email</span>
          <input
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            type="email"
            placeholder="you@email.com"
          />
        </label>

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
          ['Time', 'Will be assigned automatically'],
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
        <div className="ba-note">Fee is paid at the clinic. Slot will be reviewed and confirmed by the clinic.</div>
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
          {[0, 1, 2, isReschedule ? 4 : 3, 4].map((stepNum, idx) => {
            const displayNum = idx + 1
            const isOn = isReschedule 
              ? (stepNum === 0 && step >= 0) || (stepNum === 1 && step >= 1) || (stepNum === 2 && step >= 2) || (stepNum === 4 && step >= 4)
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
        {!rescheduleError && step === 0 && renderStepZero()}
        {!rescheduleError && step === 1 && renderStepOne()}
        
        {!rescheduleError && step === 3 && !isReschedule && renderStepThree()}
        {!rescheduleError && step === 4 && renderStepFour()}
      </main>

      <footer className="ba-footer">
        {step === 0 && (
          <button
            className={`ba-cta ${selected.visitType ? '' : 'is-disabled'}`}
            onClick={() => selected.visitType && setStep(1)}
            disabled={!selected.visitType}
          >
            Next • Choose Doctor & Date
          </button>
        )}

        {step === 1 && (
          <button
            className={`ba-cta ${selectedDoctorIdIsValid ? '' : 'is-disabled'}`}
              onClick={() => {
                if (!selectedDoctorIdIsValid) return
                if (!hasValidDoctorId(selected.doctorId) && hasValidDoctorId(resolvedDoctorId)) {
                  setSelected(prev => ({ ...prev, doctorId: resolvedDoctorId }))
                }
                setStep(3)
              }}
            disabled={!selectedDoctorIdIsValid}
          >
            Next • Pick Time Slot
          </button>
        )}

        
              } else {
                // New booking: full details
                bookMutation.mutate({
                  tenantId: clinic?.id,
                  doctorId: resolvedDoctorId,
                  date: selected.date,
                  slotTime: null,
                  visitType: selected.visitType, // Pass visitType
                  patientName: form.patientName.trim(),
                  phone: normalizePhone(form.phone),
                  email: form.email ? normalizeEmail(form.email) : '',
                  symptoms: form.symptoms,
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

