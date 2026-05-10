import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';

const VitalsForm = ({ bookingId, onSave }) => {
    const [vitals, setVitals] = useState({});
    const toast = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (vitalsData) => {
            // This would call the saveVitals Edge Function
            return fetch('/api/functions/saveVitals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` },
                body: JSON.stringify({ bookingId, vitalsData }),
            }).then(res => res.json());
        },
        onSuccess: () => {
            toast.success('Vitals saved successfully.');
            queryClient.invalidateQueries(['checkedInPatients']);
            onSave();
        },
        onError: () => {
            toast.error('Failed to save vitals.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(vitals);
    };

    const renderInput = (name, label) => (
        <label className="block">
            <span className="text-gray-700">{label}</span>
            <input
                type="number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                onChange={(e) => setVitals({ ...vitals, [name]: parseFloat(e.target.value) })}
            />
        </label>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {renderInput('bp_systolic', 'BP Systolic')}
            {renderInput('bp_diastolic', 'BP Diastolic')}
            {renderInput('temperature_c', 'Temperature (°C)')}
            {renderInput('spo2_percent', 'SpO2 (%)')}
            {renderInput('pulse_bpm', 'Pulse (BPM)')}
            {renderInput('weight_kg', 'Weight (kg)')}
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md">
                Save Vitals
            </button>
        </form>
    );
};


export default function VitalsCapturePage() {
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const { data: patients, isLoading } = useQuery({
        queryKey: ['checkedInPatients'],
        queryFn: () => {
            // Fetch patients with status 'checked_in' and no vitals
            return fetch('/api/bookings?status=checked_in&vitals_captured_at=is.null').then(res => res.json());
        },
        refetchInterval: 10000,
    });

    if (isLoading) return <div>Loading patients...</div>;

    const selectedPatient = patients?.find(p => p.id === selectedPatientId);

    return (
        <div className="flex h-screen">
            <div className="w-1/3 border-r">
                <h2 className="p-4 text-lg font-semibold border-b">Checked-in Patients ({patients?.length || 0})</h2>
                <ul>
                    {patients?.map(patient => (
                        <li key={patient.id} className={`p-4 cursor-pointer ${selectedPatientId === patient.id ? 'bg-blue-100' : ''}`} onClick={() => setSelectedPatientId(patient.id)}>
                            <p className="font-semibold">{patient.patient_name}</p>
                            <p className="text-sm text-gray-500">Token: {patient.token_number}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="w-2/3 p-4">
                <h2 className="text-lg font-semibold">Capture Vitals</h2>
                {selectedPatient ? (
                    <VitalsForm bookingId={selectedPatient.id} onSave={() => setSelectedPatientId(null)} />
                ) : (
                    <p className="mt-4 text-gray-500">Select a patient from the list to capture their vitals.</p>
                )}
            </div>
        </div>
    );
}
