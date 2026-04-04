import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import socket, { connectClinic } from '../socket'
import { useToast } from '../components/Toast'
import {
  Users, Clock, Stethoscope, CheckCircle2, Smartphone,
  LogOut, Wifi, WifiOff, RefreshCw,
  UserPlus, AlertTriangle, Inbox, List
} from 'lucide-react'

export default function ReceptionPage() {
  const { user, logout } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected)
  const [form, setForm] = useState({
    patientName: '', phone: '', symptoms: '',
    doctorId: '', isEmergency: false
  })
  const [registered, setRegistered] = useState(null)
  const [arrivedAlert, setArrivedAlert] = useState(null)
  const [noShowLoading, setNoShowLoading] = useState({})

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => api.get('/doctors').then(r => r.data)
  })

  const {
    data: queue = [],
    isFetching: isQueueFetching,
    dataUpdatedAt: queueUpdatedAt
  } = useQuery({
    queryKey: ['queue-live'],
    queryFn: () => api.get('/queue/live').then(r => r.data),
    refetchInterval: 30000
  })

  const {
    data: summary,
    isFetching: isSummaryFetching,
    dataUpdatedAt: summaryUpdatedAt
  } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api.get('/analytics/summary/today').then(r => r.data),
    refetchInterval: 30000
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/queue/register', data),
    onSuccess: (res) => {
      setRegistered(res.data)
      setForm({ patientName: '', phone: '', symptoms: '', doctorId: '', isEmergency: false })
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    }
  })

  useEffect(() => {
    connectClinic(user.tenantId, user.id, user.role)

    const handleSocketConnect = () => setIsSocketConnected(true)
    const handleSocketDisconnect = () => setIsSocketConnected(false)

    socket.on('connect', handleSocketConnect)
    socket.on('disconnect', handleSocketDisconnect)
    socket.on('queue:patient_added', () => {
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    })
    socket.on('queue:token_called', () => queryClient.invalidateQueries(['queue-live']))
    socket.on('queue:entry_completed', () => {
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    })
    socket.on('queue:no_show', () => queryClient.invalidateQueries(['queue-live']))
    socket.on('patient:arrived', (data) => {
      setArrivedAlert(`${data.patientName} (${data.token}) has arrived at the clinic!`)
      setTimeout(() => setArrivedAlert(null), 5000)
      queryClient.invalidateQueries(['queue-live'])
    })
    return () => {
      socket.off('connect', handleSocketConnect)
      socket.off('disconnect', handleSocketDisconnect)
      socket.off('queue:patient_added')
      socket.off('queue:token_called')
      socket.off('queue:entry_completed')
      socket.off('queue:no_show')
      socket.off('patient:arrived')
    }
  }, [])

  const latestSyncAt = Math.max(summaryUpdatedAt || 0, queueUpdatedAt || 0)
  const lastSyncLabel = latestSyncAt
    ? new Date(latestSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Not synced yet'
  const dataAgeSeconds = latestSyncAt ? Math.max(0, Math.floor((now - latestSyncAt) / 1000)) : null

  const syncState = !isOnline
    ? { label: 'Offline', cls: 'qf-sync-offline', Icon: WifiOff }
    : (!isSocketConnected || isQueueFetching || isSummaryFetching)
      ? { label: 'Reconnecting', cls: 'qf-sync-reconnecting', Icon: RefreshCw }
      : { label: 'Connected', cls: 'qf-sync-connected', Icon: Wifi }

  const markNoShow = async (entryId) => {
    setNoShowLoading(p => ({ ...p, [entryId]: true }))
    try {
      await api.patch(`/no-show/queue/${entryId}/no-show`)
      toast.success('Marked as no-show, patient notified')
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    } catch {
      toast.error('Failed to mark no-show')
    } finally {
      setNoShowLoading(p => ({ ...p, [entryId]: false }))
    }
  }

  const priorityConfig = {
    critical: { cls: 'priority-critical', label: '🔴 Critical', badge: 'qf-badge-red' },
    moderate: { cls: 'priority-moderate', label: '🟡 Moderate', badge: 'qf-badge-amber' },
    routine:  { cls: 'priority-routine',  label: '🟢 Routine',  badge: 'qf-badge-green' }
  }

  const statusConfig = {
    waiting:     { badge: 'qf-badge-blue',   label: 'Waiting' },
    called:      { badge: 'qf-badge-amber',  label: 'Called' },
    in_progress: { badge: 'qf-badge-purple', label: 'In Progress' },
    done:        { badge: 'qf-badge-green',  label: 'Done' }
  }

  const stats = [
    { label: 'Total Today', value: summary?.total || 0, Icon: Users, bg: 'linear-gradient(135deg, #1e293b, #334155)' },
    { label: 'Waiting', value: summary?.waiting || 0, Icon: Clock, bg: 'linear-gradient(135deg, #1452ff, #3b82f6)' },
    { label: 'In Progress', value: summary?.inProgress || 0, Icon: Stethoscope, bg: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
    { label: 'Done', value: summary?.done || 0, Icon: CheckCircle2, bg: 'linear-gradient(135deg, #059669, #10b981)' },
    { label: 'Remote', value: summary?.remote || 0, Icon: Smartphone, bg: 'linear-gradient(135deg, #4338ca, #6366f1)' },
  ]

  return (
    <div className="qf-staff-shell">
      {/* Header */}
      <header className="qf-staff-header">
        <div className="qf-staff-brand">
          <div className="qf-staff-logo">Q</div>
          <div>
            <div className="qf-staff-title">QFlow Reception</div>
            <div className="qf-staff-subtitle">{user?.clinicName}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/reception/bookings" className="qf-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Inbox size={14} /> Bookings
            </Link>
            <Link to="/reception/waitlist" className="qf-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <List size={14} /> Waitlist
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className={`qf-sync-badge ${syncState.cls}`}>
              <syncState.Icon size={12} /> {syncState.label}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--ui-text-3)' }}>
              {lastSyncLabel} · {dataAgeSeconds !== null ? `${dataAgeSeconds}s` : 'n/a'}
            </span>
          </div>
          <button onClick={logout} className="qf-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Arrived alert */}
      {arrivedAlert && (
        <div style={{
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff', textAlign: 'center', padding: '12px 20px',
          fontWeight: 700, fontSize: '0.88rem',
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          ✅ {arrivedAlert}
        </div>
      )}

      <div className="qf-staff-body" style={{ display: 'grid', gap: 20 }}>

        {/* Stats */}
        <div className="qf-stat-grid qf-stagger">
          {stats.map(s => (
            <div key={s.label} className="qf-stat-card" style={{ background: s.bg, color: '#fff' }}>
              <span className="qf-stat-icon"><s.Icon size={20} /></span>
              <span className="qf-stat-value">{s.value}</span>
              <span className="qf-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="lg:grid-cols-3">

          {/* Registration form */}
          <div className="qf-content-card lg:col-span-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <UserPlus size={18} style={{ color: 'var(--ui-primary)' }} />
              <h2 style={{ margin: 0 }}>Register Walk-in Patient</h2>
            </div>

            {registered && (
              <div style={{
                borderRadius: 14, border: '1px solid #a5eacc',
                background: 'linear-gradient(165deg, #f0fdf4, #dcfce7)',
                padding: 16, marginBottom: 16
              }}>
                <p style={{ fontWeight: 800, color: '#065f46', fontSize: '1.1rem', margin: 0 }}>
                  Token: {registered.token}
                </p>
                <p style={{ color: '#0d8c63', fontSize: '0.82rem', marginTop: 4 }}>
                  Priority: {registered.priority}
                </p>
                {registered.aiSummary && (
                  <p style={{ color: '#059669', fontSize: '0.75rem', marginTop: 4 }}>
                    AI: {registered.aiSummary}
                  </p>
                )}
                <button onClick={() => setRegistered(null)} className="qf-btn-ghost" style={{ marginTop: 8, fontSize: '0.78rem', color: '#059669' }}>
                  Register another
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label className="qf-label">Patient Name *</label>
                <input
                  value={form.patientName}
                  onChange={e => setForm({ ...form, patientName: e.target.value })}
                  className="qf-input"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="qf-label">Phone (WhatsApp)</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="qf-input"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="qf-label">Symptoms</label>
                <textarea
                  value={form.symptoms}
                  onChange={e => setForm({ ...form, symptoms: e.target.value })}
                  className="qf-input"
                  rows={3}
                  placeholder="Describe symptoms..."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="qf-label">Doctor</label>
                <select
                  value={form.doctorId}
                  onChange={e => setForm({ ...form, doctorId: e.target.value })}
                  className="qf-input"
                >
                  <option value="">Select doctor...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isEmergency}
                  onChange={e => setForm({ ...form, isEmergency: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#be2845' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#be2845', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={14} /> Mark as Emergency
                </span>
              </label>
              <button
                onClick={() => registerMutation.mutate(form)}
                disabled={!form.patientName || !form.doctorId || registerMutation.isPending}
                className="qf-btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: '0.9rem' }}
              >
                {registerMutation.isPending ? 'Registering...' : 'Generate Token'}
              </button>
            </div>
          </div>

          {/* Live Queue */}
          <div className="qf-content-card lg:col-span-2">
            <div className="qf-section-head">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Live Queue
                <span className="qf-badge qf-badge-blue">{queue.length}</span>
              </h2>
              <Link to="/reception/waitlist" className="qf-btn-secondary" style={{ fontSize: '0.78rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📋 Waitlist
              </Link>
            </div>

            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ui-text-3)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>🏥</div>
                <p>Queue is empty</p>
              </div>
            ) : (
              <div className="qf-scroll" style={{ display: 'grid', gap: 10, maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                {queue.map((entry) => {
                  const pCfg = priorityConfig[entry.priority] || priorityConfig.routine
                  const sCfg = statusConfig[entry.status] || statusConfig.waiting
                  return (
                    <div key={entry.id} className={`qf-queue-card ${pCfg.cls}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ textAlign: 'center', minWidth: 56 }}>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'var(--ui-primary)' }}>
                              {entry.token_number}
                            </div>
                            <span className={`qf-badge ${pCfg.badge}`} style={{ marginTop: 4 }}>{entry.priority}</span>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--ui-text-1)' }}>{entry.users?.name}</p>
                            {entry.symptoms && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--ui-text-2)' }}>
                                {entry.symptoms.substring(0, 50)}
                              </p>
                            )}
                            {entry.ai_summary && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#5b4cdb' }}>
                                🤖 {entry.ai_summary}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                              <span className={`qf-badge ${sCfg.badge}`}>{sCfg.label}</span>
                              {entry.registration_type === 'self_registered' && (
                                <span className="qf-badge qf-badge-indigo">📱 Remote</span>
                              )}
                              {entry.arrival_status === 'at_home' && (
                                <span className="qf-badge qf-badge-amber">🏠 At home</span>
                              )}
                              {entry.arrival_status === 'arrived' && (
                                <span className="qf-badge qf-badge-green">✅ Arrived</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--ui-text-3)' }}>
                            {new Date(entry.registered_at).toLocaleTimeString([], {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          {entry.status === 'waiting' && (
                            <button
                              onClick={() => markNoShow(entry.id)}
                              disabled={noShowLoading[entry.id]}
                              className="qf-btn-danger"
                            >
                              {noShowLoading[entry.id] ? '...' : '✗ No-show'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}