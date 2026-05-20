import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import api from '../services/api'; // Assuming you have an api service wrapper

/**
 * Custom hook to manage and subscribe to the queue state for a doctor on a specific date.
 * @param {string} doctorId - The UUID of the doctor.
 * @param {string} date - The session date in 'YYYY-MM-DD' format.
 * @returns {{ queueState: object | null, isLoading: boolean, error: object | null }}
 */
const useQueueState = (doctorId, date) => {
  const [queueState, setQueueState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQueueState = useCallback(async () => {
    if (!doctorId || !date) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error: apiError } = await api.get(`/queue/state/${doctorId}/${date}`);
      if (apiError) {
        throw apiError;
      }
      setQueueState(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch queue state:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    fetchQueueState();

    // Set up a heartbeat interval to refetch every 60 seconds
    const heartbeatInterval = setInterval(fetchQueueState, 60000);

    // Set up Supabase Realtime subscription
    const channel = supabase
      .channel(`queue:${doctorId}:${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          console.log('Realtime change received:', payload);
          // Re-fetch full queue state for consistency
          fetchQueueState();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to queue channel: queue:${doctorId}:${date}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error:', err);
          setError(err);
        }
      });

    // Cleanup function
    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      console.log(`Unsubscribed from queue channel: queue:${doctorId}:${date}`);
    };
  }, [doctorId, date, fetchQueueState]);

  return { queueState, isLoading, error };
};

export default useQueueState;
