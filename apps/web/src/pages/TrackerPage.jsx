import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { supabase } from "../services/supabase";
import { format } from "date-fns";
import "./TrackerPage.css";

// Public page — no login needed
// URL: /track/:bookingId
export default function TrackerPage() {
  const { trackerToken: bookingId } = useParams(); // URL param is often 'trackerToken' in routes, but acts as booking ID
  const [liveBooking, setLiveBooking] = useState(null);
  const [realtimeEta, setRealtimeEta] = useState(null);
  const [tokensAhead, setTokensAhead] = useState(null);

  // Fetch initial data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tracker", bookingId],
    queryFn: async () => {
      // In a real app we'd have a specific /api/queue/track/:bookingId route
      // that returns sanitized public data. For now, fetch full state of the doctor to piece it together.
      
      // 1. Get the booking to find the doctor & date
       const { data: booking, error: bErr } = await supabase
         .from('bookings')
         .select('*, patients:patient_id(*), clinics:tenant_id(name)')
         .eq('id', bookingId)
         .single();
         
       if(bErr) throw bErr;
       
       // 2. We can hit our backend for the ETA recalculation and counts
       // To do this simply on client side without a dedicated endpoint for this prompt:
       const { data: qData, error: qErr } = await api.get(`/queue/state/${booking.doctor_id}/${booking.session_date}`);
       if(qErr) throw qErr;

       return { booking, queueState: qData.data };
    },
    refetchInterval: 60000, // Fallback heartbeat
  });

  // Derived state
  const currentBooking = liveBooking || data?.booking;
  const queueState = data?.queueState;
  
  useEffect(() => {
     if(currentBooking && queueState) {
         // Find this booking in the queue state arrays to get ETA and position
         let matchingBooking = null;
         let positionInWaiters = -1;
         
         const allWaiters = [...queueState.checked_in, ...queueState.scheduled];

         for (let i = 0; i < allWaiters.length; i++) {
             if (allWaiters[i].id === currentBooking.id) {
                 matchingBooking = allWaiters[i];
                 if(currentBooking.status === 'checked_in') {
                    // How many checked_in patients are ahead of us?
                    const checkedInAhead = queueState.checked_in.findIndex(b => b.id === currentBooking.id);
                    positionInWaiters = checkedInAhead >= 0 ? checkedInAhead : 0;
                 }
                 break;
             }
         }
         
         if(currentBooking.status === 'called' || currentBooking.status === 'in_progress') {
             setTokensAhead(0);
         } else if (positionInWaiters !== -1) {
             // Add 1 if someone is currently with the doctor or called
             let ahead = positionInWaiters;
             if(queueState.current) ahead++;
             if(queueState.called) ahead++;
             setTokensAhead(ahead);
         }
         
         if(matchingBooking?.estimated_time) {
             setRealtimeEta(matchingBooking.estimated_time);
         }
     }
  }, [currentBooking, queueState])


  useEffect(() => {
    if (!currentBooking?.doctor_id || !currentBooking?.session_date) return;

    // Realtime subscription
    const channel = supabase
      .channel(`queue:${currentBooking.doctor_id}:${currentBooking.session_date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `doctor_id=eq.${currentBooking.doctor_id}`,
        },
        (payload) => {
          // If our own status changed, update local booking state directly
          if(payload.new.id === bookingId) {
             setLiveBooking(prev => ({ ...(prev || data.booking), ...payload.new }));
          }
          // The queue state changed, trigger refetch to get updated ETAs and positions
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBooking?.doctor_id, currentBooking?.session_date, bookingId, refetch]);

  const handleCheckIn = async () => {
       try {
           await api.post(`/queue/check-in/${bookingId}`);
           refetch();
       } catch (err) {
           alert(err.response?.data?.error || "Failed to check in");
       }
  }


  if (isLoading) {
    return (
      <div className="tp-state-screen flex justify-center items-center min-h-screen bg-gray-50">
         <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full mx-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading live queue status...</p>
         </div>
      </div>
    );
  }

  if (error || !currentBooking) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
         <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Token not found</h2>
            <p className="text-gray-500">This link may have expired or is invalid.</p>
         </div>
      </div>
    );
  }

  const { status, patients, token_number, clinics } = currentBooking;

  // Render varying screen states based on status
  
  if (status === "called") {
    return (
      <div className="min-h-screen bg-orange-50 p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-orange-500 shadow-xl shadow-orange-500/20 text-4xl animate-bounce mb-6 border border-orange-100">
           🔔
        </div>
        <h1 className="text-3xl font-bold text-orange-950 mb-2">Your Turn!</h1>
        <p className="text-xl text-orange-850 font-medium mb-8">Please proceed to the consultation room immediately.</p>
        
        <div className="bg-white px-10 py-6 rounded-2xl shadow-sm border border-orange-200">
            <p className="text-xs uppercase tracking-widest font-bold text-orange-500 mb-1">Your Token</p>
            <p className="font-mono text-5xl font-black text-orange-900">
               T-{String(token_number).padStart(3, "0")}
            </p>
        </div>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="min-h-screen bg-blue-50 p-6 flex items-center justify-center">
         <div className="bg-white p-10 rounded-3xl shadow-sm border border-blue-100 text-center max-w-sm w-full">
            <div className="text-5xl mb-6">🩺</div>
            <h2 className="text-2xl font-bold text-blue-950 mb-2">Consultation In Progress</h2>
            <p className="text-blue-800/80 font-medium">You are currently being seen by the doctor.</p>
         </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="min-h-screen bg-green-50 p-6 flex items-center justify-center">
         <div className="bg-white p-10 rounded-3xl shadow-sm border border-green-100 text-center max-w-sm w-full">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex justify-center items-center mx-auto text-4xl mb-6">
                ✅
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Consultation Complete</h2>
            <p className="text-green-800/80 font-medium">Thank you for visiting {clinics?.name}</p>
         </div>
      </div>
    );
  }

  if (status === "skipped" || status === "no_show") {
    return (
      <div className="min-h-screen bg-red-50 p-6 flex flex-col justify-center items-center text-center">
         <div className="text-5xl mb-6">⚠️</div>
         <h1 className="text-2xl font-bold text-red-950 mb-4">You missed your turn</h1>
         <p className="text-red-900/80 mb-6 max-w-xs">
            You were not present when your token T-{String(token_number).padStart(3, "0")} was called.
         </p>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 max-w-sm">
             <p className="font-medium text-gray-800">
                Come to the reception desk and we will add you back to the active queue.
             </p>
         </div>
      </div>
    );
  }

  // Calculate generic progress percentage for check_in state visual
  const progressPercent = tokensAhead === 0 ? 100 : Math.max(5, 100 - (tokensAhead * 10));

  return (
    <div className="tp-shell bg-gray-50 min-h-screen font-sans flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="pt-10 px-8 pb-8 bg-blue-600 text-white rounded-b-[40px] relative z-10 shadow-lg shadow-blue-600/20">
          <p className="text-blue-200 font-semibold mb-1 opacity-90">{clinics?.name}</p>
          <div className="flex justify-between items-end mb-4 mt-2">
             <h1 className="font-mono text-5xl font-black tracking-tight">T-{String(token_number).padStart(3, "0")}</h1>
          </div>
          <p className="text-xl font-bold tracking-tight">Hi {patients?.name?.split(' ')[0]} 👋</p>
        </div>

        <div className="px-6 py-6 -mt-8 relative z-20">
             
             {/* Scheduled state block */}
             {status === "scheduled" && (
                 <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center mb-6">
                     <span className="w-16 h-16 bg-gray-50 flex items-center justify-center rounded-full text-2xl mb-4 border border-gray-100">
                         📍
                     </span>
                     <h2 className="text-xl font-bold text-gray-900 mb-2">Not checked in yet</h2>
                     <p className="text-gray-500 mb-6 text-sm">
                         Expected around {realtimeEta ? format(new Date(realtimeEta), "h:mm a") : "TBD"}
                     </p>
                     
                     <button onClick={handleCheckIn} className="w-full py-4 rounded-xl text-lg font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition active:scale-95">
                         I've Arrived at Clinic
                     </button>
                     <p className="mt-4 text-xs font-semibold text-gray-400">Wait times update live once checked in</p>
                 </div>
             )}

             {/* Checked In state block */}
             {status === "checked_in" && (
                 <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 mb-6">
                     <div className="flex items-center justify-center gap-2 mb-6 text-green-600 font-bold bg-green-50 w-max mx-auto px-4 py-1.5 rounded-full">
                         <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                         Checked In
                     </div>

                     <div className="text-center mb-8">
                         <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-1">Queue Position</p>
                         <div className="flex items-end justify-center gap-1 font-black">
                            <span className="text-4xl text-gray-900">{tokensAhead}</span>
                            <span className="text-xl text-gray-400 mb-1">ahead of you</span>
                         </div>
                     </div>

                     {/* Progress bar */}
                     <div className="h-4 bg-gray-100 rounded-full w-full overflow-hidden mb-8 ring-1 ring-inset ring-gray-200">
                          <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: `${progressPercent}%` }}
                          />
                     </div>

                     <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-center">
                          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Estimated Turn</p>
                          <div className="text-2xl font-bold text-gray-900" style={{ fontFeatureSettings: '"tnum"'}}>
                              ~ {realtimeEta ? format(new Date(realtimeEta), "h:mm a") : "Calculating"}
                          </div>
                     </div>
                     <p className="text-center mt-5 text-sm font-medium text-gray-400">You will be notified when your turn is close</p>
                 </div>
             )}

            {/* General Info Footer */}
            <div className="px-2 mt-4 space-y-3">
               <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                     <span className="text-gray-500 font-medium text-sm">Don't close this page</span>
                     <span className="text-blue-600 font-bold text-sm bg-blue-50 px-2 py-1 rounded">Updates Live</span>
               </div>
            </div>

        </div>
      </div>
    </div>
  );
}