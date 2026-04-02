import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import {
  getStrongPasswordMessage,
  isEmail,
  isNonEmptyString,
  isPhone,
  isStrongPassword,
  normalizeEmail,
  normalizePhone
} from '../utils/validation'
import './PatientLoginPage.css'

export default function PatientLoginPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', gender: '', dob: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    const cleanEmail = normalizeEmail(form.email)
    const cleanPhone = normalizePhone(form.phone)

    if (!isEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!isNonEmptyString(form.password, 128)) {
      setError('Password is required.')
      return
    }

    if (mode === 'register') {
      if (!isNonEmptyString(form.name, 100)) {
        setError('Full name is required.')
        return
      }
      if (!isPhone(cleanPhone)) {
        setError('Please enter a valid phone number.')
        return
      }
      if (!isStrongPassword(form.password)) {
        setError(getStrongPasswordMessage())
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const { data } = await api.post('/auth/login', {
          email: cleanEmail,
          password: form.password
        })
        login(data.user, data.accessToken, data.refreshToken)
        navigate('/patient/dashboard', { replace: true })
      } else {
        const { data } = await api.post('/auth/register-patient', {
          name: form.name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          password: form.password,
          gender: form.gender,
          dateOfBirth: form.dob
        })
        login(data.user, data.accessToken, data.refreshToken)
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pl-shell">
      <div className="pl-orb pl-orb-left" />
      <div className="pl-orb pl-orb-right" />

      <div className="pl-card">
        <header className="pl-header">
          <div className="pl-logo">Q</div>
          <h1>QFlow Patient Access</h1>
          <p>Sign in to manage bookings and track upcoming visits.</p>
        </header>

        <div className="pl-toggle" role="tablist" aria-label="Login mode">
          {['login', 'register'].map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`pl-toggle-btn ${mode === m ? 'is-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {error && <div className="pl-error">{error}</div>}

        <div className="pl-form">
          {mode === 'register' && (
            <>
              <label className="pl-field">
                <span>Full Name *</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </label>

              <label className="pl-field">
                <span>WhatsApp Number *</span>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" type="tel" />
              </label>

              <div>
                <span className="pl-inline-label">Gender</span>
                <div className="pl-gender-row">
                  {['Male', 'Female', 'Other'].map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`pl-gender ${form.gender === g ? 'is-active' : ''}`}
                      onClick={() => setForm({ ...form, gender: g })}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <label className="pl-field">
                <span>Date of Birth (optional)</span>
                <input value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} type="date" />
              </label>
            </>
          )}

          <label className="pl-field">
            <span>Email *</span>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" type="email" />
          </label>

          <label className="pl-field">
            <span>Password *</span>
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" type="password" />
          </label>

          <button type="button" className="pl-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <p className="pl-footnote">
          Prefer browsing first?
          <button type="button" onClick={() => navigate('/')}> Find clinics</button>
        </p>

        <p className="pl-footnote pl-footnote-alt">
          Clinic staff or admin?
          <button type="button" onClick={() => navigate('/login', { replace: true })}> Staff login</button>
        </p>
      </div>
    </div>
  )
}
