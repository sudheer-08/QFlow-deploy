import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import VoiceInput from '../components/VoiceInput'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'

export default function BookAppointmentPage() {
  const { subdomain } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const preselectedDoctor = searchParams.get('doctor')

  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState({
    doctorId: preselectedDoctor || '',
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    slot: '',
    fee: 0
  })
  const [form, setForm] = useState({
    patientName: '', phone: '', email: '', symptoms: '', visitType: 'first_visit'
  })
  const [booking, setBooking] = useState(null)

  // Get clinic info
  const { data: clinic } = useQuery({
    queryKey: ['clinic', subdomain],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics/${subdomain}`).then(r => r.json())
  })

  // When clinic loads, resolve the preselected doctor's name and fee
  useEffect(() => {
    if (clinic?.doctors && preselectedDoctor && !selected.doctorName) {
      const doc = clinic.doctors.find(d => d.id === preselectedDoctor)
      if (doc) {
        setSelected(prev => ({ ...prev, doctorId: doc.id, doctorName: doc.name, fee: doc.consultationFee || 300 }))
      }
    }
  }, [clinic, preselectedDoctor])

  // ✅ Auto-fill form if patient is logged in
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

  // Get slots for selected doctor + date
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', selected.doctorId, selected.date],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/appointments/slots?doctorId=${selected.doctorId}&date=${selected.date}`)
        .then(r => r.json()),
    enabled: !!selected.doctorId && !!selected.date && step >= 2
  })

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: (data) =>
      fetch(`${import.meta.env.VITE_API_URL}/appointments/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return }
      toast.success('Appointment booked successfully! 🎉')
      setBooking(data)
      navigate('/payment', { state: data })
    },
    onError: () => toast.error('Booking failed. Please try again.')
  })

  // Generate next 7 days
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    }
  })

  const morningSlots = slotsData?.slots?.filter(s => {
    const [h] = s.time.split(':').map(Number)
    return h < 13
  }) || []
  const eveningSlots = slotsData?.slots?.filter(s => {
    const [h] = s.time.split(':').map(Number)
    return h >= 13
  }) || []

  // Step 5 — Success
  if (step === 5 && booking) return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Appointment Booked!</h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>Check your WhatsApp for confirmation</p>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['🏥 Clinic', booking.clinicName],
              ['👨‍⚕️ Doctor', booking.doctorName],
              ['📅 Date', new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
              ['⏰ Time', booking.slotTime],
              ['💰 Fee', `₹${booking.consultationFee}`],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => navigate(`/track-appointment/${booking.trackerToken}`)}
          style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          Track My Appointment →
        </button>
        <button
          onClick={() => navigate('/')}
          style={{ width: '100%', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 90 }}>

      {/* Header */}
      <div style={{ background: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(`/clinic/${subdomain}`)}
          style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Book Appointment</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{clinic?.name}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: step >= s ? '#2563eb' : '#e2e8f0' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Step 1 — Pick doctor + date */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Choose Doctor & Date</h2>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Select Doctor</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(clinic?.doctors || []).map(doc => (
                <div key={doc.id} onClick={() => setSelected({ ...selected, doctorId: doc.id, doctorName: doc.name, fee: doc.consultationFee || 300 })}
                  style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: `2px solid ${selected.doctorId === doc.id ? '#2563eb' : '#e2e8f0'}`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👨‍⚕️</div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 2px', color: '#0f172a' }}>{doc.name}</p>
                        <p style={{ fontSize: 12, color: '#2563eb', margin: 0 }}>{doc.specialization}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: '0 0 2px' }}>₹{doc.consultationFee || 300}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{doc.queueCount || 0} waiting</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Select Date</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {next7Days.map(day => (
                <button key={day.value} onClick={() => setSelected({ ...selected, date: day.value })}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `2px solid ${selected.date === day.value ? '#2563eb' : '#e2e8f0'}`, background: selected.date === day.value ? '#eff6ff' : 'white', color: selected.date === day.value ? '#2563eb' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Pick slot */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Pick a Time Slot</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{selected.doctorName} · {new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                <div>Loading available slots...</div>
              </div>
            ) : slotsData?.error ? (
              <div style={{ textAlign: 'center', padding: 40, background: '#fef2f2', borderRadius: 12, color: '#dc2626' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                <div style={{ fontWeight: 600 }}>Could not load slots</div>
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{slotsData.error}</div>
              </div>
            ) : morningSlots.length === 0 && eveningSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12, color: '#64748b' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 4 }}>No slots available</div>
                <div style={{ fontSize: 13 }}>Try selecting a different date.</div>
                <button onClick={() => setStep(1)}
                  style={{ marginTop: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  ← Change Date
                </button>
              </div>
            ) : (
              <>
                {morningSlots.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>🌅 Morning</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {morningSlots.map(slot => (
                        <button key={slot.time}
                          onClick={() => slot.available && setSelected({ ...selected, slot: slot.time, fee: slot.consultationFee })}
                          disabled={!slot.available}
                          style={{ padding: '10px 4px', borderRadius: 10, border: `2px solid ${selected.slot === slot.time ? '#2563eb' : slot.available ? '#e2e8f0' : '#f1f5f9'}`, background: selected.slot === slot.time ? '#eff6ff' : slot.available ? 'white' : '#f8fafc', color: selected.slot === slot.time ? '#2563eb' : slot.available ? '#0f172a' : '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: slot.available ? 'pointer' : 'not-allowed', textDecoration: slot.available ? 'none' : 'line-through' }}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {eveningSlots.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>🌆 Evening</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {eveningSlots.map(slot => (
                        <button key={slot.time}
                          onClick={() => slot.available && setSelected({ ...selected, slot: slot.time, fee: slot.consultationFee })}
                          disabled={!slot.available}
                          style={{ padding: '10px 4px', borderRadius: 10, border: `2px solid ${selected.slot === slot.time ? '#2563eb' : slot.available ? '#e2e8f0' : '#f1f5f9'}`, background: selected.slot === slot.time ? '#eff6ff' : slot.available ? 'white' : '#f8fafc', color: selected.slot === slot.time ? '#2563eb' : slot.available ? '#0f172a' : '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: slot.available ? 'pointer' : 'not-allowed', textDecoration: slot.available ? 'none' : 'line-through' }}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3 — Patient details */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Your Details</h2>
            {/* ✅ Show logged in banner if patient is logged in */}
            {user?.role === 'patient' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d' }}>
                ✅ Logged in as <strong>{user.name}</strong> — details auto-filled
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'patientName', label: 'Full Name *', type: 'text', placeholder: 'Your full name' },
                { key: 'phone', label: 'WhatsApp Number *', type: 'tel', placeholder: '+91 98765 43210' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'you@email.com' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <input value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} type={field.type}
                    placeholder={field.placeholder}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Symptoms / Reason for Visit</label>
                <VoiceInput
                  onResult={(text) => setForm({ ...form, symptoms: text })}
                  placeholder="Tap mic or type symptoms"
                />
                <textarea value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} rows={3}
                  placeholder="e.g. Toothache, cavity, cleaning..."
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', marginTop: 8 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Visit Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['first_visit', 'First Visit'], ['follow_up', 'Follow Up']].map(([val, label]) => (
                    <button key={val} onClick={() => setForm({ ...form, visitType: val })}
                      style={{ flex: 1, padding: '10px', border: `2px solid ${form.visitType === val ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: form.visitType === val ? '#eff6ff' : 'white', color: form.visitType === val ? '#2563eb' : '#64748b' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Confirm */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Confirm Appointment</h2>
            <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['🏥 Clinic', clinic?.name],
                  ['👨‍⚕️ Doctor', selected.doctorName],
                  ['📅 Date', new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
                  ['⏰ Time', selected.slot],
                  ['👤 Patient', form.patientName],
                  ['📱 WhatsApp', form.phone],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Consultation Fee</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#2563eb' }}>₹{selected.fee || 300}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 12, fontSize: 12, color: '#92400e' }}>
              💡 Fee is paid at the clinic. Your slot is confirmed once you click below.
            </div>
          </div>
        )}

      </div>

      {/* Bottom CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0', zIndex: 600 }}>
        {step === 1 && (
          <button onClick={() => selected.doctorId && setStep(2)} disabled={!selected.doctorId}
            style={{ width: '100%', background: selected.doctorId ? '#2563eb' : '#e2e8f0', color: selected.doctorId ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: selected.doctorId ? 'pointer' : 'not-allowed' }}>
            Next → Pick Time Slot
          </button>
        )}
        {step === 2 && (
          <button onClick={() => selected.slot && setStep(3)} disabled={!selected.slot}
            style={{ width: '100%', background: selected.slot ? '#2563eb' : '#e2e8f0', color: selected.slot ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: selected.slot ? 'pointer' : 'not-allowed' }}>
            {selected.slot ? `Continue with ${selected.slot}` : 'Select a time slot'}
          </button>
        )}
        {step === 3 && (
          <button onClick={() => form.patientName && form.phone && setStep(4)} disabled={!form.patientName || !form.phone}
            style={{ width: '100%', background: form.patientName && form.phone ? '#2563eb' : '#e2e8f0', color: form.patientName && form.phone ? 'white' : '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Review Appointment →
          </button>
        )}
        {step === 4 && (
          <button
            onClick={() => bookMutation.mutate({
              tenantId: clinic?.id,
              doctorId: selected.doctorId,
              date: selected.date,
              slotTime: selected.slot,
              ...form,
              patientId: user?.id || null  // ✅ links to logged-in patient automatically
            })}
            disabled={bookMutation.isPending}
            style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {bookMutation.isPending ? 'Booking...' : '✅ Confirm Appointment'}
          </button>
        )}
      </div>
    </div>
  )
}
