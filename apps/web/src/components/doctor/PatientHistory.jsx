import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Clock, Loader, AlertCircle } from 'lucide-react'
import './PatientHistory.css'

export default function PatientHistory({ patientId }) {
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: () => api.get(`/doctor-brief/patient/${patientId}?visitHistory=true`).then(r => r.data?.visitHistory || []),
    enabled: !!patientId
  })

  if (isLoading) {
    return (
      <div className="dr-history">
        <div className="dr-history-loading">
          <Loader size={20} className="spin" />
          <p>Loading patient history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dr-history">
        <div className="dr-history-error">
          <AlertCircle size={20} />
          <p>Failed to load patient history</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dr-history">
      <h3>Visit History</h3>

      {history.length === 0 ? (
        <div className="dr-history-empty">
          <div className="dr-history-empty-icon">📋</div>
          <p>No previous visits</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>This is the patient's first visit</p>
        </div>
      ) : (
        <div className="dr-history-list">
          {history.map((visit, idx) => (
            <div key={visit.id || idx} className="dr-history-item">
              <div className="dr-history-date">
                <Clock size={14} />
                {new Date(visit.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>

              <div className="dr-history-content">
                {visit.doctor_name && (
                  <div className="dr-history-doctor">
                    👨‍⚕️ Dr. {visit.doctor_name}
                  </div>
                )}

                {visit.diagnosis && (
                  <div className="dr-history-section">
                    <label>Diagnosis</label>
                    <p>{visit.diagnosis}</p>
                  </div>
                )}

                {visit.medicines && (
                  <div className="dr-history-section">
                    <label>Medicines</label>
                    <p>{typeof visit.medicines === 'string' ? visit.medicines : JSON.stringify(visit.medicines)}</p>
                  </div>
                )}

                {visit.instructions && (
                  <div className="dr-history-section">
                    <label>Instructions</label>
                    <p>{visit.instructions}</p>
                  </div>
                )}

                {visit.follow_up_date && (
                  <div className="dr-history-followup">
                    📅 Follow-up: {new Date(visit.follow_up_date).toLocaleDateString('en-IN')}
                    {visit.follow_up_reason && ` - ${visit.follow_up_reason}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
