import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useToast } from '../../components/Toast'
import PrescriptionBuilder from './PrescriptionBuilder'
import ConsultationNotes from './ConsultationNotes'
import PatientVitals from './PatientVitals'
import PatientHistory from './PatientHistory'
import {
  X, Pill, FileText, Activity, Clock, CheckCircle2, AlertTriangle,
  SkipForward, Save
} from 'lucide-react'
import './ConsultationModal.css'

export default function ConsultationModal({
  entry,
  onClose,
  onSkip,
  onNoShow,
  isSkipping,
  isNoShowing,
  onViewBrief
}) {
  const [activeTab, setActiveTab] = useState('notes')
  const [notes, setNotes] = useState('')
  const [prescription, setPrescription] = useState([])
  const [vitals, setVitals] = useState({})
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpReason, setFollowUpReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Save consultation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        diagnosis: notes,
        medicines: prescription,
        instructions: '',
        follow_up_date: followUpDate || null,
        follow_up_reason: followUpReason || null,
        send_prescription: prescription.length > 0
      }
      return api.post(`/post-visit/complete/${entry.id}`, data)
    },
    onSuccess: () => {
      toast.success('Consultation saved successfully')
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      onClose()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to save consultation')
    }
  })

  const handleSaveAndComplete = async () => {
    if (!notes.trim()) {
      toast.error('Please add consultation notes')
      return
    }

    setIsSaving(true)
    try {
      await saveMutation.mutateAsync()
    } finally {
      setIsSaving(false)
    }
  }

  const patientName = entry.users?.name || 'Patient'
  const token = entry.token_number

  return (
    <div className="dr-consultation-modal">
      {/* Header */}
      <div className="dr-consult-header">
        <div className="dr-consult-patient">
          <div className="dr-consult-token">{token}</div>
          <div>
            <h2 className="dr-consult-name">{patientName}</h2>
            <p className="dr-consult-meta">
              {entry.visit_type === 'first_visit' ? 'First Visit' : 'Follow-up'} •{' '}
              {entry.priority ? `${entry.priority.charAt(0).toUpperCase() + entry.priority.slice(1)} Priority` : 'Routine'}
            </p>
          </div>
        </div>

        <div className="dr-consult-actions">
          <button
            onClick={onViewBrief}
            className="dr-consult-btn dr-consult-btn-secondary"
            title="View full patient brief"
          >
            View Brief
          </button>
          <button
            onClick={() => onSkip()}
            disabled={isSkipping}
            className="dr-consult-btn dr-consult-btn-secondary"
            title="Skip to end of queue"
          >
            <SkipForward size={14} /> {isSkipping ? 'Skipping...' : 'Skip'}
          </button>
          <button
            onClick={() => onNoShow()}
            disabled={isNoShowing}
            className="dr-consult-btn dr-consult-btn-danger"
            title="Mark as no-show"
          >
            <AlertTriangle size={14} /> {isNoShowing ? 'Marking...' : 'No-Show'}
          </button>
          <button
            onClick={onClose}
            className="dr-consult-btn-close"
            title="Close consultation"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dr-consult-tabs">
        <button
          className={`dr-consult-tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <FileText size={16} />
          Notes
        </button>
        <button
          className={`dr-consult-tab ${activeTab === 'prescription' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescription')}
        >
          <Pill size={16} />
          Prescription
        </button>
        <button
          className={`dr-consult-tab ${activeTab === 'vitals' ? 'active' : ''}`}
          onClick={() => setActiveTab('vitals')}
        >
          <Activity size={16} />
          Vitals
        </button>
        <button
          className={`dr-consult-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={16} />
          History
        </button>
      </div>

      {/* Content */}
      <div className="dr-consult-content">
        {activeTab === 'notes' && (
          <ConsultationNotes
            notes={notes}
            setNotes={setNotes}
            patientName={patientName}
          />
        )}

        {activeTab === 'prescription' && (
          <PrescriptionBuilder
            medicines={prescription}
            setMedicines={setPrescription}
            patientName={patientName}
          />
        )}

        {activeTab === 'vitals' && (
          <PatientVitals
            vitals={vitals}
            setVitals={setVitals}
          />
        )}

        {activeTab === 'history' && (
          <PatientHistory
            patientId={entry.patient_id}
          />
        )}
      </div>

      {/* Follow-up Section */}
      <div className="dr-consult-followup">
        <label className="dr-followup-label">
          <input
            type="checkbox"
            checked={!!followUpDate}
            onChange={(e) => {
              if (!e.target.checked) {
                setFollowUpDate('')
                setFollowUpReason('')
              }
            }}
          />
          Schedule Follow-up?
        </label>

        {followUpDate && (
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={tomorrow}
              className="dr-input"
            />
            <input
              type="text"
              value={followUpReason}
              onChange={(e) => setFollowUpReason(e.target.value)}
              placeholder="Follow-up reason (e.g., Review test results)"
              className="dr-input"
            />
          </div>
        )}

        {!followUpDate && (
          <button
            className="dr-consult-btn dr-consult-btn-secondary"
            onClick={() => setFollowUpDate(tomorrow)}
            style={{ width: '100%', marginTop: 8 }}
          >
            <Clock size={14} /> Add Follow-up
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="dr-consult-footer">
        <button
          onClick={onClose}
          className="dr-consult-btn dr-consult-btn-secondary"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          onClick={handleSaveAndComplete}
          disabled={isSaving || !notes.trim()}
          className="dr-consult-btn dr-consult-btn-success"
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : 'Complete & Save'}
        </button>
      </div>
    </div>
  )
}
