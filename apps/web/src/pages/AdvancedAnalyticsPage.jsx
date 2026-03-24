import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import api from '../services/api'

export default function AdvancedAnalyticsPage() {
  const navigate = useNavigate()

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['advanced-analytics'],
    queryFn: () => api.get('/advanced-analytics/overview').then(r => r.data),
    refetchInterval: 60000
  })

  const peakData = analytics?.peakHours?.filter(h => parseInt(h.hour) >= 8 && parseInt(h.hour) <= 21) || []

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 40 }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/admin')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', margin: 0 }}>Advanced Analytics</h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Last 30 days</p>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading analytics...</div>
        ) : (
          <>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total Patients', value: analytics?.totalPatients || 0, icon: '👥', color: '#2563eb' },
                { label: 'Today', value: analytics?.todayPatients || 0, icon: '📅', color: '#16a34a' },
                { label: 'Appointments', value: analytics?.totalAppointments || 0, icon: '📋', color: '#7c3aed' },
                { label: 'Avg Wait', value: `${analytics?.avgWaitMins || 0}m`, icon: '⏱', color: '#d97706' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{kpi.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Peak hours chart */}
            <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>🕐 Peak Hours (Last 30 days)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={peakData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={h => h.split(':')[0]} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [v, 'Patients']} />
                  <Bar dataKey="patients" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Doctor performance */}
            <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>👨‍⚕️ Doctor Performance</h3>
              {(analytics?.doctors || []).length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>No data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {analytics.doctors.map((doc, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', margin: 0 }}>{doc.name}</p>
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{doc.completionRate}% completion</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[
                          { label: 'Patients', value: doc.totalPatients },
                          { label: 'Avg Wait', value: `${doc.avgWait}m` },
                          { label: 'No-show', value: `${doc.noShowRate}%` }
                        ].map(stat => (
                          <div key={stat.label} style={{ background: 'white', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{stat.value}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
