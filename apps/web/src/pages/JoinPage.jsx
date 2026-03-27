import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import VoiceInput from '../components/VoiceInput'
import { isNonEmptyString, isPhone, normalizePhone } from '../utils/validation'
import './JoinPage.css'

export default function JoinPage() {
  const { subdomain } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    patientName: '',
    phone: '',
    symptoms: '',
    doctorId: '',
    visitType: 'first_visit'
  })
  const [formError, setFormError] = useState('')

  const validateForm = () => {
    if (!isNonEmptyString(form.patientName, 100)) return 'Please enter your full name.'
    if (!isPhone(form.phone)) return 'Please enter a valid phone number.'
    if (!form.doctorId) return 'Please select a doctor.'
    return ''
  }

  const handleJoinQueue = () => {
    const err = validateForm()
    if (err) {
      setFormError(err)
      return
    }

    setFormError('')
    registerMutation.mutate({
      ...form,
      patientName: form.patientName.trim(),
      phone: normalizePhone(form.phone)
    })
  }

  const { data: clinicInfo, isLoading, error } = useQuery({
    queryKey: ['clinic-info', subdomain],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/public/${subdomain}/info`).then(r => r.json())
  })

  const registerMutation = useMutation({
    mutationFn: (data) =>
      fetch(`${import.meta.env.VITE_API_URL}/public/${subdomain}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        alert(data.error)
        return
      }
      navigate(data.trackerUrl)
    }
  })

  if (isLoading) {
    return (
      <div className="jq-state jq-state-loading">
        <div className="jq-spinner" />
        <p>Loading clinic info...</p>
      </div>
    )
  }

  if (error || clinicInfo?.error) {
    return (
      <div className="jq-state jq-state-error">
        <div className="jq-state-icon">❌</div>
        <h2>Clinic not found</h2>
        <p>Check the link and try again.</p>
      </div>
    )
  }

  return (
    <div className="jq-shell">
      <div className="jq-orb jq-orb-left" />
      <div className="jq-orb jq-orb-right" />

      <header className="jq-hero">
        <div className="jq-badge">🏥</div>
        <h1>{clinicInfo?.clinic?.name}</h1>
        <p>Instant walk-in queue registration with live updates.</p>
      </header>

      <main className="jq-card">
        {clinicInfo?.doctors?.length > 0 && (
          <section>
            <p className="jq-label">Available Doctors</p>
            <div className="jq-doctor-list">
              {clinicInfo.doctors.map(doc => {
                const isActive = form.doctorId === doc.id
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setForm({ ...form, doctorId: doc.id })}
                    className={`jq-doctor ${isActive ? 'is-active' : ''}`}
                  >
                    <div>
                      <strong>{doc.name}</strong>
                      <span>{doc.currentQueueCount} patients ahead</span>
                    </div>
                    <div className="jq-doctor-meta">
                      <em>~{doc.estimatedWaitMins} min</em>
                      <small>estimated wait</small>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="jq-form-grid">
          {formError && <div className="jq-error">{formError}</div>}

          <label className="jq-field">
            <span>Your Name *</span>
            <input
              value={form.patientName}
              onChange={e => setForm({ ...form, patientName: e.target.value })}
              placeholder="Full name"
            />
          </label>

          <label className="jq-field">
            <span>WhatsApp Number *</span>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              type="tel"
              placeholder="+91 98765 43210"
            />
            <small>You will receive queue updates on WhatsApp.</small>
          </label>

          <label className="jq-field">
            <span>Describe your symptoms</span>
            <VoiceInput
              onResult={(text) => setForm({ ...form, symptoms: text })}
              placeholder="Tap mic or type your symptoms"
            />
            <textarea
              value={form.symptoms}
              onChange={e => setForm({ ...form, symptoms: e.target.value })}
              rows={3}
              placeholder="e.g. Fever since yesterday, headache, mild cough..."
            />
          </label>

          <div>
            <span className="jq-inline-label">Visit Type</span>
            <div className="jq-visit-row">
              {[
                { value: 'first_visit', label: 'First Visit' },
                { value: 'follow_up', label: 'Follow Up' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, visitType: opt.value })}
                  className={`jq-visit ${form.visitType === opt.value ? 'is-active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleJoinQueue}
            disabled={!form.patientName || !form.phone || !form.doctorId || registerMutation.isPending}
            className="jq-submit"
          >
            {registerMutation.isPending ? 'Joining queue...' : 'Join Queue'}
          </button>

          <p className="jq-footnote">No account needed. You will get a tracking link right away.</p>
        </section>
      </main>
    </div>
  )
}
