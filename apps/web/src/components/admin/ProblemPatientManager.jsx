import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from './Toast';

export default function ProblemPatientManager({ bookings }) {
    const toast = useToast();
    const queryClient = useQueryClient();

    const rejoinMutation = useMutation({
        mutationFn: (bookingId) => fetch('/api/functions/rejoinQueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` },
            body: JSON.stringify({ bookingId }),
        }).then(res => {
            if (!res.ok) throw new Error('Failed to rejoin');
            return res.json();
        }),
        onSuccess: (data) => {
            toast.success(`Patient rejoined the queue at position ${data.newPosition}.`);
            queryClient.invalidateQueries({ queryKey: ['problem-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['summary-today'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to rejoin the queue.');
        }
    });

    if (!bookings || bookings.length === 0) {
        return null;
    }

    return (
        <section className="qf-content-card">
            <div className="qf-section-head">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={18} style={{ color: 'var(--ui-warning)' }} />
                    Action Required
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--ui-text-3)' }}>
                    {bookings.length} patient(s) need attention
                </span>
            </div>
            <div className="qf-problem-list">
                {bookings.map(booking => (
                    <div key={booking.id} className="qf-problem-item">
                        <div>
                            <p className="qf-problem-name">{booking.patient_name || 'Unknown Patient'}</p>
                            <p className="qf-problem-status">
                                Status: <span className={`qf-status-badge ${booking.status === 'no_show' ? 'no-show' : 'skipped'}`}>{booking.status.replace('_', ' ')}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => rejoinMutation.mutate(booking.id)}
                            disabled={rejoinMutation.isLoading && rejoinMutation.variables === booking.id}
                            className="qf-btn-rejoin"
                        >
                            <RefreshCw size={14} />
                            {rejoinMutation.isLoading && rejoinMutation.variables === booking.id ? 'Rejoining...' : 'Rejoin Queue'}
                        </button>
                    </div>
                ))}
            </div>
            <style jsx>{`
                .qf-problem-list { display: flex; flex-direction: column; gap: 12px; }
                .qf-problem-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff8f0; border-radius: 8px; border: 1px solid #ffedd5; }
                .qf-problem-name { font-weight: 600; color: #7c2d12; }
                .qf-problem-status { font-size: 0.8rem; color: #9a3412; margin: 2px 0 0; }
                .qf-status-badge { padding: 2px 6px; border-radius: 4px; font-weight: 500; text-transform: capitalize; }
                .qf-status-badge.no-show { background: #fee2e2; color: #991b1b; }
                .qf-status-badge.skipped { background: #ffedd5; color: #9a3412; }
                .qf-btn-rejoin { display: inline-flex; align-items: center; gap: 6px; background: #fb923c; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 500; }
                .qf-btn-rejoin:disabled { background: #fdba74; cursor: not-allowed; }
            `}</style>
        </section>
    );
}
