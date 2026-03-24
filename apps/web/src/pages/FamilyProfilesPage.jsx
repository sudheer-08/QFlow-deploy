import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

export default function FamilyProfilesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', relation: 'Spouse', gender: 'Male', dateOfBirth: '', phone: '' })

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get('/family').then(r => r.data)
  })

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/family', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['family'])
      setShowAdd(false)
      setForm({ name: '', relation: 'Spouse', gender: 'Male', dateOfBirth: '', phone: '' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/family/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['family'])
  })

  const relations = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other']
  const relationEmoji = { Spouse: '👫', Child: '👶', Parent: '👴', Sibling: '🧑', Grandparent: '👵', Other: '👤' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '28px 16px 20px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/patient/dashboard')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 16 }}>←</button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Family Profiles</h1>
              <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>Book for your whole family</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Add
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : members.length === 0 && !showAdd ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>👨‍👩‍👧</div>
            <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>No family members yet</p>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px' }}>Add family members to book appointments for them</p>
            <button onClick={() => setShowAdd(true)} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add Family Member</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(member => (
              <div key={member.id} style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  {relationEmoji[member.relation] || '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', margin: '0 0 2px' }}>{member.name}</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px' }}>{member.relation} · {member.gender}</p>
                  {member.date_of_birth && (
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                      DOB: {new Date(member.date_of_birth).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate(`/?bookFor=${member.id}&name=${encodeURIComponent(member.name)}`)}
                    style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Book
                  </button>
                  <button onClick={() => window.confirm('Remove?') && deleteMutation.mutate(member.id)}
                    style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add member form */}
        {showAdd && (
          <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Add Family Member</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name *"
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {relations.map(r => (
                  <button key={r} onClick={() => setForm({ ...form, relation: r })}
                    style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${form.relation === r ? '#2563eb' : '#e2e8f0'}`, background: form.relation === r ? '#eff6ff' : 'white', color: form.relation === r ? '#2563eb' : '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {relationEmoji[r]} {r}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Male', 'Female', 'Other'].map(g => (
                  <button key={g} onClick={() => setForm({ ...form, gender: g })}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${form.gender === g ? '#2563eb' : '#e2e8f0'}`, background: form.gender === g ? '#eff6ff' : 'white', color: form.gender === g ? '#2563eb' : '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {g}
                  </button>
                ))}
              </div>
              <input value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} type="date"
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number (optional)" type="tel"
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => form.name && addMutation.mutate(form)} disabled={!form.name || addMutation.isPending}
                  style={{ flex: 2, background: form.name ? '#2563eb' : '#e2e8f0', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {addMutation.isPending ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
