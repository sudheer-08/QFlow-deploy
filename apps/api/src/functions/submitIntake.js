import { supabase } from '../models/supabase.js';
import { logger } from '../utils/logging.js';

// This file would be deployed as a Supabase Edge Function.
// It needs to handle CORS for public access.

export default async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { bookingToken, formData } = await req.json();

    if (!bookingToken || !formData) {
      return new Response(JSON.stringify({ error: 'Missing bookingToken or formData' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // In a real scenario, the bookingToken would be a short, secure token.
    // Here we assume it's the booking ID for simplicity.
    const bookingId = bookingToken;

    const { error } = await supabase
      .from('bookings')
      .update({
        intake_form_data: formData,
        intake_submitted_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    logger.error('Error in submitIntake Edge Function:', { error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to submit intake form.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
