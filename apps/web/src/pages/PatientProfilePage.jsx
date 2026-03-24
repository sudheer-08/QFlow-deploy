import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/Toast'

export default function PatientProfilePage() {
  const { user, login, logout } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    gender: user?.gender || '',
    dateOfBirth: user?.dateOfBirth || '',
    bloodGroup: user?.bloodGroup || '',
    allergies: user?.allergies || '',
    emergencyContact: user?.emergencyContact || '',
  })

  const [editing, setEditing] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch('/patient/profile', data),
    onSuccess: (res) => {
      toast.success('Profile updated successfully!')
      setEditing(false)
    },
    onError: () => toast.error('Failed to update profile')
  })

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  const avatarInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  const avatarColor = ['#2563eb', '#7c3aed', '#dc2626', '#d97706', '#16a34a'][user?.name?.charCodeAt(0) % 5 || 0]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '32px 16px 24px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 16 }}>←</button>
          <button
            onClick={() => editing ? updateMutation.mutate(form) : setEditing(true)}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {updateMutation.isPending ? 'Saving...' : editing ? '✓ Save' : '✏️ Edit'}
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }}>
            {avatarInitials(user?.name)}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{user?.name}</h1>
            <p style={{ fontSize: 13, color: '#bfdbfe', margin: '0 0 4px' }}>{user?.email}</p>
            <span style={{ background: 'rgba(255,255,255,0.2)', fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
              Patient Account
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Personal Info */}
        <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>Personal Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { key: 'name', label: 'Full Name', icon: '👤', type: 'text' },
              { key: 'phone', label: 'WhatsApp Number', icon: '📱', type: 'tel' },
              { key: 'email', label: 'Email', icon: '📧', type: 'email' },
              { key: 'dateOfBirth', label: 'Date of Birth', icon: '🎂', type: 'date' },
              { key: 'emergencyContact', label: 'Emergency Contact', icon: '🆘', type: 'tel' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  {field.icon} {field.label}
                </label>
                {editing ? (
                  <input value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    type={field.type}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                ) : (
                  <p style={{ fontSize: 14, color: form[field.key] ? '#0f172a' : '#94a3b8', margin: 0, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                    {form[field.key] || 'Not set'}
                  </p>
                )}
              </div>
            ))}

            {/* Gender */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>⚧ Gender</label>
              {editing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} onClick={() => setForm({ ...form, gender: g })}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${form.gender === g ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: form.gender === g ? '#eff6ff' : 'white', color: form.gender === g ? '#2563eb' : '#64748b' }}>
                      {g}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: form.gender ? '#0f172a' : '#94a3b8', margin: 0, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  {form.gender || 'Not set'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Medical Info */}
        <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>Medical Information</h3>

          {/* Blood group */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>🩸 Blood Group</label>
            {editing ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {bloodGroups.map(bg => (
                  <button key={bg} onClick={() => setForm({ ...form, bloodGroup: bg })}
                    style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${form.bloodGroup === bg ? '#dc2626' : '#e2e8f0'}`, background: form.bloodGroup === bg ? '#fef2f2' : 'white', color: form.bloodGroup === bg ? '#dc2626' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {bg}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: form.bloodGroup ? '#dc2626' : '#94a3b8', fontWeight: form.bloodGroup ? 700 : 400, margin: 0 }}>
                {form.bloodGroup || 'Not set'}
              </p>
            )}
          </div>

          {/* Allergies */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>⚠️ Known Allergies</label>
            {editing ? (
              <textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })}
                placeholder="e.g. Penicillin, Latex, Ibuprofen..."
                rows={2}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
            ) : (
              <p style={{ fontSize: 14, color: form.allergies ? '#d97706' : '#94a3b8', margin: 0 }}>
                {form.allergies || 'None recorded'}
              </p>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' }}>Quick Links</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { icon: '📋', label: 'My Bookings', path: '/patient/dashboard' },
              { icon: '🏥', label: 'Health Records', path: '/patient/health-records' },
              { icon: '👨‍👩‍👧', label: 'Family Profiles', path: '/patient/family' },
            ].map(item => (
              <button key={item.label} onClick={() => navigate(item.path)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', background: 'none', border: 'none', borderBottom: '1px solid #f8fafc', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={() => { logout(); navigate('/') }}
          style={{ width: '100%', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
