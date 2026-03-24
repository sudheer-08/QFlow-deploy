import { useState, useEffect } from 'react';
import { Save, Plus, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export default function ClinicProfile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newService, setNewService] = useState('');
  const [newSpec, setNewSpec] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/clinic-profile');
      setProfile(res.data.clinic);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/clinic-profile', profile);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }));

  const addService = () => {
    if (!newService.trim()) return;
    update('services', [...(profile.services || []), newService.trim()]);
    setNewService('');
  };

  const removeService = (i) => {
    update('services', profile.services.filter((_, idx) => idx !== i));
  };

  const addSpec = () => {
    if (!newSpec.trim()) return;
    update('specializations', [...(profile.specializations || []), newSpec.trim()]);
    setNewSpec('');
  };

  const removeSpec = (i) => {
    update('specializations', profile.specializations.filter((_, idx) => idx !== i));
  };

  const toggleDay = (day) => {
    const days = profile.working_days || [];
    if (days.includes(day)) {
      update('working_days', days.filter(d => d !== day));
    } else {
      update('working_days', [...days, day]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Clinic Profile</h1>
            <p className="text-gray-500 text-sm">Update how your clinic appears to patients</p>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-5">

          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Clinic Name</label>
                <input value={profile?.name || ''}
                  onChange={e => update('name', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">About</label>
                <textarea value={profile?.about || ''}
                  onChange={e => update('about', e.target.value)}
                  placeholder="Tell patients about your clinic..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Phone</label>
                  <input value={profile?.phone || ''}
                    onChange={e => update('phone', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <input value={profile?.email || ''}
                    onChange={e => update('email', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Address</label>
                <input value={profile?.address || ''}
                  onChange={e => update('address', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fee Range</label>
                <input value={profile?.fee_range || ''}
                  onChange={e => update('fee_range', e.target.value)}
                  placeholder="e.g. ₹200 - ₹500"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Working Hours</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Opening Time</label>
                <input type="time" value={profile?.opening_time || '09:00'}
                  onChange={e => update('opening_time', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Closing Time</label>
                <input type="time" value={profile?.closing_time || '18:00'}
                  onChange={e => update('closing_time', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <label className="block text-sm text-gray-600 mb-2">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                    (profile?.working_days || []).includes(day)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Services Offered</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {(profile?.services || []).map((s, i) => (
                <span key={i}
                  className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm">
                  {s}
                  <button onClick={() => removeService(i)}
                    className="hover:text-red-500 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newService}
                onChange={e => setNewService(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addService()}
                placeholder="Add a service..."
                className="flex-1 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-blue-400" />
              <button onClick={addService}
                className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Specializations */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Specializations</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {(profile?.specializations || []).map((s, i) => (
                <span key={i}
                  className="flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-sm">
                  {s}
                  <button onClick={() => removeSpec(i)}
                    className="hover:text-red-500 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSpec}
                onChange={e => setNewSpec(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSpec()}
                placeholder="Add a specialization..."
                className="flex-1 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-blue-400" />
              <button onClick={addSpec}
                className="bg-purple-600 text-white px-4 rounded-xl hover:bg-purple-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}