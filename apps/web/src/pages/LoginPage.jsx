import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { isEmail, isNonEmptyString, normalizeEmail } from '../utils/validation'
import './LoginPage.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()

    const cleanEmail = normalizeEmail(email)
    if (!isEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!isNonEmptyString(password, 128)) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data } = await api.post('/auth/login', { email: cleanEmail, password })
      await login(data.user, data.accessToken, data.refreshToken)

      const routes = {
        receptionist: '/reception',
        doctor: '/doctor',
        clinic_admin: '/admin',
        super_admin: '/admin'
      }
      navigate(routes[data.user.role] || '/reception', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sl-shell">
      <div className="sl-orb sl-orb-left" />
      <div className="sl-orb sl-orb-right" />

      <div className="sl-card">
        <div className="sl-brand">
          <div className="sl-logo">Q</div>
          <h1>QFlow Staff Login</h1>
          <p>Secure access for reception, doctors, and administrators.</p>
        </div>

        {error && <div className="sl-error">{error}</div>}

        <form onSubmit={handleLogin} className="sl-form">
          <label className="sl-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              required
            />
          </label>

          <label className="sl-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

          <button type="submit" disabled={loading} className="sl-submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="sl-footer-links">
          <button type="button" onClick={() => navigate('/patient/login', { replace: true })}>
            Patient access
          </button>
          <button type="button" onClick={() => navigate('/join/demo')}>
            Quick queue join
          </button>
        </div>
      </div>
    </div>
  )
}
