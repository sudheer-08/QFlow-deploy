import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase'; // Assuming you have a supabase client export
import { Clock, User, Users, TrendingUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import './AppointmentTrackerPage.css';

const fetchBookingDetails = async (bookingId) => {
    const { data, error } = await supabase
        .from('bookings')
        .select(`
            *,
            doctors ( name, avg_consultation_time_minutes ),
            clinics ( name )
        `)
        .eq('id', bookingId)
        .single();
    if (error) throw new Error(error.message);
    return data;
};

const fetchQueuePosition = async (doctorId, bookingId) => {
    const { data, error } = await supabase
        .from('bookings')
        .select('id, status, token_number')
        .eq('doctor_id', doctorId)
        .in('status', ['checked_in', 'called', 'in_progress'])
        .order('queue_position', { ascending: true });

    if (error) throw error;

    const currentlyServing = data.find(b => ['called', 'in_progress'].includes(b.status));
    const waitingList = data.filter(b => b.status === 'checked_in');
    const myIndex = waitingList.findIndex(b => b.id === bookingId);
    const myPosition = myIndex !== -1 ? myIndex + 1 : null;

    return {
        position: myPosition,
        currentlyServingToken: currentlyServing?.token_number,
        peopleAhead: myIndex !== -1 ? myIndex : 0,
    };
};


export default function AppointmentTrackerPage() {
    const { bookingId } = useParams();
    const [liveData, setLiveData] = useState({ position: null, currentlyServingToken: null, peopleAhead: 0 });
    
    const { data: booking, isLoading, isError, refetch: refetchBooking } = useQuery({
        queryKey: ['booking-tracker', bookingId],
        queryFn: () => fetchBookingDetails(bookingId),
        enabled: !!bookingId,
    });

    useEffect(() => {
        if (!booking) return;

        const updateQueueData = () => {
            fetchQueuePosition(booking.doctor_id, booking.id).then(setLiveData);
        };

        updateQueueData(); // Initial fetch

        const channel = supabase
            .channel(`booking-updates-${bookingId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `doctor_id=eq.${booking.doctor_id}`
            },
            (payload) => {
                console.log('Change received!', payload);
                // If this booking's status changed, refetch everything
                if (payload.new.id === bookingId) {
                    refetchBooking();
                }
                // In any case, update the queue position
                updateQueueData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [booking, bookingId, refetchBooking]);

    if (isLoading) return <div className="tracker-loading">Loading your appointment status...</div>;
    if (isError) return <div className="tracker-error">Could not find your appointment. Please check the link.</div>;

    const avgTime = booking.doctors.avg_consultation_time_minutes || 10;
    const etaMinutes = liveData?.position ? (liveData.position * avgTime) : 0;

    const statusInfo = {
        scheduled: { text: "You're scheduled. Please check in at the clinic.", color: 'blue', Icon: Clock },
        checked_in: { text: "You're in the queue!", color: 'orange', Icon: Users },
        called: { text: "It's your turn! Please proceed to the doctor's room.", color: 'green', Icon: User },
        in_progress: { text: "You are currently with the doctor.", color: 'purple', Icon: User },
        completed: { text: "Your consultation is complete.", color: 'gray', Icon: CheckCircle },
        skipped: { text: "You were skipped. Please contact reception.", color: 'red', Icon: AlertTriangle },
        no_show: { text: "You missed your appointment.", color: 'red', Icon: XCircle },
    }[booking.status] || { text: 'Status unknown', color: 'gray', Icon: AlertTriangle };


    return (
        <div className="tracker-shell">
            <header className="tracker-header">
                <h1>{booking.clinics.name}</h1>
                <p>Live Appointment Status</p>
            </header>

            <div className="tracker-body">
                <div className={`tracker-status-banner status-${statusInfo.color}`}>
                    <statusInfo.Icon />
                    <span>{statusInfo.text}</span>
                </div>

                <div className="tracker-grid">
                    <div className="tracker-card main">
                        <div className="tracker-card-icon"><User /></div>
                        <div className="tracker-card-label">Your Position</div>
                        <div className="tracker-card-value large">
                            {liveData?.position ? `#${liveData.position}` : 'N/A'}
                        </div>
                        <div className="tracker-card-subtext">in the queue for Dr. {booking.doctors.name}</div>
                    </div>

                    <div className="tracker-card">
                        <div className="tracker-card-icon"><Clock /></div>
                        <div className="tracker-card-label">Estimated Wait</div>
                        <div className="tracker-card-value">~{etaMinutes} min</div>
                    </div>

                    <div className="tracker-card">
                        <div className="tracker-card-icon"><TrendingUp /></div>
                        <div className="tracker-card-label">Now Serving</div>
                        <div className="tracker-card-value token">
                            {liveData?.currentlyServingToken || '...'}
                        </div>
                    </div>

                    <div className="tracker-card">
                        <div className="tracker-card-icon"><Users /></div>
                        <div className="tracker-card-label">People Ahead</div>
                        <div className="tracker-card-value">
                            {liveData?.peopleAhead || 0}
                        </div>
                    </div>
                </div>

                <div className="tracker-footer">
                    <p>This page updates automatically. Last update: {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        </div>
    );
}

