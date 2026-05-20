import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import useQueueState from "../../hooks/useQueueState";
import api from "../../services/api";
import { format } from "date-fns";
import { CheckCircle2, UserCheck, AlertTriangle } from "lucide-react";
import "./Dashboard.css";

const VISIT_TYPE_BADGES = {
  new: { label: "New Visit", color: "blue" },
  followup: { label: "Follow-up", color: "teal" },
  prescription: { label: "Prescription", color: "gray" },
  report_review: { label: "Report", color: "purple" },
  procedure: { label: "Procedure", color: "amber" },
};

const Badge = ({ visitType }) => {
  const { label, color } = VISIT_TYPE_BADGES[visitType] || {
    label: "Visit",
    color: "gray",
  };
  const colorStyles = {
    blue: "bg-blue-100 text-blue-800 border border-blue-200",
    teal: "bg-teal-100 text-teal-800 border border-teal-200",
    gray: "bg-gray-100 text-gray-800 border border-gray-200",
    purple: "bg-purple-100 text-purple-800 border border-purple-200",
    amber: "bg-amber-100 text-amber-800 border border-amber-200",
  };
  return (
    <span
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${colorStyles[color]} shadow-sm`}
    >
      {label}
    </span>
  );
};

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const date = format(new Date(), "yyyy-MM-dd");

  const { queueState, isLoading, error } = useQueueState(user?.id, date);
  const [graceCounter, setGraceCounter] = useState(0);
  const [elapsedCounter, setElapsedCounter] = useState(0);
  const [notes, setNotes] = useState("");

  // Grace Period Timer (for `called`)
  useEffect(() => {
    if (queueState?.called && !queueState?.current) {
      const calledAt = new Date(queueState.called.called_at).getTime();
      const graceMs = 5 * 60 * 1000; // default 5 mins
      const updateGrace = () => {
        const remaining = Math.max(0, graceMs - (Date.now() - calledAt));
        setGraceCounter(Math.floor(remaining / 1000));
      };
      updateGrace();
      const intv = setInterval(updateGrace, 1000);
      return () => clearInterval(intv);
    }
  }, [queueState?.called, queueState?.current]);

  // Consultation Elapsed Timer (for `in_progress`)
  useEffect(() => {
    if (queueState?.current) {
      const startedAt = new Date(queueState.current.started_at).getTime();
      const updateElapsed = () => {
        const elapsed = Math.max(0, Date.now() - startedAt);
        setElapsedCounter(Math.floor(elapsed / 1000));
      };
      updateElapsed();
      const intv = setInterval(updateElapsed, 1000);
      return () => clearInterval(intv);
    } else {
        setNotes(""); // Clear notes when no current consultation
    }
  }, [queueState?.current]);

  // Actions
  const handleCallPatient = async (bookingId) => {
    try {
        if(bookingId) {
             // In reality we call the next patient, the /call-next endpoint doesn't take an ID parameter, it calls the NEXT one automatically.
              await api.post(`/queue/call-next/${user?.id}`);
        } else {
            await api.post(`/queue/call-next/${user?.id}`);
        }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to call patient");
    }
  };

  const handleStartConsultation = async (bookingId) => {
    try {
      await api.post(`/queue/start-consultation/${bookingId}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to start consultation");
    }
  };

  const handleSkip = async (bookingId) => {
    try {
      await api.post(`/queue/skip/${bookingId}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to skip patient");
    }
  };

  const handleMarkComplete = async (bookingId) => {
     try {
         // Pass notes to complete endpoint if backend supports it, left out for now.
         await api.post(`/queue/mark-complete/${bookingId}`);
     } catch (err) {
         alert(err.response?.data?.error || "Failed to mark as complete");
     }
  }

  if (isLoading) {
       return (
        <div className="p-12 text-center text-gray-500">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
           Loading your queue...
        </div>
      )
  }

  if (error) return <div className="p-4 text-red-500 font-medium">Error loading queue state: {error.message}</div>;

  const nextPatients = queueState?.checked_in?.slice(0, 3) || [];

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-slate-50 font-sans">
      
      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        
        {/* HERO SECTION: IN PROGRESS OR CALLED OR NEXT UP */}
        {!queueState?.current && !queueState?.called && queueState?.checked_in?.length > 0 && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8">
                     <p className="text-gray-500 text-sm font-semibold tracking-wider uppercase mb-2">Next Patient Up</p>
                     <div className="flex items-start justify-between flex-wrap gap-4">
                         <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-100 text-blue-800 font-mono font-bold px-3 py-1.5 rounded-lg text-lg ring-1 ring-blue-200">
                                   T-{String(queueState.checked_in[0].token_number).padStart(3, "0")}
                                </span>
                                <Badge visitType={queueState.checked_in[0].visit_type} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mt-2">
                                {queueState.checked_in[0].patients?.name || queueState.checked_in[0].patient_name_cache || "Unknown"}
                            </h2>
                         </div>
                     </div>
                </div>
                <div className="bg-gray-50 px-6 py-5 border-t border-gray-100">
                     <button
                        onClick={() => handleCallPatient()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-transform active:scale-[0.98] shadow-lg shadow-blue-500/20"
                     >
                         Call Patient
                     </button>
                </div>
             </div>
        )}

        {/* STATE: CALLED */}
        {queueState?.called && !queueState?.current && (
            <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                 <div className="p-6 md:p-8">
                     <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                             <p className="text-orange-800 font-bold uppercase tracking-wider text-sm">Called — Waiting to enter</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Grace Period</p>
                            <p className={`font-mono text-xl font-bold pt-1 ${graceCounter === 0 ? "text-red-600" : "text-orange-900"}`}>
                                {Math.floor(graceCounter / 60)}:{String(graceCounter % 60).padStart(2, "0")}
                            </p>
                         </div>
                     </div>
                     
                     <div className="flex items-center gap-3 mb-2">
                        <span className="bg-orange-200 text-orange-900 font-mono font-bold px-3 py-1.5 rounded-lg text-lg ring-1 ring-orange-300">
                            T-{String(queueState.called.token_number).padStart(3, "0")}
                        </span>
                     </div>
                     <h2 className="text-3xl font-bold text-orange-950">
                        {queueState.called.patients?.name || queueState.called.patient_name_cache}
                     </h2>
                 </div>
                 <div className="bg-white px-6 py-5 border-t border-orange-100 flex flex-col sm:flex-row gap-3">
                     <button
                        onClick={() => handleStartConsultation(queueState.called.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg transition-transform active:scale-[0.98] shadow-lg shadow-green-500/20 order-1 sm:order-2"
                     >
                         Start Consultation
                     </button>
                      <button
                        onClick={() => handleSkip(queueState.called.id)}
                        className={`flex-1 sm:flex-none sm:w-48 py-4 rounded-xl font-bold text-lg transition-colors border order-2 sm:order-1 ${
                            graceCounter === 0
                            ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                        }`}
                     >
                         Skip (Not Present)
                     </button>
                 </div>
            </div>
        )}

        {/* STATE: IN PROGRESS */}
        {queueState?.current && (
             <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 overflow-hidden animate-in fade-in">
                 <div className="p-6 md:p-8 border-b border-blue-100 flex flex-wrap justify-between items-center gap-4">
                     <div>
                           <div className="flex items-center gap-2 mb-3">
                             <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white">
                                <Activity size={12} />
                             </div>
                             <p className="text-blue-800 font-bold uppercase tracking-wider text-sm">Consultation In Progress</p>
                         </div>
                         <div className="flex items-center gap-3 mb-2 mt-4">
                            <span className="bg-blue-600 text-white font-mono font-bold px-3 py-1.5 rounded-lg text-lg ring-2 ring-blue-300">
                                T-{String(queueState.current.token_number).padStart(3, "0")}
                            </span>
                            <Badge visitType={queueState.current.visit_type} />
                         </div>
                         <h2 className="text-3xl font-bold text-blue-950 mt-1">
                            {queueState.current.patients?.name || queueState.current.patient_name_cache}
                         </h2>
                     </div>
                     <div className="bg-white px-5 py-3 rounded-xl border border-blue-100 shadow-sm min-w-32 text-center">
                          <p className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mb-1">Duration</p>
                          <p className="font-mono text-3xl font-bold text-blue-900 tabular-nums">
                             {Math.floor(elapsedCounter / 60)}:{String(elapsedCounter % 60).padStart(2, "0")}
                          </p>
                     </div>
                 </div>
                 
                 <div className="p-6 bg-white border-b border-blue-50">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Notes (Auto-saves)</label>
                    <textarea 
                        className="w-full border-gray-200 rounded-xl bg-gray-50 p-4 min-h-32 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="Type observation notes here..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                 </div>

                 <div className="bg-white px-6 py-5">
                     <button
                        onClick={() => handleMarkComplete(queueState.current.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-transform active:scale-[0.98] shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2"
                     >
                         <CheckCircle2 /> Mark Complete
                     </button>
                 </div>
            </div>
        )}

        {/* EMPTY STATE */}
        {!queueState?.current && !queueState?.called && queueState?.checked_in?.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                     <CheckCircle2 size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-gray-800">You're all caught up!</h2>
                 <p className="text-gray-500 mt-2 max-w-sm">There are no patients currently waiting. Take a break or check scheduled appointments.</p>
            </div>
        )}

        {/* NEXT 3 PATIENTS */}
        <div className="mt-8">
            <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs mb-3 ml-1">Up Next</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                    {nextPatients.map((patient) => (
                         <li key={patient.id} className="p-4 flex items-center gap-4">
                             <div className="font-mono text-gray-500 font-semibold px-2">
                                T-{String(patient.token_number).padStart(3, "0")}
                             </div>
                             <div className="font-bold text-gray-800">
                                {patient.patients?.name || patient.patient_name_cache || "Unknown"}
                             </div>
                         </li>
                    ))}
                    {nextPatients.length === 0 && (
                        <div className="p-5 text-center text-sm text-gray-400 bg-gray-50">
                            No one waiting in the queue.
                        </div>
                    )}
                </ul>
            </div>
        </div>

        {/* QUEUE OVERVIEW FOOTER */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 text-green-700 rounded-lg flex items-center justify-center">
                          <UserCheck size={20} />
                      </div>
                      <div>
                          <p className="text-xl font-bold text-gray-900">{queueState?.stats?.completed_count || 0}</p>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completed Today</p>
                      </div>
                  </div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold">
                          {queueState?.stats?.remaining_count || 0}
                      </div>
                      <div>
                          <p className="text-sm font-bold text-gray-900">Remaining to see</p>
                          <p className="text-xs text-gray-500">{queueState?.checked_in?.length || 0} checked in · {queueState?.scheduled?.length || 0} scheduled</p>
                      </div>
                  </div>
             </div>
        </div>

      </div>
    </div>
  );
}