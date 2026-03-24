import { useState, useEffect } from 'react';
import { X, AlertCircle, Clock, Pill, FileText, User, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

const PRIORITY_STYLES = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  moderate: 'bg-orange-100 text-orange-700 border-orange-300',
  routine:  'bg-green-100 text-green-700 border-green-300',
};

const PRIORITY_LABELS = {
  critical: '🔴 Critical',
  moderate: '🟡 Moderate', 
  routine:  '🟢 Routine',
};

export default function PatientBriefModal({ patientId, appointmentId, queueEntryId, patientName, onClose, onCall }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchBrief();
  }, [patientId]);

  const fetchBrief = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appointmentId) params.append('appointmentId', appointmentId);
      if (queueEntryId) params.append('queueEntryId', queueEntryId);

      const res = await api.get(`/doctor-brief/patient/${patientId}?${params}`);
      setBrief(res.data);
    } catch (err) {
      console.error('Brief fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const priority = brief?.queueEntry?.priority || brief?.intake?.priority || 'routine';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className={`p-5 rounded-t-3xl border-b ${
          priority === 'critical' ? 'bg-red-50' :
          priority === 'moderate' ? 'bg-orange-50' : 'bg-blue-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{patientName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLES[priority]}`}>
                    {PRIORITY_LABELS[priority]}
                  </span>
                  {brief?.totalVisits > 0 && (
                    <span className="text-xs text-gray-500">
                      {brief.totalVisits} previous visit{brief.totalVisits > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-gray-50">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading patient brief...</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">

            {/* Critical Alert */}
            {priority === 'critical' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-semibold text-sm">Urgent Attention Needed</p>
                  <p className="text-red-500 text-xs mt-0.5">
                    {brief?.intake?.ai_summary || brief?.queueEntry?.ai_summary || 'Patient marked as critical'}
                  </p>
                </div>
              </div>
            )}

            {/* Today's Complaint */}
            {(brief?.intake || brief?.queueEntry) && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-gray-800 text-sm">Today's Complaint</h3>
                  {brief?.intake && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Patient filled form ✓
                    </span>
                  )}
                </div>

                {brief?.intake?.symptom_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {brief.intake.symptom_tags.map(tag => (
                      <span key={tag} className="bg-white text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {(brief?.intake?.chief_complaint || brief?.queueEntry?.symptoms) && (
                  <p className="text-gray-700 text-sm">
                    {brief?.intake?.chief_complaint || brief?.queueEntry?.symptoms}
                  </p>
                )}

                {brief?.intake?.ai_summary && (
                  <div className="mt-2 bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">🤖 AI Summary</p>
                    <p className="text-xs text-gray-600">{brief.intake.ai_summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Current Medicines */}
            {brief?.intake?.current_medicines && (
              <div className="bg-orange-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4 text-orange-600" />
                  <h3 className="font-semibold text-gray-800 text-sm">Current Medicines</h3>
                </div>
                <p className="text-gray-700 text-sm">{brief.intake.current_medicines}</p>
              </div>
            )}

            {/* Past Visits */}
            {brief?.pastVisits?.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-4">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <h3 className="font-semibold text-gray-800 text-sm">
                      Past Visits ({brief.pastVisits.length})
                    </h3>
                  </div>
                  {showHistory
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-3">
                    {brief.pastVisits.map((visit, i) => (
                      <div key={visit.id}
                        className="bg-white rounded-xl p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-400">
                            {new Date(visit.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-gray-400">{visit.doctor?.name}</p>
                        </div>
                        {visit.diagnosis && (
                          <p className="text-sm font-medium text-gray-700">
                            🩺 {visit.diagnosis}
                          </p>
                        )}
                        {visit.medicines && (
                          <p className="text-xs text-gray-500 mt-1">
                            💊 {visit.medicines}
                          </p>
                        )}
                        {visit.follow_up_date && (
                          <p className="text-xs text-blue-500 mt-1">
                            📅 Follow-up: {new Date(visit.follow_up_date).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No data state */}
            {!brief?.intake && !brief?.queueEntry?.symptoms && brief?.pastVisits?.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">No previous records found</p>
                <p className="text-gray-300 text-xs mt-1">First visit to this clinic</p>
              </div>
            )}

          </div>
        )}

        {/* Action Buttons */}
        <div className="p-5 border-t flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl text-sm hover:bg-gray-50">
            Back
          </button>
          <button
            onClick={() => { onCall(); onClose(); }}
            className={`flex-1 py-3 rounded-2xl text-white font-semibold text-sm ${
              priority === 'critical'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            📣 Call Patient
          </button>
        </div>

      </div>
    </div>
  );
}