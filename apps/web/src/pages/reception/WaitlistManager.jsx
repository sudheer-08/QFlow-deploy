import { useState, useEffect } from 'react';
import { UserX, Bell, Trash2, Plus, Clock, RefreshCw, Users } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  waiting:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  notified: 'bg-blue-100 text-blue-800 border-blue-300',
  expired:  'bg-red-100 text-red-800 border-red-300',
};

export default function WaitlistManager() {
  const toast = useToast();
  const [waitlist, setWaitlist] = useState([]);
  const [noShows, setNoShows] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('waitlist');
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    preferred_time: ''
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wRes, nRes, dRes] = await Promise.all([
        api.get('/no-show/waitlist'),
        api.get('/no-show/no-show-report'),
        api.get('/queue/doctors')
      ]);
      setWaitlist(wRes.data.waitlist || []);
      setNoShows(nRes.data.noShows || []);
      setDoctors(dRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWaitlist = async (id) => {
    try {
      await api.delete(`/no-show/waitlist/${id}`);
      toast.success('Removed from waitlist');
      fetchAll();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const addToWaitlist = async () => {
    if (!form.name || !form.phone || !form.doctor_id) {
      return toast.error('Please fill name, phone and doctor');
    }
    setAdding(true);
    try {
      // First register patient in queue to get patient_id
      const regRes = await api.post('/queue/register', {
        patientName: form.name,
        phone: form.phone,
        doctorId: form.doctor_id,
        symptoms: 'Waitlist entry',
        visitType: 'walk_in'
      });

      await api.post('/no-show/waitlist', {
        patient_id: regRes.data?.patientId || null,
        doctor_id: form.doctor_id,
        appointment_date: form.appointment_date,
        preferred_time: form.preferred_time
      });

      toast.success('Added to waitlist & patient notified via WhatsApp');
      setAddModal(false);
      setForm({
        name: '', phone: '', doctor_id: '',
        appointment_date: new Date().toISOString().split('T')[0],
        preferred_time: ''
      });
      fetchAll();
    } catch {
      toast.error('Failed to add to waitlist');
    } finally {
      setAdding(false);
    }
  };

  const formatTime = (dt) => dt
    ? new Date(dt).toLocaleString('en-IN', {
        hour: '2-digit', minute: '2-digit',
        day: 'numeric', month: 'short'
      })
    : '—';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Waitlist & No-Shows</h1>
            <p className="text-gray-500 text-sm">
              Manage overflow patients and track no-shows
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll}
              className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add to Waitlist
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'On Waitlist',   value: waitlist.length,  color: 'bg-yellow-50 text-yellow-700', icon: Users },
            { label: 'Notified',      value: waitlist.filter(w => w.status === 'notified').length, color: 'bg-blue-50 text-blue-700', icon: Bell },
            { label: 'No-Shows Today', value: noShows.length, color: 'bg-red-50 text-red-700', icon: UserX },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl p-4 ${s.color} border border-opacity-20`}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-4 h-4" />
                <p className="text-xs font-medium">{s.label}</p>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'waitlist', label: `Waitlist (${waitlist.length})` },
            { key: 'noshow',   label: `No-Shows (${noShows.length})` }
          ].map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Waitlist Tab */}
        {tab === 'waitlist' && (
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl h-20 border border-gray-200 animate-pulse" />
              ))
            ) : waitlist.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No patients on waitlist</p>
                <p className="text-gray-400 text-sm mt-1">
                  Add patients when slots are full
                </p>
              </div>
            ) : (
              waitlist.map((w, i) => (
                <div key={w.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-700">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">
                          {w.patient?.name || '—'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[w.status]}`}>
                          {w.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>📞 {w.patient?.phone}</span>
                        <span>👨‍⚕️ {w.doctor?.name}</span>
                        <span>📅 {w.appointment_date}</span>
                        {w.preferred_time && <span>⏰ {w.preferred_time}</span>}
                      </div>
                      {w.status === 'notified' && w.expires_at && (
                        <p className="text-xs text-blue-500 mt-0.5">
                          ⏳ Offer expires: {formatTime(w.expires_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWaitlist(w.id)}
                    className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* No-Shows Tab */}
        {tab === 'noshow' && (
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl h-20 border border-gray-200 animate-pulse" />
              ))
            ) : noShows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No no-shows today</p>
                <p className="text-gray-400 text-sm mt-1">Great attendance today!</p>
              </div>
            ) : (
              noShows.map(n => (
                <div key={n.id}
                  className="bg-white rounded-2xl border border-red-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <UserX className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {n.patient?.name || '—'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>📞 {n.patient?.phone}</span>
                        <span>🎫 {n.token_number}</span>
                        <span>👨‍⚕️ {n.doctor?.name}</span>
                      </div>
                      <p className="text-xs text-red-400 mt-0.5">
                        Marked at: {formatTime(n.no_show_at)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-full font-medium">
                    No-show
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add to Waitlist Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Add to Waitlist</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Patient Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone *</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Doctor *</label>
                <select
                  value={form.doctor_id}
                  onChange={e => setForm(p => ({ ...p, doctor_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400">
                  <option value="">Select doctor...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={form.appointment_date}
                  onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Preferred Time (optional)
                </label>
                <input
                  type="time"
                  value={form.preferred_time}
                  onChange={e => setForm(p => ({ ...p, preferred_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setAddModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={addToWaitlist}
                disabled={adding}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
                {adding ? 'Adding...' : 'Add & Notify Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}