import { useMemo, useState } from 'react'
import api from '../services/api'
import { registerPushToken } from '../services/push'

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null
  } catch (_err) {
    return value
  }
}

export default function PushDebugPage() {
  const [registerResult, setRegisterResult] = useState(null)
  const [serverResult, setServerResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const localDebug = useMemo(() => {
    const pushStatus = parseJson(localStorage.getItem('qflow_push_last_status'))
    const loginStatus = parseJson(localStorage.getItem('qflow_push_login_result'))
    const user = parseJson(localStorage.getItem('qflow_user'))
    const token = localStorage.getItem('qflow_token')

    return {
      pushStatus,
      loginStatus,
      hasUser: Boolean(user?.id),
      userId: user?.id || null,
      hasAccessToken: Boolean(token),
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      host: typeof window !== 'undefined' ? window.location.host : ''
    }
  }, [registerResult, serverResult])

  const triggerRegister = async () => {
    setLoading(true)
    try {
      const result = await registerPushToken()
      setRegisterResult(result)
    } catch (err) {
      setRegisterResult({ success: false, error: err?.response?.data || err?.message || 'unknown' })
    } finally {
      setLoading(false)
    }
  }

  const checkServer = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/push/me')
      setServerResult(data)
    } catch (err) {
      setServerResult({ success: false, error: err?.response?.data || err?.message || 'unknown' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 16 }}>
      <h2>Push Debug</h2>
      <p>Use this page on your phone after login to confirm token registration.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" onClick={triggerRegister} disabled={loading}>
          Register Push Token Now
        </button>
        <button type="button" onClick={checkServer} disabled={loading}>
          Check Server Token Count
        </button>
      </div>

      <h3>Client Status</h3>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(localDebug, null, 2)}
      </pre>

      <h3>Register Result</h3>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(registerResult, null, 2)}
      </pre>

      <h3>Server Result (/api/push/me)</h3>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(serverResult, null, 2)}
      </pre>
    </div>
  )
}
