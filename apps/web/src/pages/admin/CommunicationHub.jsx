import { useState } from 'react';
import { Send, AlertTriangle, Bell, MessageSquare, Users, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const TEMPLATES = [
  {
    label: '⏰ Late opening',
    text: 'Dear patients, our clinic will open 30 minutes late today due to unavoidable circumstances. We apologize for the inconvenience.'
  },
  {
    label: '🏥 Doctor unavailable',
    text: 'Dear patients, Dr. [Name] is unavailable today. Your appointments will be rescheduled. We will contact you shortly.'
  },
  {
    label: '💉 Health camp',
    text: 'Dear patients, we are organizing a free health checkup camp at our clinic this Saturday. All are welcome!'
  },
  {
    label: '🎉 Holiday wishes',
    text: 'Wishing all our patients and their families a very happy and healthy festive season from all of us at the clinic!'
  },
  {
    label: '⚠️ Appointment reminder',
    text: 'This is a reminder that you have an appointment scheduled with us. Please arrive 5 minutes early.'
  },
];

export default function CommunicationHub() {
  const toast = useToast();
  const [tab, setTab] = useState('bulk');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Emergency closure state
  const [emergency, setEmergency] = useState({
    reason: '', date: new Date().toISOString().split('T')[0]
  });
  const [emergencySending, setEmergencySending] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);

  const sendBulk = async (type) => {
    if (!message.trim()) return toast.error('Please enter a message');
    setSending(true);
    setResult(null);
    try {
      const endpoint = type === 'today'
        ? '/communications/bulk/today'
        : '/communications/bulk/date';

      const body = type === 'today'
        ? { message, channel }
        : { message, channel, date };

      const res = await api.post(endpoint, body);
      setResult(res.data);
      toast.success(`Sent to ${res.data.sent} patients`);
    } catch {
      toast.error('Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  const sendEmergencyClosure = async () => {
    if (!emergency.reason.trim()) return toast.error('Please enter a reason');
    setEmergencySending(true);
    setEmergencyResult(null);
    try {
      const res = await api.post('/communications/emergency-closure', {
        reason: emergency.reason,
        date: emergency.date
      });
      setEmergencyResult(res.data);
      toast.success(`${res.data.cancelled} appointments cancelled, ${res.data.notified} patients notified`);
    } catch {
      toast.error('Failed to send emergency closure');
    } finally {
      setEmergencySending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Communication Hub</h1>
          <p className="text-gray-500 text-sm">Send bulk messages and manage patient communications</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'bulk',      label: '📢 Bulk Message',       },
            { key: 'emergency', label: '🚨 Emergency Closure',  },
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

        {/* Bulk Message Tab */}
        {tab === 'bulk' && (
          <div className="space-y-5">

            {/* Channel selector */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Send via</h2>
              <div className="flex gap-3">
                {[
                  { key: 'whatsapp', label: '📱 WhatsApp', color: 'border-green-400 bg-green-50 text-green-700' },
                  { key: 'email',    label: '📧 Email',     color: 'border-blue-400 bg-blue-50 text-blue-700' },
                ].map(c => (
                  <button key={c.key}
                    onClick={() => setChannel(c.key)}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                      channel === c.key ? c.color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message templates */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Quick Templates</h2>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t, i) => (
                  <button key={i}
                    onClick={() => setMessage(t.text)}
                    className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message composer */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Message</h2>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message here... (clinic name is added automatically)"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-32 focus:outline-none focus:border-blue-400 mb-3"
              />
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{message.length} characters</span>
                <span>{channel === 'whatsapp' ? '~1 WhatsApp message' : '1 email'}</span>
              </div>
            </div>

            {/* Send options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Send to today's patients */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Today's Patients</h3>
                </div>
                <p className="text-blue-600 text-xs mb-4">
                  Sends to all patients with appointments or queue entries today
                </p>
                <button
                  onClick={() => sendBulk('today')}
                  disabled={sending}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send to Today\'s Patients'}
                </button>
              </div>

              {/* Send to specific date */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-800">Specific Date</h3>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-purple-200 rounded-xl p-2 text-sm mb-3 focus:outline-none focus:border-purple-400 bg-white"
                />
                <button
                  onClick={() => sendBulk('date')}
                  disabled={sending}
                  className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send to Date\'s Patients'}
                </button>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">Message Sent Successfully</h3>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-green-700">{result.sent}</p>
                    <p className="text-xs text-green-600">Delivered</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                    <p className="text-xs text-gray-500">Total patients</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{result.total - result.sent}</p>
                    <p className="text-xs text-red-400">Failed</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emergency Closure Tab */}
        {tab === 'emergency' && (
          <div className="space-y-5">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="font-semibold text-red-800">Emergency Clinic Closure</h2>
              </div>
              <p className="text-red-600 text-sm">
                This will cancel ALL appointments for the selected date and notify every patient via WhatsApp.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Closure Date *</label>
                <input
                  type="date"
                  value={emergency.date}
                  onChange={e => setEmergency(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reason *</label>
                <textarea
                  value={emergency.reason}
                  onChange={e => setEmergency(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Doctor is unwell, Medical emergency, Unexpected circumstances"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:border-red-400"
                />
              </div>

              {/* Preview message */}
              {emergency.reason && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Preview message patients will receive:</p>
                  <p className="text-xs text-gray-700 whitespace-pre-line">
                    {`⚠️ [Clinic Name] — Important Notice\n\nYour appointment on ${emergency.date} has been cancelled.\n\nReason: ${emergency.reason}\n\nPlease rebook your appointment at the clinic.`}
                  </p>
                </div>
              )}

              <button
                onClick={sendEmergencyClosure}
                disabled={emergencySending || !emergency.reason.trim()}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {emergencySending ? 'Cancelling & Notifying...' : 'Cancel All & Notify Patients'}
              </button>
            </div>

            {/* Emergency result */}
            {emergencyResult && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-orange-800">Emergency Closure Processed</h3>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{emergencyResult.cancelled}</p>
                    <p className="text-xs text-orange-600">Appointments cancelled</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{emergencyResult.notified}</p>
                    <p className="text-xs text-orange-600">Patients notified</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}