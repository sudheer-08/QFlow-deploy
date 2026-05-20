import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useToast } from '../components/Toast';
import { Loader, CheckCircle, AlertTriangle } from 'lucide-react';

const checkInPatient = async ({ doctorId, clinicSubdomain, patientDetails }) => {
    const { data, error } = await supabase.functions.invoke('checkin-patient-qr', {
        body: { doctorId, clinicSubdomain, patientDetails },
    });
    if (error) throw new Error(error.message);
    return data;
};

export default function CheckinPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();
    const [patientDetails, setPatientDetails] = useState({ phone: '', name: '' });

    const { doctorId, clinicSubdomain } = React.useMemo(() => {
        const params = new URLSearchParams(location.search);
        return {
            doctorId: params.get('doctor'),
            clinicSubdomain: params.get('clinic'),
        };
    }, [location.search]);

    const mutation = useMutation({
        mutationFn: checkInPatient,
        onSuccess: (data) => {
            toast.success(`Checked in successfully! Your token is #${data.token_number}.`);
            navigate(`/track/${data.bookingId}`);
        },
        onError: (error) => {
            toast.error(error.message || 'Check-in failed. Please see reception.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!patientDetails.phone || !patientDetails.name) {
            toast.warning('Please enter your name and phone number.');
            return;
        }
        mutation.mutate({ doctorId, clinicSubdomain, patientDetails });
    };

    if (!doctorId || !clinicSubdomain) {
        return <div className="checkin-status error"><AlertTriangle /> Invalid check-in link.</div>;
    }

    return (
        <div className="checkin-container">
            <div className="checkin-card">
                <h1 className="checkin-title">Quick Check-In</h1>
                <p className="checkin-subtitle">Enter your details to confirm your arrival.</p>
                <form onSubmit={handleSubmit} className="checkin-form">
                    <input
                        type="text"
                        placeholder="Your Name"
                        value={patientDetails.name}
                        onChange={(e) => setPatientDetails(prev => ({ ...prev, name: e.target.value }))}
                        required
                    />
                    <input
                        type="tel"
                        placeholder="Your Phone Number"
                        value={patientDetails.phone}
                        onChange={(e) => setPatientDetails(prev => ({ ...prev, phone: e.target.value }))}
                        required
                    />
                    <button type="submit" disabled={mutation.isLoading}>
                        {mutation.isLoading ? (
                            <Loader className="animate-spin" size={20} />
                        ) : (
                            <CheckCircle size={20} />
                        )}
                        <span>{mutation.isLoading ? 'Checking In...' : 'Confirm Arrival'}</span>
                    </button>
                </form>
            </div>
            <style>{`
                .checkin-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f3f4f6; padding: 1rem; }
                .checkin-card { background: white; border-radius: 1rem; padding: 2rem; max-width: 400px; width: 100%; text-align: center; }
                .checkin-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
                .checkin-subtitle { color: #6b7280; margin: 0.5rem 0 1.5rem; }
                .checkin-form { display: flex; flex-direction: column; gap: 1rem; }
                .checkin-form input { padding: 0.75rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 1rem; }
                .checkin-form button { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem; background-color: #16a34a; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; }
                .checkin-form button:disabled { background-color: #86efac; cursor: not-allowed; }
                .checkin-status { display: flex; align-items: center; justify-content: center; min-height: 100vh; gap: 8px; }
                .checkin-status.error { color: #b91c1c; }
            `}</style>
        </div>
    );
}
