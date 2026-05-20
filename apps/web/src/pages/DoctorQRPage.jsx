import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../services/supabase';
import { Loader, WifiOff } from 'lucide-react';

const fetchDoctorProfile = async (doctorId) => {
    const { data, error } = await supabase
        .from('doctors')
        .select('id, name, clinics (name, subdomain)')
        .eq('id', doctorId)
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export default function DoctorQRPage() {
    const { doctorId } = useParams();

    const { data: doctor, isLoading, isError } = useQuery({
        queryKey: ['doctor-profile', doctorId],
        queryFn: () => fetchDoctorProfile(doctorId),
        enabled: !!doctorId,
    });

    if (isLoading) {
        return <div className="qr-page-status"><Loader className="animate-spin" /> Loading Doctor Profile...</div>;
    }

    if (isError) {
        return <div className="qr-page-status error"><WifiOff /> Could not load profile.</div>;
    }

    const checkinUrl = `${window.location.origin}/checkin?doctor=${doctor.id}&clinic=${doctor.clinics.subdomain}`;

    return (
        <div className="qr-page-container">
            <div className="qr-card">
                <div className="qr-header">
                    <h2>Dr. {doctor.name}</h2>
                    <p>{doctor.clinics.name}</p>
                </div>
                <div className="qr-code-wrapper">
                    <QRCodeSVG
                        value={checkinUrl}
                        size={256}
                        level="H"
                        includeMargin={true}
                    />
                </div>
                <div className="qr-instructions">
                    <h3>Scan to Check-In</h3>
                    <p>Point your phone's camera at this QR code to securely check in for your appointment.</p>
                </div>
            </div>
            <style>{`
                .qr-page-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #eef2ff; padding: 1rem; }
                .qr-card { background: white; border-radius: 1.5rem; padding: 2rem; text-align: center; max-width: 400px; width: 100%; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
                .qr-header h2 { font-size: 1.5rem; font-weight: 700; margin: 0; }
                .qr-header p { font-size: 1rem; color: #64748b; margin: 0.25rem 0 0; }
                .qr-code-wrapper { margin: 2rem 0; }
                .qr-instructions h3 { font-size: 1.25rem; font-weight: 600; margin: 0; }
                .qr-instructions p { font-size: 0.9rem; color: #64748b; margin: 0.5rem 0 0; }
                .qr-page-status { display: flex; align-items: center; justify-content: center; min-height: 100vh; gap: 8px; color: #4b5563; }
                .qr-page-status.error { color: #b91c1c; }
            `}</style>
        </div>
    );
}
