import { useState, useEffect } from 'react';
import { Calendar, Bell, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  missed:    'bg-red-100 text-red-800 border-red-300',
};

export default function FollowUpManager() {
  const toast = useToast();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reminding, setReminding] = useState({});
  const [completing, setCompleting] = useState({});

  useEffect(() => { fetchFollowUps(); }, [filter]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/follow-up?status=${filter}&days=30`);
      setFollowUps(res.data.followUps || []);
    } catch {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (id) => {
    setReminding(p => ({ ...p, [id]: true }));
    try {
      await api.patch(`/follow-up/${id}/remind`);
      toast.success('Reminder sent via WhatsApp');
      fetchFollowUps();
    } catch {
      toast.error('Failed to send reminder');
    } finally {
      setReminding(p => ({ ...p, [id]: false }));
    }
  };

  const markComplete = async (id) => {
    setCompleting(p => ({ ...p, [id]: true }));
    try {
      await api.patch(`/follow-up/${id}/complete`);
      toast.success('Marked as completed');
      fetchFollowUps();
    } catch {
      toast.error('Failed to update');
    } finally {
      setCompleting(p => ({ ...p, [id]: false }));
    }
  };

  const isOverdue = (date) => new Date(date) < new Date();

  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  const getDaysUntil = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)} days overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Follow-up Manager</h1>
            <p className="text-gray-500 text-sm">
              Track and remind patients about scheduled follow-ups
            </p>
          </div>
          <button onClick={fetchFollowUps}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Pending',   value: followUps.filter(f => f.status === 'pending').length,   color: 'text-yellow-600 bg-yellow-50', icon: Clock },
            { label: 'This Week', value: followUps.filter(f => {
                const diff = Math.ceil((new Date(f.follow_up_date) - new Date()) / (1000 * 60 * 60 * 24));
                return diff >= 0 && diff <= 7;
              }).length, color: 'text-blue-600 bg-blue-50', icon: Calendar },
            { label: 'Overdue',   value: followUps.filter(f => isOverdue(f.follow_up_date) && f.status === 'pending').length, color: 'text-red-600 bg-red-50', icon: Bell },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {['pending', 'completed'].map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* Follow-up list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-24 border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : followUps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No {filter} follow-ups</p>
            <p className="text-gray-400 text-sm mt-1">
              Follow-ups are created when doctors set a return date after consultation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map(fu => {
              const overdue = isOverdue(fu.follow_up_date) && fu.status === 'pending';
              return (
                <div key={fu.id}
                  className={`bg-white rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    overdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      overdue ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      <Calendar className={`w-5 h-5 ${overdue ? 'text-red-500' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-800">
                          {fu.patient?.name || 'Unknown Patient'}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[fu.status]}`}>
                          {fu.status}
                        </span>
                        {fu.reminder_sent && (
                          <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full">
                            Reminded ✓
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span>📞 {fu.patient?.phone || '—'}</span>
                        <span>👨‍⚕️ {fu.doctor?.name || '—'}</span>
                        <span className={`font-medium ${overdue ? 'text-red-600' : 'text-blue-600'}`}>
                          📅 {formatDate(fu.follow_up_date)} ({getDaysUntil(fu.follow_up_date)})
                        </span>
                      </div>
                      {fu.reason && (
                        <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded-lg">
                          📋 {fu.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {fu.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => sendReminder(fu.id)}
                        disabled={reminding[fu.id]}
                        className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm hover:bg-blue-100 disabled:opacity-50">
                        <Bell className="w-4 h-4" />
                        {reminding[fu.id] ? 'Sending...' : 'Remind'}
                      </button>
                      <button
                        onClick={() => markComplete(fu.id)}
                        disabled={completing[fu.id]}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-green-700 disabled:opacity-50">
                        <CheckCircle className="w-4 h-4" />
                        {completing[fu.id] ? '...' : 'Done'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}