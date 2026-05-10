import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '../components/Toast';

const fetchIntakeData = async (bookingToken) => {
    // This is a placeholder. In a real app, you'd have an endpoint
    // to get booking details (including visit_type) by a secure token.
    // For now, we'll simulate it.
    return {
        visit_type: 'new', // or 'followup', 'prescription', etc.
        submitted_data: null // or the already submitted data
    };
};

const IntakeForm = ({ visitType, onSubmit, submittedData }) => {
    const [formData, setFormData] = useState({});

    const isFollowUp = visitType === 'followup';
    const isNew = visitType === 'new';

    if (submittedData) {
        return (
            <div>
                <h2 className="text-xl font-bold">Your Information</h2>
                <p className="text-gray-600 mb-4">You have already submitted this form. Here is the information you provided:</p>
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                    {Object.entries(submittedData).map(([key, value]) => (
                        <div key={key}>
                            <p className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</p>
                            <p>{String(value)}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }


    const renderField = (name, label, type = 'text') => (
        <label className="block">
            <span className="text-gray-700">{label}</span>
            <input
                type={type}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                value={formData[name] || ''}
                onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
            />
        </label>
    );

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
            {isNew && (
                <>
                    {renderField('chief_complaint', 'What is your main health concern?')}
                    {renderField('duration', 'How long have you had this issue?')}
                    <label className="block">
                        <span className="text-gray-700">Severity (1-10)</span>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            className="mt-1 block w-full"
                            value={formData.severity || 5}
                            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        />
                    </label>
                    {renderField('current_medications', 'Current Medications')}
                    {renderField('allergies', 'Known Allergies')}
                </>
            )}
            {isFollowUp && (
                 <>
                    {renderField('changes_since_last_visit', 'Any changes since your last visit?')}
                    {renderField('side_effects', 'Any side effects from medication?')}
                 </>
            )}
            {/* Add fields for other visit types */}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">
                Submit Information
            </button>
        </form>
    );
};


export default function IntakePage() {
    const { bookingToken } = useParams();
    const toast = useToast();
    const [isSubmitted, setIsSubmitted] = useState(false);

    const { data: intakeInfo, isLoading } = useQuery({
        queryKey: ['intake', bookingToken],
        queryFn: () => fetchIntakeData(bookingToken),
    });

    const mutation = useMutation({
        mutationFn: (formData) => {
            return fetch('/api/functions/submitIntake', { // Assuming the function is deployed here
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingToken, formData }),
            }).then(res => res.json());
        },
        onSuccess: (data) => {
            if (data.error) {
                toast.error(data.error);
            } else {
                toast.success('Your information has been saved.');
                setIsSubmitted(true);
            }
        },
        onError: () => {
            toast.error('Failed to submit form. Please try again.');
        }
    });

    if (isLoading) {
        return <div>Loading form...</div>;
    }

    if (isSubmitted || intakeInfo?.submitted_data) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center mb-4">Thank You!</h1>
                <p className="text-center text-gray-600">Your information has been sent to the doctor. They will review it before your appointment.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-2">Pre-Visit Information</h1>
            <p className="text-gray-600 mb-6">Answering these questions helps the doctor prepare for your visit.</p>
            <IntakeForm
                visitType={intakeInfo?.visit_type}
                onSubmit={mutation.mutate}
                submittedData={intakeInfo?.submitted_data}
            />
        </div>
    );
}
