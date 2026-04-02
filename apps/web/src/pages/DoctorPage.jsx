import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import socket, { connectClinic } from '../socket'
import PatientBriefModal from '../components/PatientBriefModal'
import { useToast } from '../components/Toast'
import {
  LogOut, Stethoscope, CheckCircle2, SkipForward,
  FileText, Eye, CalendarPlus, User
} from 'lucide-react'

export default function DoctorPage() {
  const { user, logout } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [currentPatient, setCurrentPatient] = useState(null)
  const [briefModal, setBriefModal] = useState(null)
  const [followUpModal, setFollowUpModal] = useState(null)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpReason, setFollowUpReason] = useState('')
  const [followUpSaving, setFollowUpSaving] = useState(false)

  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => api.get(`/queue/doctor/${user.id}`).then(r => r.data),
    refetchInterval: 30000
  })

  const waiting = queue.filter(e => e.status === 'waiting')

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

  const priorityConfig = {
    critical: { label: '🔴 Critical', cls: 'priority-critical', badge: 'qf-badge-red' },
    moderate: { label: '🟡 Moderate', cls: 'priority-moderate', badge: 'qf-badge-amber' },
    routine:  { label: '🟢 Routine',  cls: 'priority-routine',  badge: 'qf-badge-green' }
  }

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

  return (
    <div className="qf-staff-shell">
      {/* Header */}
      <header className="qf-staff-header">
        <div className="qf-staff-brand">
          <div className="qf-staff-logo">Q</div>
          <div>
            <div className="qf-staff-title">
              {user?.name?.startsWith('Dr') ? user.name : `Dr. ${user.name}`}
            </div>
            <div className="qf-staff-subtitle">{waiting.length} patients waiting</div>
          </div>
        </div>
        <button onClick={logout} className="qf-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="qf-staff-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="lg:grid-cols-2">

          {/* Current Patient Panel */}
          <div className="qf-content-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Stethoscope size={18} style={{ color: 'var(--ui-primary)' }} />
              <h2 style={{ margin: 0 }}>Current Consultation</h2>
            </div>

            {currentPatient ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {/* Patient info */}
                <div style={{
                  borderRadius: 16, padding: 16,
                  background: 'linear-gradient(135deg, #eef3ff, #e3edff)',
                  border: '1px solid #c0d3ff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{
                      fontFamily: 'Sora, sans-serif', fontWeight: 800,
                      fontSize: '1.5rem', color: 'var(--ui-primary)'
                    }}>
                      {currentPatient.token_number}
                    </span>
                    <span className={`qf-badge ${(priorityConfig[currentPatient.priority] || priorityConfig.routine).badge}`}>
                      {(priorityConfig[currentPatient.priority] || priorityConfig.routine).label}
                    </span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ui-text-1)', margin: 0 }}>
                    {currentPatient.users?.name}
                  </p>
                  {currentPatient.registration_type === 'self_registered' && (
                    <span className="qf-badge qf-badge-indigo" style={{ marginTop: 6 }}>📱 Self-registered (remote)</span>
                  )}
                </div>

                {/* AI Pre-brief */}
                {currentPatient.ai_summary && (
                  <div style={{
                    borderRadius: 14, padding: 14,
                    background: 'linear-gradient(165deg, #f0e5ff, #ede9fe)',
                    border: '1px solid #d8cef7'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🤖 AI Pre-Brief
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#4c1d95' }}>
                      {currentPatient.ai_summary}
                    </p>
                  </div>
                )}

                {/* Symptoms */}
                {currentPatient.symptoms && (
                  <div style={{
                    borderRadius: 14, padding: 14,
                    background: 'linear-gradient(165deg, #f8faff, #f1f5f9)',
                    border: '1px solid var(--ui-border)'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--ui-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Patient Reported
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--ui-text-1)' }}>
                      {currentPatient.symptoms}
                    </p>
                  </div>
                )}

                {/* View full brief */}
                <button
                  onClick={() => handleViewBrief(currentPatient)}
                  className="qf-btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Eye size={14} /> View Full Patient Brief & History
                </button>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    onClick={() => setFollowUpModal(currentPatient.id)}
                    disabled={completeMutation.isPending}
                    className="qf-btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #059669, #10b981)' }}
                  >
                    <CheckCircle2 size={16} /> Done
                  </button>
                  <button
                    onClick={() => skipMutation.mutate(currentPatient.id)}
                    disabled={skipMutation.isPending}
                    className="qf-btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <SkipForward size={16} /> Skip
                  </button>
                  <button
                    onClick={() => window.location.href = `/doctor/prescription?patient=${currentPatient.patient_id}&name=${encodeURIComponent(currentPatient.users?.name)}&entry=${currentPatient.id}`}
                    className="qf-btn-secondary"
                    style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <FileText size={16} /> Write Prescription
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 22,
                  background: 'linear-gradient(135deg, #eef3ff, #e3edff)',
                  display: 'grid', placeItems: 'center',
                  margin: '0 auto 16px', fontSize: '2rem'
                }}>
                  👨‍⚕️
                </div>
                <p style={{ color: 'var(--ui-text-2)', marginBottom: 20 }}>No active consultation</p>
                <button
                  onClick={handleCallNext}
                  disabled={waiting.length === 0 || callMutation.isPending}
                  className="qf-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <User size={16} />
                  {callMutation.isPending
                    ? 'Calling...'
                    : waiting.length > 0
                      ? `View Brief & Call Next (${waiting[0]?.token_number})`
                      : 'No patients waiting'}
                </button>
              </div>
            )}
          </div>

          {/* Waiting Queue */}
          <div className="qf-content-card">
            <div className="qf-section-head" style={{ marginBottom: 16 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Waiting Queue
                <span className="qf-badge qf-badge-blue">{waiting.length}</span>
              </h2>
            </div>

            {waiting.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ui-text-3)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                <p>All caught up!</p>
              </div>
            ) : (
              <div className="qf-scroll" style={{ display: 'grid', gap: 10, maxHeight: 500, overflowY: 'auto', paddingRight: 4 }}>
                {waiting.map((entry, idx) => {
                  const pCfg = priorityConfig[entry.priority] || priorityConfig.routine
                  return (
                    <div key={entry.id} className={`qf-queue-card ${pCfg.cls}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ color: 'var(--ui-text-3)', fontSize: '0.82rem', fontWeight: 600, width: 24 }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, color: 'var(--ui-text-1)' }}>
                                {entry.token_number}
                              </span>
                              <span className={`qf-badge ${pCfg.badge}`}>{pCfg.label}</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--ui-text-1)' }}>
                              {entry.users?.name}
                            </p>
                            {entry.ai_summary && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#5b4cdb' }}>
                                🤖 {entry.ai_summary}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                              {entry.registration_type === 'self_registered' && (
                                <span className="qf-badge qf-badge-indigo">📱 Remote</span>
                              )}
                              {entry.arrival_status === 'at_home' && (
                                <span className="qf-badge qf-badge-amber">🏠 At home</span>
                              )}
                              {entry.arrival_status === 'arrived' && (
                                <span className="qf-badge qf-badge-green">✅ Here</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewBrief(entry)}
                          className="qf-btn-primary"
                          style={{ fontSize: '0.78rem', padding: '8px 14px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={12} /> Brief & Call
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Brief Modal */}
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

      {/* Follow-up Modal */}
      {followUpModal && (
        <div className="qf-overlay">
          <div className="qf-modal">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: '#059669' }} />
              Complete Consultation
            </h2>
            <p style={{ marginTop: 4 }}>
              {currentPatient?.users?.name} — {currentPatient?.token_number}
            </p>

            <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
              <div>
                <label className="qf-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarPlus size={13} /> Schedule follow-up? (optional)
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  className="qf-input"
                />
              </div>

              {followUpDate && (
                <>
                  <div>
                    <label className="qf-label">Follow-up reason</label>
                    <input
                      value={followUpReason}
                      onChange={e => setFollowUpReason(e.target.value)}
                      placeholder="e.g. Check blood pressure, Review test results"
                      className="qf-input"
                    />
                  </div>
                  <div style={{
                    borderRadius: 12, padding: 12,
                    background: 'linear-gradient(165deg, #eef3ff, #e3edff)',
                    border: '1px solid #c0d3ff'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#1452ff' }}>
                      📱 Patient will receive a WhatsApp reminder about their follow-up date
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    setFollowUpModal(null)
                    setFollowUpDate('')
                    setFollowUpReason('')
                  }}
                  className="qf-btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  disabled={followUpSaving}
                  className="qf-btn-primary"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <CheckCircle2 size={14} />
                  {followUpSaving
                    ? 'Saving...'
                    : followUpDate
                      ? 'Complete & Set Follow-up'
                      : 'Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}