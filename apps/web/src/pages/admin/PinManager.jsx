import { useState, useEffect } from 'react';
import { Key, Shield, ShieldOff, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const ROLE_COLORS = {
  clinic_admin: 'bg-purple-100 text-purple-700',
  doctor:       'bg-blue-100 text-blue-700',
  receptionist: 'bg-green-100 text-green-700',
};

export default function PinManager() {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinModal, setPinModal] = useState(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/pin/staff');
      setStaff(res.data.staff || []);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const setStaffPin = async () => {
    if (!/^\d{4}$/.test(pin)) return toast.error('PIN must be exactly 4 digits');
    setSaving(true);
    try {
      await api.post('/pin/set', { staff_id: pinModal, pin });
      toast.success('PIN set successfully');
      setPinModal(null);
      setPin('');
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set PIN');
    } finally {
      setSaving(false);
    }
  };

  const disablePin = async (staffId) => {
    try {
      await api.delete(`/pin/disable/${staffId}`);
      toast.success('PIN disabled');
      fetchStaff();
    } catch {
      toast.error('Failed to disable PIN');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Staff PIN Manager</h1>
          <p className="text-gray-500 text-sm">
            Set 4-digit PINs for quick staff login at the reception desk
          </p>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Key className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 font-medium text-sm">How PIN login works</p>
            <p className="text-blue-600 text-xs mt-1">
              Staff can login at <strong>/pin-login</strong> using just their 4-digit PIN.
              Session automatically expires after 8 hours. Each PIN must be unique per clinic.
            </p>
          </div>
        </div>

        {/* Staff list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Staff Members</h2>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {staff.map(member => (
                <div key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                      {member.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{member.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[member.role]}`}>
                          {member.role.replace('_', ' ')}
                        </span>
                        {member.pin_enabled ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Shield className="w-3 h-3" /> PIN active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <ShieldOff className="w-3 h-3" /> No PIN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPinModal(member.id); setPin(''); }}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      {member.pin_enabled ? 'Change PIN' : 'Set PIN'}
                    </button>
                    {member.pin_enabled && (
                      <button
                        onClick={() => disablePin(member.id)}
                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">
                        Disable
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Set PIN Modal */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Set Staff PIN</h2>
            <p className="text-gray-500 text-sm mb-4">
              {staff.find(s => s.id === pinModal)?.name}
            </p>

            <label className="block text-sm text-gray-600 mb-1">4-digit PIN *</label>
            <div className="relative mb-5">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => {
                  if (/^\d{0,4}$/.test(e.target.value)) setPin(e.target.value);
                }}
                placeholder="e.g. 1234"
                maxLength={4}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm pr-10 focus:outline-none focus:border-blue-400 tracking-widest text-xl text-center"
              />
              <button
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-3.5 text-gray-400">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPinModal(null); setPin(''); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm">
                Cancel
              </button>
              <button
                onClick={setStaffPin}
                disabled={saving || pin.length !== 4}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}