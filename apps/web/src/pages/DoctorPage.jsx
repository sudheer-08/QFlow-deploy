import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import socket, { connectClinic } from '../socket'
import PatientBriefModal from '../components/PatientBriefModal'
import { useToast } from '../components/Toast'
import {
  LogOut, Stethoscope, CheckCircle2, SkipForward,
  FileText, Eye, CalendarPlus, User, Calendar, Activity,
  Clock, Users, Loader
} from 'lucide-react'
import './DoctorPage.css'

const today = new Date().toISOString().split('T')[0]
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

const priorityCfg = {
  critical: { label: '🔴 Critical', cls: 'is-critical', mini: 'dr-mini-critical' },
  moderate: { label: '🟡 Moderate', cls: 'is-moderate', mini: 'dr-mini-moderate' },
  routine:  { label: '🟢 Routine',  cls: 'is-routine',  mini: 'dr-mini-routine' }
}

function formatTime12(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return { time: `${h12}:${m.toString().padStart(2, '0')}`, ampm }
}

export default function DoctorPage() {
  const { user, logout } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('queue')
  const [currentPatient, setCurrentPatient] = useState(null)
  const [briefModal, setBriefModal] = useState(null)
  const [followUpModal, setFollowUpModal] = useState(null)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpReason, setFollowUpReason] = useState('')
  const [followUpSaving, setFollowUpSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)

  // ─── Live Queue ───
  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => api.get(`/queue/doctor/${user.id}`).then(r => r.data),
    refetchInterval: 30000
  })

  const waiting = queue.filter(e => e.status === 'waiting')
  const doneToday = queue.filter(e => e.status === 'done').length

  // ─── Appointments by date ───
  const { data: appointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ['clinic-appointments', selectedDate],
    queryFn: () => api.get(`/appointments/clinic/by-date?date=${selectedDate}`).then(r => r.data),
    enabled: activeTab === 'appointments',
    refetchInterval: 60000
  })

  const callMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/call`),
    onSuccess: (res) => {
      setCurrentPatient(res.data)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  const completeMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/complete`),
    onSuccess: () => {
      setCurrentPatient(null)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  const skipMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/skip`),
    onSuccess: () => {
      setCurrentPatient(null)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  useEffect(() => {
    connectClinic(user.tenantId, user.id, user.role)
    socket.on('queue:patient_added', () => queryClient.invalidateQueries(['doctor-queue']))
    socket.on('patient:arrived', () => queryClient.invalidateQueries(['doctor-queue']))
    return () => {
      socket.off('queue:patient_added')
      socket.off('patient:arrived')
    }
  }, [])

  const handleViewBrief = (entry) => {
    setBriefModal({
      patientId: entry.patient_id || entry.users?.id,
      queueEntryId: entry.id,
      patientName: entry.users?.name || 'Patient',
      entryId: entry.id
    })
  }

  const handleCallNext = () => {
    if (waiting[0]) handleViewBrief(waiting[0])
  }

  const handleComplete = async () => {
    setFollowUpSaving(true)
    try {
      await completeMutation.mutateAsync(followUpModal)
      if (followUpDate) {
        await api.post('/follow-up', {
          patient_id: currentPatient?.patient_id,
          queue_entry_id: followUpModal,
          follow_up_date: followUpDate,
          reason: followUpReason || 'Doctor recommended follow-up'
        })
        toast.success('Consultation complete & follow-up scheduled')
      } else {
        toast.success('Consultation completed')
      }
      setFollowUpModal(null)
      setFollowUpDate('')
      setFollowUpReason('')
    } catch {
      toast.error('Failed to complete consultation')
    } finally {
      setFollowUpSaving(false)
    }
  }

  const pCfg = priorityCfg[currentPatient?.priority] || priorityCfg.routine

  return (
    <div className="dr-shell">
      {/* ─── Header ─── */}
      <header className="dr-header">
        <div className="dr-header-left">
          <div className="dr-logo">Q</div>
          <div>
            <div className="dr-name">
              {user?.name?.startsWith('Dr') ? user.name : `Dr. ${user.name}`}
            </div>
            <div className="dr-clinic">{user?.clinicName || 'Clinic Dashboard'}</div>
          </div>
        </div>
        <div className="dr-header-right">
          <div className="dr-badge">
            <div className="dr-badge-dot" />
            {waiting.length} waiting
          </div>
          <button onClick={logout} className="dr-btn-logout">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {/* ─── Tabs ─── */}
      <nav className="dr-tabs">
        <button
          className={`dr-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Users size={15} /> Live Queue
          <span className="dr-tab-count">{waiting.length}</span>
        </button>
        <button
          className={`dr-tab ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          <Calendar size={15} /> Appointments
        </button>
        <button
          className={`dr-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <Activity size={15} /> Today's Stats
        </button>
      </nav>

      {/* ─── Queue Tab ─── */}
      {activeTab === 'queue' && (
        <div className="dr-body">
          <div className="dr-two-col">
            {/* Current Consultation */}
            <div className="dr-current-panel">
              <div className="dr-current-label">
                <Stethoscope size={12} /> Current Consultation
              </div>

              {currentPatient ? (
                <>
                  <div className="dr-token">{currentPatient.token_number}</div>
                  <div className="dr-patient-name">{currentPatient.users?.name}</div>
                  <div className={`dr-priority-tag dr-priority-${currentPatient.priority || 'routine'}`}>
                    {pCfg.label}
                  </div>

                  {currentPatient.ai_summary && (
                    <div className="dr-ai-brief">
                      <div className="dr-ai-brief-label">🤖 AI Pre-Brief</div>
                      <div className="dr-ai-brief-text">{currentPatient.ai_summary}</div>
                    </div>
                  )}

                  <div className="dr-action-row">
                    <button
                      onClick={() => handleViewBrief(currentPatient)}
                      className="dr-btn-ghost-white"
                    >
                      <Eye size={13} /> Full Brief
                    </button>
                    <button
                      onClick={() => skipMutation.mutate(currentPatient.id)}
                      disabled={skipMutation.isPending}
                      className="dr-btn-ghost-white"
                    >
                      <SkipForward size={13} /> Skip
                    </button>
                    <button
                      onClick={() => window.location.href = `/doctor/prescription?patient=${currentPatient.patient_id}&name=${encodeURIComponent(currentPatient.users?.name)}&entry=${currentPatient.id}`}
                      className="dr-btn-ghost-white"
                    >
                      <FileText size={13} /> Prescription
                    </button>
                    <button
                      onClick={() => setFollowUpModal(currentPatient.id)}
                      disabled={completeMutation.isPending}
                      className="dr-btn-white dr-btn-white-green"
                    >
                      <CheckCircle2 size={13} /> Done
                    </button>
                  </div>
                </>
              ) : (
                <div className="dr-current-empty">
                  <div style={{ fontSize: '3rem' }}>👨‍⚕️</div>
                  <p>No active consultation</p>
                  <button
                    onClick={handleCallNext}
                    disabled={waiting.length === 0 || callMutation.isPending}
                    className="dr-btn-white"
                    style={{ margin: '0 auto', padding: '10px 22px' }}
                  >
                    <User size={13} />
                    {callMutation.isPending
                      ? 'Calling...'
                      : waiting.length > 0
                        ? `View & Call ${waiting[0]?.token_number}`
                        : 'No patients waiting'}
                  </button>
                </div>
              )}
            </div>

            {/* Waiting Queue */}
            <div className="dr-card">
              <div className="dr-card-head">
                <div className="dr-card-title">
                  <Clock size={16} /> Waiting Queue
                </div>
                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {waiting.length} patient{waiting.length !== 1 ? 's' : ''}
                </span>
              </div>

              {waiting.length === 0 ? (
                <div className="dr-empty">
                  <div className="dr-empty-icon">✅</div>
                  <p>All caught up! Queue is clear.</p>
                </div>
              ) : (
                <div className="dr-queue-list">
                  {waiting.map((entry, idx) => {
                    const cfg = priorityCfg[entry.priority] || priorityCfg.routine
                    return (
                      <div key={entry.id} className={`dr-queue-item ${cfg.cls}`}>
                        <div className="dr-queue-left">
                          <span className="dr-queue-num">#{idx + 1}</span>
                          <span className="dr-queue-token">{entry.token_number}</span>
                          <div className="dr-queue-info">
                            <div className="dr-queue-name">{entry.users?.name}</div>
                            <div className="dr-queue-meta">
                              <span className={`dr-mini-badge ${cfg.mini}`}>{cfg.label}</span>
                              {entry.registration_type === 'self_registered' && (
                                <span className="dr-mini-badge dr-mini-remote">📱 Remote</span>
                              )}
                              {entry.arrival_status === 'arrived' && (
                                <span className="dr-mini-badge dr-mini-arrived">✅ Here</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewBrief(entry)}
                          className="dr-call-btn"
                        >
                          <Eye size={12} /> Brief & Call
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Appointments Tab ─── */}
      {activeTab === 'appointments' && (
        <div className="dr-body">
          <div className="dr-card">
            <div className="dr-date-bar">
              <Calendar size={16} style={{ color: '#3b82f6' }} />
              <span className="dr-date-label">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="dr-date-input"
                min={today}
              />
              <div className="dr-date-quick">
                <button
                  className={`dr-date-chip ${selectedDate === today ? 'active' : ''}`}
                  onClick={() => setSelectedDate(today)}
                >Today</button>
                <button
                  className={`dr-date-chip ${selectedDate === tomorrow ? 'active' : ''}`}
                  onClick={() => setSelectedDate(tomorrow)}
                >Tomorrow</button>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </div>

            {apptLoading ? (
              <div className="dr-spinner">
                <Loader size={18} className="spin" /> Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <div className="dr-empty">
                <div className="dr-empty-icon">📅</div>
                <p>No appointments scheduled for this date.</p>
              </div>
            ) : (
              <div className="dr-appt-list">
                {appointments.map(appt => {
                  const fmt = formatTime12(appt.slot_time?.slice(0, 5))
                  const statusCls = {
                    confirmed: 'dr-status-confirmed',
                    completed: 'dr-status-completed',
                    pending: 'dr-status-pending',
                    cancelled: 'dr-status-cancelled'
                  }[appt.status] || 'dr-status-pending'

                  return (
                    <div key={appt.id} className="dr-appt-item">
                      <div className="dr-appt-time-block">
                        <div className="dr-appt-time">{fmt.time}</div>
                        <div className="dr-appt-ampm">{fmt.ampm}</div>
                      </div>
                      <div className="dr-appt-info">
                        <div className="dr-appt-name">{appt.users?.name || 'Patient'}</div>
                        <div className="dr-appt-meta">
                          <span className="dr-appt-type">
                            {appt.visit_type === 'first_visit' ? 'First Visit' : 'Follow-up'}
                          </span>
                          {appt.payment_amount && (
                            <span className="dr-appt-fee">₹{appt.payment_amount}</span>
                          )}
                          <span className={`dr-status-badge ${statusCls}`}>
                            {appt.status?.charAt(0).toUpperCase() + appt.status?.slice(1)}
                          </span>
                        </div>
                        {appt.symptoms && (
                          <div className="dr-appt-symptoms">💬 {appt.symptoms}</div>
                        )}
                        {appt.ai_summary && (
                          <div className="dr-appt-symptoms" style={{ color: '#7c3aed' }}>
                            🤖 {appt.ai_summary}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Stats Tab ─── */}
      {activeTab === 'stats' && (
        <div className="dr-body">
          <div className="dr-stats-grid">
            {[
              { icon: '⏳', label: 'Waiting', value: waiting.length, bg: '#eff6ff' },
              { icon: '✅', label: 'Completed Today', value: doneToday, bg: '#f0fdf4' },
              { icon: '👥', label: 'Total Today', value: queue.length, bg: '#faf5ff' },
            ].map(s => (
              <div key={s.label} className="dr-stat-card">
                <div className="dr-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div className="dr-stat-label">{s.label}</div>
                <div className="dr-stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="dr-card" style={{ marginTop: 0 }}>
            <div className="dr-card-head">
              <div className="dr-card-title"><Activity size={16} /> Recent Activity</div>
            </div>
            {queue.filter(e => e.status === 'done').length === 0 ? (
              <div className="dr-empty">
                <div className="dr-empty-icon">📊</div>
                <p>No completed consultations yet today.</p>
              </div>
            ) : (
              <div className="dr-queue-list">
                {queue.filter(e => e.status === 'done').map(entry => (
                  <div key={entry.id} className="dr-queue-item">
                    <div className="dr-queue-left">
                      <span className="dr-queue-token">{entry.token_number}</span>
                      <div className="dr-queue-info">
                        <div className="dr-queue-name">{entry.users?.name}</div>
                        <div className="dr-queue-meta">
                          <span className="dr-mini-badge dr-mini-arrived">✅ Completed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Brief Modal ─── */}
      {briefModal && (
        <PatientBriefModal
          patientId={briefModal.patientId}
          queueEntryId={briefModal.queueEntryId}
          patientName={briefModal.patientName}
          onClose={() => setBriefModal(null)}
          onCall={() => {
            callMutation.mutate(briefModal.entryId)
            setBriefModal(null)
          }}
        />
      )}

      {/* ─── Follow-up Modal ─── */}
      {followUpModal && (
        <div className="dr-overlay">
          <div className="dr-modal">
            <h2><CheckCircle2 size={18} style={{ color: '#059669' }} /> Complete Consultation</h2>
            <p>{currentPatient?.users?.name} — {currentPatient?.token_number}</p>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div className="dr-modal-label">
                  <CalendarPlus size={13} /> Schedule follow-up? (optional)
                </div>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  min={tomorrow}
                  className="dr-modal-input"
                />
              </div>

              {followUpDate && (
                <>
                  <div>
                    <div className="dr-modal-label">Follow-up reason</div>
                    <input
                      value={followUpReason}
                      onChange={e => setFollowUpReason(e.target.value)}
                      placeholder="e.g. Check blood pressure, Review results"
                      className="dr-modal-input"
                    />
                  </div>
                  <div className="dr-info-box">
                    📱 Patient will receive a reminder about their follow-up date.
                  </div>
                </>
              )}

              <div className="dr-modal-actions">
                <button
                  onClick={() => { setFollowUpModal(null); setFollowUpDate(''); setFollowUpReason('') }}
                  className="dr-btn-secondary"
                >Cancel</button>
                <button
                  onClick={handleComplete}
                  disabled={followUpSaving}
                  className="dr-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                >
                  <CheckCircle2 size={14} />
                  {followUpSaving ? 'Saving...' : followUpDate ? 'Complete & Follow-up' : 'Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}