import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import api from "../../../services/api";
import { supabase } from "../../../services/supabase";
import { Copy, Plus, Menu, LayoutGrid, Calendar, RefreshCcw } from "lucide-react";

export default function AdminQueuePage() {
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const [queueData, setQueueData] = useState({
      stats: {},
      current: null,
      called: null,
      checked_in: [],
      scheduled: [],
      completed: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Initial Load - get clinics
  useEffect(() => {
     const init = async () => {
         try {
             // In a real app we'd fetch actual clinics list
             const { data: clinicsData, error } = await supabase.from('clinics').select('id, name');
             if(error) throw error;
             
             setClinics(clinicsData);
             if(clinicsData.length > 0) setSelectedClinic(clinicsData[0].id);
         } catch(err) {
             console.error("Failed to load clinics", err);
         }
     };
     init();
  }, []);

  // 2. When Clinic changes, load its doctors
  useEffect(() => {
     if(!selectedClinic) return;
     
     const loadDocs = async () => {
         try {
             const { data: docsData, error } = await supabase
                .from('users')
                .select('id, name')
                .eq('role', 'doctor')
                .eq('tenant_id', selectedClinic);
                
             if(error) throw error;
             setDoctors(docsData);
             if(docsData.length > 0) setSelectedDoctor(docsData[0].id);
         } catch(err) {
             console.error("Failed to load doctors", err);
         }
     }
     loadDocs();
  }, [selectedClinic]);


  // 3. Load Queue Data for Doctor + Date
  const fetchQueueState = async () => {
      if(!selectedDoctor || !selectedDate) return;
      setIsRefreshing(true);
      try {
          const res = await api.get(`/queue/state/${selectedDoctor}/${selectedDate}`);
          setQueueData(res.data.data);
      } catch (err) {
          console.error("Failed to fetch queue state", err);
      } finally {
          setIsLoading(false);
          setIsRefreshing(false);
      }
  };

  useEffect(() => {
      setIsLoading(true);
      fetchQueueState();
  }, [selectedDoctor, selectedDate]);


  // 4. Realtime updates (admin needs to see what doctor is doing instantly)
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) return;

    const channel = supabase
      .channel(`admin_queue:${selectedDoctor}:${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `doctor_id=eq.${selectedDoctor}`,
        },
        () => {
          fetchQueueState(); // Refetch the whole state on any change for simplicity
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDoctor, selectedDate]);


  // Admin Actions
  
  const handleCheckIn = async (bookingId) => {
      try {
          await api.post(`/queue/check-in/${bookingId}`);
          // state will update via realtime
      } catch (err) {
          alert('Check in failed: ' + (err.response?.data?.error || err.message));
      }
  }

  const handleCopyLink = (bookingId) => {
      const link = `${window.location.origin}/track/${bookingId}`;
      navigator.clipboard.writeText(link);
      alert("Tracker link copied!");
  }


  // Renders
  
  const StatusPill = ({ status }) => {
      const styles = {
          scheduled: "bg-gray-100 text-gray-700",
          checked_in: "bg-blue-100 text-blue-700",
          called: "bg-orange-100 text-orange-700 animate-pulse ring-1 ring-orange-400",
          in_progress: "bg-purple-100 text-purple-700 ring-1 ring-purple-400",
          completed: "bg-green-100 text-green-700",
          no_show: "bg-red-100 text-red-700",
          cancelled: "bg-red-100 text-red-700"
      };
      
      const labels = {
          scheduled: "Scheduled",
          checked_in: "Waiting",
          called: "Called",
          in_progress: "In Progress",
          completed: "Completed",
          no_show: "Missed",
          cancelled: "Cancelled"
      };

      return (
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${styles[status] || styles.scheduled}`}>
              {labels[status] || status}
          </span>
      )
  }

  const TableRow = ({ booking, showCheckIn = false }) => {
      return (
          <tr className="border-b border-gray-100 hover:bg-slate-50 transition-colors group">
              <td className="p-4 whitespace-nowrap">
                  <div className="font-mono font-bold text-slate-800">
                     T-{String(booking.token_number).padStart(3, "0")}
                  </div>
              </td>
              <td className="p-4">
                  <div className="font-bold text-slate-900">{booking.patients?.name || booking.patient_name_cache || 'Unknown'}</div>
                  <div className="text-xs text-slate-500">{booking.visit_type}</div>
              </td>
              <td className="p-4 text-center">
                  <StatusPill status={booking.status} />
              </td>
              <td className="p-4 text-center font-mono text-sm font-semibold text-slate-600">
                  {booking.estimated_time ? format(new Date(booking.estimated_time), "HH:mm") : '--:--'}
              </td>
              <td className="p-4 text-right space-x-2">
                  <button 
                      onClick={() => handleCopyLink(booking.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Copy Tracker Link"
                  >
                      <Copy size={16} />
                  </button>
                  {showCheckIn && (
                      <button 
                          onClick={() => handleCheckIn(booking.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm"
                      >
                          Check In
                      </button>
                  )}
              </td>
          </tr>
      )
  }


  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 font-sans overflow-hidden">
        
        {/* SIDEBAR - CONTROLS */}
        <div className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto">
             <div>
                 <h2 className="text-xl font-bold text-slate-900 mb-1">Queue Manager</h2>
                 <p className="text-sm text-slate-500 mb-6">Manage patient flow & waitlist</p>

                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Clinic</label>
                         <select 
                            className="w-full border-slate-200 rounded-xl bg-slate-50 focus:ring-blue-500 font-medium"
                            value={selectedClinic}
                            onChange={e => setSelectedClinic(e.target.value)}
                         >
                             {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                     </div>

                      <div>
                         <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Doctor</label>
                         <select 
                            className="w-full border-slate-200 rounded-xl bg-slate-50 focus:ring-blue-500 font-medium"
                            value={selectedDoctor}
                            onChange={e => setSelectedDoctor(e.target.value)}
                         >
                             {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                         </select>
                     </div>

                     <div>
                         <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Date</label>
                         <input 
                            type="date"
                            className="w-full border-slate-200 rounded-xl bg-slate-50 focus:ring-blue-500 font-medium"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                         />
                     </div>
                 </div>
             </div>

             <div className="mt-auto pt-6 border-t border-slate-100 space-y-3">
                 <button className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 rounded-xl transition-colors">
                     <Plus size={18} /> New Walk-In
                 </button>
             </div>
        </div>


        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
             
             {/* TOP BAR / STATS */}
             <div className="bg-white border-b border-slate-200 p-6 z-10 sticky top-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl font-bold text-xl">{queueData.checked_in.length || 0}</div>
                          <div>
                              <p className="text-xl font-bold text-slate-900 leading-tight">Waiting</p>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Checked In</p>
                          </div>
                      </div>
                      
                      <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
                      
                       <div className="flex items-center gap-3">
                          <div className="bg-slate-100 text-slate-600 p-2.5 rounded-xl font-bold text-xl">{queueData.scheduled.length || 0}</div>
                          <div>
                              <p className="text-xl font-bold text-slate-900 leading-tight">To Arrive</p>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled</p>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-2">
                       <button 
                          onClick={fetchQueueState}
                          className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl bg-white hover:bg-slate-50 flex items-center gap-2"
                        >
                           <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
                       </button>
                  </div>
             </div>

             {/* MAIN CONTENT SCROLL AREA */}
             <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
                  
                  {isLoading && (
                      <div className="text-center py-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                  )}

                  {!isLoading && (
                      <>
                          {/* ACTIVE PORTION (Called / In Progress) */}
                          {(queueData.current || queueData.called) && (
                              <section>
                                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 pl-1">With Doctor</h3>
                                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                     <table className="w-full text-left">
                                          <tbody className="divide-y divide-slate-100">
                                              {queueData.current && <TableRow booking={queueData.current} />}
                                              {queueData.called && <TableRow booking={queueData.called} />}
                                          </tbody>
                                     </table>
                                 </div>
                              </section>
                          )}

                          {/* QUEUE PORTION (Checked In) */}
                          <section>
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 pl-1 flex items-center gap-2">
                                  Live Queue <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px]">{queueData.checked_in.length}</span>
                              </h3>
                              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                  {queueData.checked_in.length === 0 ? (
                                      <div className="p-8 text-center text-slate-500 font-medium">No patients currently waiting.</div>
                                  ) : (
                                       <table className="w-full text-left">
                                           <thead className="bg-slate-50/80 text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                               <tr>
                                                   <th className="p-4 font-semibold w-24">Token</th>
                                                   <th className="p-4 font-semibold">Patient</th>
                                                   <th className="p-4 font-semibold text-center w-32">Status</th>
                                                   <th className="p-4 font-semibold text-center w-32">ETA</th>
                                                   <th className="p-4 font-semibold text-right w-32">Actions</th>
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {queueData.checked_in.map(b => <TableRow key={b.id} booking={b} />)}
                                           </tbody>
                                       </table>
                                  )}
                              </div>
                          </section>


                          {/* SCHEDULED PORTION (Not checked in) */}
                          <section>
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 pl-1 flex items-center gap-2">
                                  Scheduled to Arrive <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px]">{queueData.scheduled.length}</span>
                              </h3>
                              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden opacity-90">
                                  {queueData.scheduled.length === 0 ? (
                                      <div className="p-8 text-center text-slate-500 font-medium bg-slate-50">No more patients scheduled today.</div>
                                  ) : (
                                       <table className="w-full text-left">
                                           <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                               <tr>
                                                   <th className="p-4 font-semibold w-24">Token</th>
                                                   <th className="p-4 font-semibold">Patient</th>
                                                   <th className="p-4 font-semibold text-center w-32">Status</th>
                                                   <th className="p-4 font-semibold text-center w-32">ETA</th>
                                                   <th className="p-4 font-semibold text-right w-32">Actions</th>
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {queueData.scheduled.map(b => <TableRow key={b.id} booking={b} showCheckIn={true} />)}
                                           </tbody>
                                       </table>
                                  )}
                              </div>
                          </section>

                           {/* PREVIOUS/COMPLETED PORTION */}
                           {queueData.completed.length > 0 && (
                              <section className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-opacity">
                                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 pl-1 flex items-center gap-2">
                                      Completed 
                                  </h3>
                                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                       <table className="w-full text-left">
                                            <tbody>
                                                {queueData.completed.slice(0, 5).map(b => (
                                                    <tr key={b.id} className="border-b border-slate-100 text-sm">
                                                        <td className="p-3 w-24 font-mono font-bold text-slate-500">T-{String(b.token_number).padStart(3, "0")}</td>
                                                        <td className="p-3 font-semibold text-slate-600">{b.patients?.name || b.patient_name_cache}</td>
                                                        <td className="p-3 text-right">
                                                            <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded-full uppercase tracking-wider">Done</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                  </div>
                              </section>
                          )}

                      </>
                  )}
             </div>
        </div>

    </div>
  );
}