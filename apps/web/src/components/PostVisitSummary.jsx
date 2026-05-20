import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { Loader, AlertTriangle } from 'lucide-react';

const fetchPostVisitSummary = async (bookingId) => {
    const { data, error } = await supabase
        .from('post_visit_summaries')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(error.message);
    }
    return data;
};

export default function PostVisitSummary({ bookingId }) {
    const { data: summary, isLoading, isError } = useQuery({
        queryKey: ['post-visit-summary', bookingId],
        queryFn: () => fetchPostVisitSummary(bookingId),
        enabled: !!bookingId,
    });

    if (isLoading) {
        return (
            <div className="pvs-loading">
                <Loader className="animate-spin" size={16} />
                <span>Generating summary...</span>
            </div>
        );
    }

    if (isError || !summary) {
        return (
            <div className="pvs-error">
                <AlertTriangle size={16} />
                <span>Could not generate post-visit summary.</span>
            </div>
        );
    }

    return (
        <div className="pvs-container">
            <h3 className="pvs-title">Post-Visit Summary</h3>
            
            <div className="pvs-section">
                <h4>Diagnosis</h4>
                <p>{summary.diagnosis}</p>
            </div>

            <div className="pvs-section">
                <h4>Prescribed Medicines</h4>
                <p>{summary.medicines_prescribed}</p>
            </div>

            <div className="pvs-section">
                <h4>Lifestyle Advice</h4>
                <p>{summary.lifestyle_advice}</p>
            </div>

            {summary.follow_up_instructions && (
                <div className="pvs-section">
                    <h4>Follow-up</h4>
                    <p>{summary.follow_up_instructions}</p>
                </div>
            )}

            <div className="pvs-footer">
                This is an AI-generated summary. Always consult with your doctor for any health concerns.
            </div>
            <style jsx>{`
                .pvs-container { background: #f3f4f6; border-radius: 12px; padding: 16px; font-family: sans-serif; }
                .pvs-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 12px; color: #1f2937; }
                .pvs-section { margin-bottom: 12px; }
                .pvs-section h4 { font-size: 0.9rem; font-weight: 500; color: #4b5563; margin: 0 0 4px; }
                .pvs-section p { font-size: 0.9rem; color: #1f2937; margin: 0; white-space: pre-wrap; }
                .pvs-footer { font-size: 0.75rem; color: #6b7280; text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
                .pvs-loading, .pvs-error { display: flex; align-items: center; gap: 8px; color: #4b5563; padding: 16px; }
            `}</style>
        </div>
    );
}
