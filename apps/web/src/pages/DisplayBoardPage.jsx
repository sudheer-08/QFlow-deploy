import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import api from "../services/api";
import { supabase } from "../services/supabase";

// Full screen Waiting Room UI
// URL: /display/:clinicId
export default function DisplayBoardPage() {
  const { clinicId } = useParams();
  const date = format(new Date(), "yyyy-MM-dd");
  
  const [data, setData] = useState({ doctors: [] });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep time ticking
  useEffect(() => {
    const intv = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(intv);
  }, []);

  const fetchData = async () => {
    try {
        // Fetch all doctors for this clinic and their queue status
        // In a real optimized system, we'd have a specific TV Display API route:
        // /api/queue/display/:clinicId?date=...
        // For this demo, let's assemble it from components we know exist if needed,
        // or assume an endpoint exists
        const res = await api.get(`/queue/display/${clinicId}?date=${date}`);
         setData(res.data.data);
    } catch(err) {
        console.error("Display board sync failed", err);
    }
  }

  useEffect(() => {
     fetchData();
     
     // The display board needs to listen to ALL doctors in this clinic
     // We can just subscribe to the entire clinic tenant for the day
     const channel = supabase
      .channel(`display:${clinicId}:${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `tenant_id=eq.${clinicId}`, // assuming bookings have tenant_id
        },
        () => {
           // Any booking update triggers a refresh of the TV display
           fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [clinicId, date]);

  // Grouping logic for the UI
  // The backend should return { doctors: [ { id, name, room, state: { current, called, checked_in } } ] }
  
  if(!data.doctors.length) {
      return (
         <div className="min-h-screen bg-slate-900 flex items-center justify-center">
              <h1 className="text-4xl text-slate-500 font-bold">Waiting for Queue Data...</h1>
         </div>
      );
  }

  // Find all globally "Called" tokens to highlight at the top or flash
  const calledTokens = data.doctors
     .filter(doc => doc.state?.called)
     .map(doc => ({ ...doc.state.called, doc_name: doc.name, room: doc.room || 'Cabin' }));

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden flex flex-col p-6">
      
      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl mb-8">
          <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Clinic Status Board</h1>
              <p className="text-slate-400 font-medium text-lg mt-1">{format(currentTime, "EEEE, MMMM do")}</p>
          </div>
          <div className="text-right">
              <div className="text-5xl font-black tabular-nums tracking-tight">
                  {format(currentTime, "h:mm")} <span className="text-2xl text-slate-400">{format(currentTime, "a")}</span>
              </div>
          </div>
      </header>


      {/* MAIN CONTENT GRID */}
      <div className="flex-1 grid grid-cols-3 gap-8">
          
          {/* Active Calls column */}
          <div className="col-span-1 flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-slate-300 uppercase tracking-widest pl-2">Now Calling</h2>
            
            {calledTokens.length === 0 ? (
                <div className="flex-1 bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-700 flex items-center justify-center opacity-50">
                    <p className="text-2xl font-semibold text-slate-500">No active calls</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {calledTokens.map(token => (
                         <div key={token.id} className="bg-gradient-to-br from-orange-500 to-red-500 p-8 rounded-3xl shadow-xl shadow-orange-500/20 text-center animate-pulse border-2 border-orange-400">
                             <div className="text-xs font-black uppercase tracking-[0.3em] text-orange-200 mb-2">Proceed To</div>
                             <div className="text-3xl font-bold text-white mb-6 bg-white/20 py-2 px-4 rounded-xl inline-block backdrop-blur-sm">
                                 {token.room}
                             </div>
                             
                             <div className="text-sm font-semibold uppercase tracking-widest text-orange-200 mb-1">Token Number</div>
                             <div className="text-7xl font-black tabular-nums mb-4 text-white drop-shadow-md">
                                 T-{String(token.token_number).padStart(3, "0")}
                             </div>
                             
                             <div className="text-2xl font-bold text-whitetruncate">
                                 Dr. {token.doc_name.split(' ')[0]}
                             </div>
                         </div>
                    ))}
                </div>
            )}
          </div>

          {/* Doctor status columns */}
          <div className="col-span-2 grid grid-cols-2 gap-6">
               {data.doctors.map(doctor => {
                   const { state } = doctor;
                   const inProgress = Object.keys(state || {}).length > 0 ? state.current : null;
                   const upNext = state?.checked_in?.slice(0, 3) || [];

                   return (
                       <div key={doctor.id} className="bg-slate-800 rounded-3xl border border-slate-700 flex flex-col overflow-hidden pb-4">
                           
                           {/* Doc Header */}
                           <div className="bg-slate-800 p-5 px-6 border-b border-slate-700/50 flex justify-between items-center">
                               <div>
                                   <h3 className="text-2xl font-bold text-slate-100">Dr. {doctor.name.split(' ')[0]}</h3>
                                   <p className="text-slate-400 font-medium">{doctor.room || 'Consultation'}</p>
                               </div>
                           </div>

                           {/* In Progress */}
                           <div className="px-6 py-5">
                               <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">In Progress</div>
                               {inProgress ? (
                                   <div className="bg-slate-700/50 rounded-2xl p-5 border border-slate-600 flex items-center justify-between">
                                       <span className="text-4xl font-black text-blue-400">
                                          T-{String(inProgress.token_number).padStart(3, "0")}
                                       </span>
                                       <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"></span>
                                   </div>
                               ) : (
                                   <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700/50 flex items-center justify-center">
                                        <span className="text-xl font-bold text-slate-600">Available</span>
                                   </div>
                               )}
                           </div>

                           {/* Up Next */}
                           <div className="px-6 flex-1">
                               <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Next in Queue</div>
                               
                               {upNext.length === 0 ? (
                                   <div className="text-center py-6 text-slate-600 font-medium text-lg">No one waiting</div>
                               ) : (
                                   <div className="space-y-3">
                                       {upNext.map((patient, idx) => (
                                           <div key={patient.id} className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between border border-slate-700/30">
                                               <span className="text-2xl font-bold font-mono text-slate-300">
                                                  T-{String(patient.token_number).padStart(3, "0")}
                                               </span>
                                               {idx === 0 && <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-lg">NEXT</span>}
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       </div>
                   );
               })}
          </div>
      </div>
    </div>
  );
}