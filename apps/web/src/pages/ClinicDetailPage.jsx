import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

export default function ClinicDetailPage() {
  const { subdomain } = useParams()
  const navigate = useNavigate()
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-detail', subdomain],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/patient/clinics/${subdomain}`)
        .then(r => r.json()),
    refetchInterval: 30000
  })

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🦷</div>
        <p>Loading clinic...</p>
      </div>
    </div>
  )

  if (!clinic || clinic.error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <p>Clinic not found</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>Go Back</button>
      </div>
    </div>
  )

  const waitColor = (count) => count > 10 ? '#dc2626' : count > 5 ? '#d97706' : '#16a34a'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ background: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{clinic.name}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{clinic.city}</div>
        </div>
      </div>

      {/* Clinic hero */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '24px 16px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{clinic.name}</h1>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: '0 0 4px' }}>📍 {clinic.address}</p>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: '0 0 8px' }}>🕐 {clinic.open_time?.slice(0,5)} – {clinic.close_time?.slice(0,5)}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>⭐ {clinic.rating}</span>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>{clinic.total_reviews} reviews</span>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>🦷 {clinic.specialization}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{clinic.totalWaiting || 0}</div>
            <div style={{ fontSize: 11, color: '#bfdbfe' }}>waiting now</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>~{(clinic.totalWaiting || 0) * 8} min</div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ background: 'white', margin: '12px 16px', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 2px' }}>Phone</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0 }}>{clinic.phone || 'Not listed'}</p>
          </div>
          <a href={`tel:${clinic.phone}`} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>📞 Call</a>
        </div>
      </div>

      {/* Select Doctor */}
      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Choose a Doctor</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(clinic.doctors || []).map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoctor(doc)}
              style={{ background: 'white', borderRadius: 12, padding: '14px', border: `2px solid ${selectedDoctor?.id === doc.id ? '#2563eb' : '#e2e8f0'}`, cursor: 'pointer', transition: 'border-color 0.2s' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👨‍⚕️</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{doc.name}</p>
                    <p style={{ fontSize: 12, color: '#2563eb', margin: '0 0 2px', fontWeight: 500 }}>{doc.specialization}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{doc.experience_years} yrs experience</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: waitColor(doc.queueCount || 0) }}>{doc.queueCount || 0}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>waiting</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>~{(doc.queueCount || 0) * 8}m</div>
                </div>
              </div>
              {doc.bio && <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>{doc.bio}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
        {selectedDoctor ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Book Appointment */}
            <button
              onClick={() => navigate(`/book/${subdomain}?doctor=${selectedDoctor.id}`)}
              style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              📅 Book Appointment with {selectedDoctor.name.split(' ').slice(0, 2).join(' ')}
            </button>
            {/* Join Walk-in Queue */}
            <button
              onClick={() => navigate(`/join/${subdomain}?doctor=${selectedDoctor.id}`)}
              style={{ width: '100%', background: 'white', color: '#2563eb', border: '2px solid #2563eb', borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              🦷 Join Walk-in Queue
            </button>
          </div>
        ) : (
          <button
            disabled
            style={{ width: '100%', background: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'not-allowed' }}
          >
            Select a doctor to continue
          </button>
        )}
      </div>
    </div>
  )
}