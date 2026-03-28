import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, User, Phone, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import socket, { connectClinic } from '../../socket';

const STATUS_COLORS = {
  pending:         'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed:       'bg-green-100 text-green-800 border-green-300',
  declined:        'bg-red-100 text-red-800 border-red-300',
  pending_patient: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function BookingInbox() {
  const toast = useToast();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [declineModal, setDeclineModal] = useState(null);
  const [suggestModal, setSuggestModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [suggestedSlot, setSuggestedSlot] = useState('');
  const [processing, setProcessing] = useState({});

  useEffect(() => { fetchBookings(); }, [filter]);

  useEffect(() => {
    if (!user?.tenantId || !user?.id || !user?.role) return;
    connectClinic(user.tenantId, user.id, user.role);

    const onAppointmentNew = () => {
      fetchBookings();
    };

    socket.on('appointment:new', onAppointmentNew);
    return () => {
      socket.off('appointment:new', onAppointmentNew);
    };
  }, [user?.tenantId, user?.id, user?.role, filter]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/booking-requests/all?status=${filter}`);
      setBookings(res.data.bookings || []);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const accept = async (id) => {
    setProcessing(p => ({ ...p, [id]: 'accepting' }));
    try {
      await api.patch(`/booking-requests/${id}/accept`);
      toast.success('Booking confirmed & patient notified');
      fetchBookings();
    } catch {
      toast.error('Failed to confirm');
    } finally {
      setProcessing(p => ({ ...p, [id]: null }));
    }
  };

  const decline = async () => {
    if (!declineReason.trim()) return toast.error('Please enter a reason');
    setProcessing(p => ({ ...p, [declineModal]: 'declining' }));
    try {
      await api.patch(`/booking-requests/${declineModal}/decline`, {
        reason: declineReason,
        suggested_slot: suggestedSlot || null
      });
      toast.success('Booking declined & patient notified');
      setDeclineModal(null);
      setDeclineReason('');
      setSuggestedSlot('');
      fetchBookings();
    } catch {
      toast.error('Failed to decline');
    } finally {
      setProcessing(p => ({ ...p, [declineModal]: null }));
    }
  };

  const suggest = async () => {
    if (!suggestedSlot) return toast.error('Please pick a slot');
    setProcessing(p => ({ ...p, [suggestModal]: 'suggesting' }));
    try {
      await api.patch(`/booking-requests/${suggestModal}/suggest`, {
        suggested_slot: suggestedSlot
      });
      toast.success('Alternative slot sent to patient');
      setSuggestModal(null);
      setSuggestedSlot('');
      fetchBookings();
    } catch {
      toast.error('Failed to suggest slot');
    } finally {
      setProcessing(p => ({ ...p, [suggestModal]: null }));
    }
  };

  const formatDateTime = (date, time) => {
    if (!date) return '—';
    const d = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const t = time ? time.slice(0, 5) : '';
    return `${d} ${t}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Booking Inbox</h1>
            <p className="text-gray-500 text-sm">Review and manage appointment requests</p>
          </div>
          <button onClick={fetchBookings}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['all', 'pending', 'confirmed', 'declined', 'pending_patient'].map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filter === s
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'All Bookings' : s === 'pending_patient' ? 'Awaiting Patient' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Booking Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 animate-pulse h-32" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No {filter} bookings</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'all'
                ? 'Bookings from patients and reception will appear here'
                : filter === 'pending'
                ? 'New bookings will appear here for review'
                : 'Nothing to show'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-800">
                        {b.patient?.name || 'Unknown Patient'}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[b.status]}`}>
                        {b.status === 'pending_patient' ? 'Awaiting Patient' : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {b.patient?.phone || '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(b.appointment_date, b.slot_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {b.doctor?.name || '—'}
                      </span>
                    </div>
                    {b.symptoms && (
                      <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded-lg">
                        🩺 {b.symptoms}
                      </p>
                    )}
                    {b.notes && (
                      <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded-lg">
                        📋 {b.notes}
                      </p>
                    )}
                    {b.decline_reason && (
                      <p className="text-xs text-red-400 mt-1">Declined: {b.decline_reason}</p>
                    )}
                    {b.payment_amount && (
                      <p className="text-xs text-green-600 mt-1">
                        💳 ₹{b.payment_amount} — {b.payment_status}
                      </p>
                    )}
                  </div>
                </div>

                {b.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => accept(b.id)}
                      disabled={processing[b.id]}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-green-700 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" />
                      {processing[b.id] === 'accepting' ? 'Confirming...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setSuggestModal(b.id)}
                      className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm hover:bg-blue-100">
                      <Calendar className="w-4 h-4" /> Suggest Slot
                    </button>
                    <button
                      onClick={() => setDeclineModal(b.id)}
                      className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-sm hover:bg-red-100">
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decline Modal */}
      {declineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Decline Booking</h2>
            <label className="block text-sm text-gray-600 mb-1">Reason for declining *</label>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g. Doctor unavailable on this date"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 mb-4 focus:outline-none focus:border-blue-400"
            />
            <label className="block text-sm text-gray-600 mb-1">
              Suggest alternative slot (optional)
            </label>
            <input type="datetime-local"
              value={suggestedSlot}
              onChange={e => setSuggestedSlot(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setDeclineModal(null); setDeclineReason(''); setSuggestedSlot(''); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={decline}
                disabled={processing[declineModal]}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm hover:bg-red-700 disabled:opacity-50">
                {processing[declineModal] === 'declining' ? 'Declining...' : 'Decline & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Slot Modal */}
      {suggestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Suggest Alternative Slot</h2>
            <label className="block text-sm text-gray-600 mb-1">Pick a new date & time *</label>
            <input type="datetime-local"
              value={suggestedSlot}
              onChange={e => setSuggestedSlot(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setSuggestModal(null); setSuggestedSlot(''); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={suggest}
                disabled={processing[suggestModal]}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50">
                {processing[suggestModal] === 'suggesting' ? 'Sending...' : 'Send to Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}