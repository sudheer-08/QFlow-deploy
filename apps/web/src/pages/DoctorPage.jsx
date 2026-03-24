import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import socket, { connectClinic } from '../socket'
import PatientBriefModal from '../components/PatientBriefModal'
import { useToast } from '../components/Toast'

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

  // Fetch doctor's own queue
  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => api.get(`/queue/doctor/${user.id}`).then(r => r.data),
    refetchInterval: 30000
  })

  const waiting = queue.filter(e => e.status === 'waiting')

  // Call patient
  const callMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/call`),
    onSuccess: (res) => {
      setCurrentPatient(res.data)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  // Complete consultation
  const completeMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/complete`),
    onSuccess: () => {
      setCurrentPatient(null)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  // Skip patient
  const skipMutation = useMutation({
    mutationFn: (entryId) => api.patch(`/queue/${entryId}/skip`),
    onSuccess: () => {
      setCurrentPatient(null)
      queryClient.invalidateQueries(['doctor-queue'])
    }
  })

  // Real-time updates
  useEffect(() => {
    connectClinic(user.tenantId, user.id, user.role)
    socket.on('queue:patient_added', () => queryClient.invalidateQueries(['doctor-queue']))
    socket.on('patient:arrived', () => queryClient.invalidateQueries(['doctor-queue']))
    return () => {
      socket.off('queue:patient_added')
      socket.off('patient:arrived')
    }
  }, [])

  const priorityBadge = (p) => ({
    critical: '🔴 Critical',
    moderate: '🟡 Moderate',
    routine:  '🟢 Routine'
  })[p] || p

  const priorityBg = (p) => ({
    critical: 'border-l-4 border-red-500 bg-red-50',
    moderate: 'border-l-4 border-yellow-500 bg-yellow-50',
    routine:  'border-l-4 border-green-500 bg-green-50'
  })[p] || ''

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

  // Complete + optional follow-up
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
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">
              {user?.name?.startsWith('Dr') ? user.name : `Dr. ${user.name}`}
            </h1>
            <p className="text-xs text-gray-500">{waiting.length} patients waiting</p>
          </div>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Current Patient Panel */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-5">Current Consultation</h2>

          {currentPatient ? (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-blue-700 text-2xl">
                    {currentPatient.token_number}
                  </span>
                  <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                    {priorityBadge(currentPatient.priority)}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-lg">
                  {currentPatient.users?.name}
                </p>
                {currentPatient.registration_type === 'self_registered' && (
                  <span className="inline-block text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full mt-1">
                    📱 Self-registered (remote)
                  </span>
                )}
              </div>

              {/* AI Pre-brief */}
              {currentPatient.ai_summary && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-500 mb-1">🤖 AI PRE-BRIEF</p>
                  <p className="text-sm text-indigo-900">{currentPatient.ai_summary}</p>
                </div>
              )}

              {/* Symptoms */}
              {currentPatient.symptoms && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1">PATIENT REPORTED</p>
                  <p className="text-sm text-gray-700">{currentPatient.symptoms}</p>
                </div>
              )}

              {/* View full brief */}
              <button
                onClick={() => handleViewBrief(currentPatient)}
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2.5 rounded-xl text-sm border border-indigo-200 transition-colors">
                📋 View Full Patient Brief & History
              </button>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* ✅ Done button opens follow-up modal */}
                <button
                  onClick={() => setFollowUpModal(currentPatient.id)}
                  disabled={completeMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                  ✓ Done
                </button>
                <button
                  onClick={() => skipMutation.mutate(currentPatient.id)}
                  disabled={skipMutation.isPending}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors">
                  Skip
                </button>
                <button
                  onClick={() => window.location.href = `/doctor/prescription?patient=${currentPatient.patient_id}&name=${encodeURIComponent(currentPatient.users?.name)}&entry=${currentPatient.id}`}
                  className="col-span-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 rounded-xl transition-colors border border-blue-200">
                  📋 Write Prescription
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">👨‍⚕️</div>
              <p className="text-gray-500 mb-6">No active consultation</p>
              <button
                onClick={handleCallNext}
                disabled={waiting.length === 0 || callMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors">
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
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-lg">Waiting Queue</h2>
            <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
              {waiting.length}
            </span>
          </div>

          {waiting.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <p>All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {waiting.map((entry, idx) => (
                <div key={entry.id}
                  className={`rounded-xl p-4 ${priorityBg(entry.priority)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm font-medium w-6">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">
                            {entry.token_number}
                          </span>
                          <span className="text-xs text-gray-500">
                            {priorityBadge(entry.priority)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {entry.users?.name}
                        </p>
                        {entry.ai_summary && (
                          <p className="text-xs text-indigo-600 mt-1">
                            🤖 {entry.ai_summary}
                          </p>
                        )}
                        <div className="flex gap-2 mt-1">
                          {entry.registration_type === 'self_registered' && (
                            <span className="text-xs text-indigo-600">📱 Remote</span>
                          )}
                          {entry.arrival_status === 'at_home' && (
                            <span className="text-xs text-yellow-600">🏠 At home</span>
                          )}
                          {entry.arrival_status === 'arrived' && (
                            <span className="text-xs text-green-600">✅ Here</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewBrief(entry)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">
                      👁️ Brief & Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* ✅ Follow-up Modal */}
      {followUpModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Complete Consultation
            </h2>
            <p className="text-gray-500 text-sm mb-5">
              {currentPatient?.users?.name} — {currentPatient?.token_number}
            </p>

            <label className="block text-sm text-gray-600 mb-1">
              Schedule follow-up? (optional)
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 focus:outline-none focus:border-blue-400"
            />

            {followUpDate && (
              <>
                <label className="block text-sm text-gray-600 mb-1">
                  Follow-up reason
                </label>
                <input
                  value={followUpReason}
                  onChange={e => setFollowUpReason(e.target.value)}
                  placeholder="e.g. Check blood pressure, Review test results"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:border-blue-400"
                />
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                  <p className="text-xs text-blue-700">
                    📱 Patient will receive a WhatsApp reminder about their follow-up date
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFollowUpModal(null)
                  setFollowUpDate('')
                  setFollowUpReason('')
                }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={followUpSaving}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {followUpSaving
                  ? 'Saving...'
                  : followUpDate
                    ? '✓ Complete & Set Follow-up'
                    : '✓ Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}