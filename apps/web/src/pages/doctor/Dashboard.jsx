import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import socket, { connectClinic } from '../../socket'
import { useToast } from '../../components/Toast'
import ConsultationModal from '../../components/doctor/ConsultationModal'
import QueueList from '../../components/doctor/QueueList'
import PatientBriefModal from '../../components/PatientBriefModal'
import {
  LogOut, Stethoscope, Clock, Users, CheckCircle2, AlertTriangle,
  Phone, FileText, RefreshCw, Activity
} from 'lucide-react'
import './Dashboard.css'

const today = new Date().toISOString().split('T')[0]

export default function DoctorDashboard() {
  const { user, logout } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [selectedEntry, setSelectedEntry] = useState(null)
  const [showConsultation, setShowConsultation] = useState(false)
  const [briefModal, setBriefModal] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch live queue for current doctor
  const { data: queue = [], isFetching: isQueueFetching } = useQuery({
    queryKey: ['doctor-queue', user?.id],
    queryFn: () => api.get(`/queue/doctor/${user?.id}`).then(r => r.data),
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: !!user?.id
  })

  // Fetch summary stats
  const { data: summary = {} } = useQuery({
    queryKey: ['doctor-summary', today],
    queryFn: () => api.get('/analytics/summary/today').then(r => r.data),
    refetchInterval: autoRefresh ? 60000 : false
  })

  const waiting = queue.filter(e => e.status === 'waiting')
  const inProgress = queue.filter(e => e.status === 'in_progress')
  const completed = queue.filter(e => e.status === 'done')

  // Mutations
  const callMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/call`),
    onSuccess: (res) => {
      setSelectedEntry(res.data)
      setShowConsultation(true)
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      toast.success('Patient called')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to call patient')
    }
  })

  const skipMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/skip`),
    onSuccess: () => {
      setSelectedEntry(null)
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      toast.info('Patient skipped to end of queue')
    }
  })

  const noShowMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/no-show`),
    onSuccess: () => {
      setSelectedEntry(null)
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      toast.warn('Marked as no-show')
    }
  })

  // Setup socket listeners
  useEffect(() => {
    if (!user?.tenantId) return

    connectClinic(user.tenantId, user.id, user.role)

    const handleQueueUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    }

    const handleSummaryUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-summary'] })
    }

    socket.on('queue:patient_added', handleQueueUpdate)
    socket.on('queue:token_called', handleQueueUpdate)
    socket.on('queue:entry_completed', handleSummaryUpdate)
    socket.on('queue:no_show', handleQueueUpdate)
    socket.on('patient:arrived', handleQueueUpdate)

    return () => {
      socket.off('queue:patient_added', handleQueueUpdate)
      socket.off('queue:token_called', handleQueueUpdate)
      socket.off('queue:entry_completed', handleSummaryUpdate)
      socket.off('queue:no_show', handleQueueUpdate)
      socket.off('patient:arrived', handleQueueUpdate)
    }
  }, [user?.tenantId, user?.id, queryClient])

  const handleSelectPatient = (entry) => {
    setSelectedEntry(entry)
    setShowConsultation(true)
  }

  const handleViewBrief = (entry) => {
    setBriefModal({
      patientId: entry.patient_id || entry.users?.id,
      queueEntryId: entry.id,
      patientName: entry.users?.name || 'Patient',
      entryId: entry.id
    })
  }

  const handleConsultationClose = () => {
    setShowConsultation(false)
    setSelectedEntry(null)
    queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
  }

  return (
    <div className="dr-dashboard">
      {/* Header */}
      <header className="dr-dash-header">
        <div className="dr-dash-brand">
          <div className="dr-dash-logo">Q</div>
          <div>
            <h1 className="dr-dash-title">
              {user?.name?.startsWith('Dr') ? user.name : `Dr. ${user.name}`}
            </h1>
            <p className="dr-dash-clinic">{user?.clinicName}</p>
          </div>
        </div>

        <div className="dr-dash-controls">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`dr-btn-icon ${autoRefresh ? 'active' : ''}`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw size={18} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })}
            className="dr-btn-icon"
            title="Manual refresh"
            disabled={isQueueFetching}
          >
            <Phone size={18} />
          </button>
          <button onClick={logout} className="dr-btn-logout">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="dr-stats-bar">
        <div className="dr-stat-item">
          <Clock size={16} />
          <span>Waiting: <strong>{waiting.length}</strong></span>
        </div>
        <div className="dr-stat-item">
          <Stethoscope size={16} />
          <span>In Progress: <strong>{inProgress.length}</strong></span>
        </div>
        <div className="dr-stat-item">
          <CheckCircle2 size={16} />
          <span>Completed: <strong>{completed.length}</strong></span>
        </div>
        <div className="dr-stat-item">
          <AlertTriangle size={16} />
          <span>Avg Wait: <strong>{summary.avgWaitMins || 0}m</strong></span>
        </div>
      </div>

      {/* Main Layout: Queue on Left, Consultation on Right */}
      <div className="dr-main-layout">
        {/* Left Panel: Queue */}
        <aside className="dr-queue-panel">
          <div className="dr-panel-header">
            <Users size={18} />
            <h2>Today's Queue</h2>
            <span className="dr-queue-count">{waiting.length}</span>
          </div>

          {waiting.length === 0 ? (
            <div className="dr-empty-state">
              <div className="dr-empty-icon">✅</div>
              <p>No patients waiting</p>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Great job! Queue is clear.</p>
            </div>
          ) : (
            <QueueList
              entries={waiting}
              selectedId={selectedEntry?.id}
              onSelect={handleSelectPatient}
              onViewBrief={handleViewBrief}
              onCall={(entry) => callMutation.mutate(entry.id)}
              isLoading={callMutation.isPending}
            />
          )}
        </aside>

        {/* Right Panel: Consultation */}
        <main className="dr-consultation-panel">
          {selectedEntry && showConsultation ? (
            <ConsultationModal
              entry={selectedEntry}
              onClose={handleConsultationClose}
              onSkip={() => skipMutation.mutate(selectedEntry.id)}
              onNoShow={() => noShowMutation.mutate(selectedEntry.id)}
              isSkipping={skipMutation.isPending}
              isNoShowing={noShowMutation.isPending}
              onViewBrief={() => handleViewBrief(selectedEntry)}
            />
          ) : (
            <div className="dr-empty-state">
              <div className="dr-empty-icon">👨‍⚕️</div>
              <p>Select a patient from the queue to start consultation</p>
              {waiting.length > 0 && (
                <button
                  onClick={() => handleSelectPatient(waiting[0])}
                  className="dr-btn-primary"
                  style={{ marginTop: 16 }}
                >
                  <Phone size={16} /> Call Next Patient ({waiting[0]?.token_number})
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Patient Brief Modal */}
      {briefModal && (
        <PatientBriefModal
          patientId={briefModal.patientId}
          queueEntryId={briefModal.queueEntryId}
          patientName={briefModal.patientName}
          onClose={() => setBriefModal(null)}
        />
      )}
    </div>
  )
}
