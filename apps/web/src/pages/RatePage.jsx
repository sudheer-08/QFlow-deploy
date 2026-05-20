import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Star, MessageSquare, Shield } from 'lucide-react';
import './RatePage.css';

const fetchAppointmentForReview = async (appointmentId) => {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, doctor_id, tenant_id, patient_id, patient_name_cache, doctors:doctor_id(name), reviews(id)')
        .eq('id', appointmentId)
        .single();
        
    if (error || data?.reviews?.length > 0) {
        throw new Error('Appointment not found or already reviewed.');
    }
    return data;
};

const StarRating = ({ rating, setRating }) => {
    return (
        <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={star <= rating ? 'filled' : ''}
                    onClick={() => setRating(star)}
                />
            ))}
        </div>
    );
};

const RatePage = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [ratings, setRatings] = useState({
        wait_time: 0,
        doctor_consultation: 0,
        clinic_hygiene: 0,
    });
    const [publicFeedback, setPublicFeedback] = useState('');
    const [privateFeedback, setPrivateFeedback] = useState('');
    const [error, setError] = useState('');

    const { data: appointment, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['appointmentForReview', appointmentId],
        queryFn: () => fetchAppointmentForReview(appointmentId),
        retry: false,
    });

    const submitReviewMutation = useMutation({
        mutationFn: async (reviewData) => {
            const { error } = await supabase.from('reviews').insert(reviewData);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['appointmentForReview', appointmentId]);
            navigate('/thank-you'); // Redirect to a generic thank you page
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    const handleSubmit = () => {
        if (Object.values(ratings).some(r => r === 0)) {
            setError('Please provide a rating for all categories.');
            return;
        }
        setError('');
        submitReviewMutation.mutate({
            appointment_id: appointmentId,
            doctor_id: appointment.doctor_id,
            tenant_id: appointment.tenant_id,
            patient_id: appointment.patient_id,
            wait_time_rating: ratings.wait_time,
            consultation_rating: ratings.doctor_consultation,
            hygiene_rating: ratings.clinic_hygiene,
            public_feedback: publicFeedback,
            private_feedback: privateFeedback,
            overall_rating: (ratings.wait_time + ratings.doctor_consultation + ratings.clinic_hygiene) / 3,
        });
    };

    if (isLoading) return <div className="rate-page-loading">Loading...</div>;
    if (isError) return <div className="rate-page-error">{queryError.message}</div>;

    return (
        <div className="rate-page">
            <div className="rate-container">
                <div className="rate-header">
                    <h1>Rate Your Visit</h1>
                    <p>Your feedback for the appointment with <strong>Dr. {appointment.doctors.name}</strong> helps us improve.</p>
                </div>

                <div className="rating-category">
                    <label>Wait Time</label>
                    <StarRating rating={ratings.wait_time} setRating={(r) => setRatings(p => ({ ...p, wait_time: r }))} />
                </div>
                <div className="rating-category">
                    <label>Doctor's Consultation</label>
                    <StarRating rating={ratings.doctor_consultation} setRating={(r) => setRatings(p => ({ ...p, doctor_consultation: r }))} />
                </div>
                <div className="rating-category">
                    <label>Clinic Hygiene & Staff</label>
                    <StarRating rating={ratings.clinic_hygiene} setRating={(r) => setRatings(p => ({ ...p, clinic_hygiene: r }))} />
                </div>

                <div className="feedback-section">
                    <label><MessageSquare size={16} /> Public Feedback (optional)</label>
                    <p className="feedback-note">This review will be visible on the doctor's public profile.</p>
                    <textarea
                        value={publicFeedback}
                        onChange={(e) => setPublicFeedback(e.target.value)}
                        placeholder="How was your experience?"
                        rows="3"
                    ></textarea>
                </div>

                <div className="feedback-section">
                    <label><Shield size={16} /> Private Feedback for Management (optional)</label>
                     <p className="feedback-note">This will only be seen by the clinic administration.</p>
                    <textarea
                        value={privateFeedback}
                        onChange={(e) => setPrivateFeedback(e.target.value)}
                        placeholder="Any suggestions or private concerns?"
                        rows="3"
                    ></textarea>
                </div>

                {error && <div className="rate-page-error">{error}</div>}

                <button onClick={handleSubmit} disabled={submitReviewMutation.isPending} className="submit-review-btn">
                    {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </button>
            </div>
        </div>
    );
};

export default RatePage;
