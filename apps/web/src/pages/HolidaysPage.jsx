import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

export default function HolidaysPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ date: '', reason: '' })

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get('/holidays').then(r => r.data)
  })

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/holidays', data),
    onSuccess: () => { queryClient.invalidateQueries(['holidays']); setForm({ date: '', reason: '' }) }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/holidays/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['holidays'])
  })

  const predefined = [
    { reason: 'Republic Day', date: `${new Date().getFullYear()}-01-26` },
    { reason: 'Holi', date: `${new Date().getFullYear()}-03-25` },
    { reason: 'Independence Day', date: `${new Date().getFullYear()}-08-15` },
    { reason: 'Diwali', date: `${new Date().getFullYear()}-10-20` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 40 }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/admin')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', margin: 0 }}>Clinic Holidays</h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>No bookings accepted on holidays</p>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Add holiday form */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>Add Holiday</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} type="date" min={new Date().toISOString().split('T')[0]}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason (e.g. Diwali, Doctor unavailable)"
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => form.date && addMutation.mutate(form)} disabled={!form.date || addMutation.isPending}
              style={{ background: form.date ? '#2563eb' : '#e2e8f0', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {addMutation.isPending ? 'Adding...' : '+ Mark as Holiday'}
            </button>
          </div>

          {/* Quick add national holidays */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Quick add:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {predefined.map(h => (
                <button key={h.reason} onClick={() => setForm({ date: h.date, reason: h.reason })}
                  style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid #e2e8f0', background: 'white', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  {h.reason}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Holiday list */}
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>Upcoming Holidays ({holidays.length})</h3>
        {holidays.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <p>No holidays set</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {holidays.map(h => (
              <div key={h.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: '0 0 2px' }}>{h.reason}</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                    {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => window.confirm('Remove holiday?') && deleteMutation.mutate(h.id)}
                  style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
