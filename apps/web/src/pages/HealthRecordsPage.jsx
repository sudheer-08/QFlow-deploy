import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { smartBack } from '../utils/navigation'

export default function HealthRecordsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const goBack = () => smartBack(navigate, '/patient/dashboard')

  const { data: records, isLoading } = useQuery({
    queryKey: ['health-records'],
    queryFn: () => api.get('/health-records/my').then(r => r.data),
    enabled: !!user
  })

  const allVisits = [
    ...(records?.visits || []).map(v => ({
      type: 'queue',
      date: v.registered_at?.split('T')[0],
      doctor: v.doctors?.name,
      specialization: v.doctors?.specialization,
      clinic: v.tenants?.name,
      symptoms: v.symptoms,
      aiSummary: v.ai_summary,
      priority: v.priority
    })),
    ...(records?.appointments || []).map(a => ({
      type: 'appointment',
      date: a.appointment_date,
      doctor: a.doctors?.name,
      specialization: a.doctors?.specialization,
      clinic: a.tenants?.name,
      symptoms: a.symptoms,
      aiSummary: a.ai_summary
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const priorityColor = (p) => ({
    critical: '#dc2626', moderate: '#d97706', routine: '#16a34a'
  })[p] || '#64748b'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '28px 16px 20px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={goBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 16 }}>←</button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Health Records</h1>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>Your complete visit history</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Total Visits', value: records?.totalVisits || 0, icon: '🏥' },
            { label: 'Clinics Visited', value: new Set(allVisits.map(v => v.clinic)).size, icon: '🦷' },
            { label: 'Doctors Seen', value: new Set(allVisits.map(v => v.doctor)).size, icon: '👨‍⚕️' }
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#bfdbfe' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Visit History</h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading records...</div>
        ) : allVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ color: '#64748b' }}>No visit history yet</p>
            <button onClick={() => navigate('/')} style={{ marginTop: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Find a Clinic</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allVisits.map((visit, idx) => (
              <div key={idx} style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: '0 0 2px' }}>{visit.clinic}</p>
                    <p style={{ fontSize: 13, color: '#2563eb', margin: '0 0 2px' }}>👨‍⚕️ {visit.doctor}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{visit.specialization}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      {new Date(visit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {visit.priority && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor(visit.priority), background: `${priorityColor(visit.priority)}15`, padding: '2px 8px', borderRadius: 99 }}>
                        {visit.priority}
                      </span>
                    )}
                  </div>
                </div>
                {visit.symptoms && (
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>SYMPTOMS</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{visit.symptoms}</p>
                    {visit.aiSummary && (
                      <p style={{ fontSize: 12, color: '#6366f1', margin: '4px 0 0' }}>🤖 {visit.aiSummary}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
        <button onClick={() => navigate('/')} style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          🦷 Book New Appointment
        </button>
      </div>
    </div>
  )
}
