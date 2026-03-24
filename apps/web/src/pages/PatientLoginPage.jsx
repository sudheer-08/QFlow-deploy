import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function PatientLoginPage() {
  const [mode, setMode] = useState('login') // login | register
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', gender: '', dob: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { data } = await api.post('/auth/login', {
          email: form.email,
          password: form.password
        })
        login(data.user, data.accessToken, data.refreshToken)
        navigate('/patient/dashboard')
      } else {
        // Register as patient
        const { data } = await api.post('/auth/register-patient', {
          name: form.name,
          phone: form.phone,
          email: form.email,
          password: form.password,
          gender: form.gender,
          dateOfBirth: form.dob
        })
        login(data.user, data.accessToken, data.refreshToken)
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '40px 20px 30px', textAlign: 'center', color: 'white' }}>
        <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🦷</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>QFlow Patient</h1>
        <p style={{ fontSize: 13, color: '#bfdbfe', margin: 0 }}>Skip the waiting room</p>
      </div>

      {/* Toggle */}
      <div style={{ background: 'white', margin: '16px', borderRadius: 12, padding: 4, display: 'flex', border: '1px solid #e2e8f0' }}>
        {['login', 'register'].map(m => (
          <button key={m}
            onClick={() => setMode(m)}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: mode === m ? '#2563eb' : 'transparent', color: mode === m ? 'white' : '#64748b', transition: 'all 0.2s' }}
          >
            {m === 'login' ? 'Sign In' : 'Register'}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{ margin: '0 16px', background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Your full name" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>WhatsApp Number *</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="+91 98765 43210" type="tel" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Gender</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} onClick={() => setForm({...form, gender: g})}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${form.gender === g ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: form.gender === g ? '#eff6ff' : 'white', color: form.gender === g ? '#2563eb' : '#64748b' }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email *</label>
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="you@email.com" type="email" />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Password *</label>
            <input value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="••••••••" type="password" />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', background: loading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
        Just browsing?{' '}
        <span onClick={() => navigate('/')} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
          Find clinics without signing in →
        </span>
      </p>
    </div>
  )
}
