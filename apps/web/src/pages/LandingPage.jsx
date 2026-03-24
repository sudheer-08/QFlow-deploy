import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

export default function LandingPage() {
  const navigate = useNavigate()

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics-count'],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics`).then(r => r.json())
  })

  const features = [
    { icon: '📍', title: 'Find Nearby Clinics', desc: 'See all dental clinics on a live map with real-time wait times' },
    { icon: '📅', title: 'Book in Seconds', desc: 'Choose your doctor, pick a time slot, confirm instantly' },
    { icon: '🏠', title: 'Wait at Home', desc: 'No more sitting in waiting rooms — come only when it\'s your turn' },
    { icon: '📱', title: 'Live Updates', desc: 'Get notified when 2 people are ahead — head to clinic on time' },
    { icon: '🤖', title: 'AI Triage', desc: 'AI analyzes symptoms and prioritizes critical cases automatically' },
    { icon: '⭐', title: 'Verified Reviews', desc: 'Real ratings from real patients — choose the best clinic for you' },
  ]

  const stats = [
    { value: `${clinics.length}+`, label: 'Clinics Listed' },
    { value: '500+', label: 'Happy Patients' },
    { value: '0', label: 'Waiting Room Hours' },
    { value: '4.8★', label: 'Average Rating' },
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="qf-glass" style={{
        margin: '10px auto 0',
        width: 'min(1120px, calc(100% - 20px))',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 8,
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(145deg, #1752d1, #00a6a6)',
            borderRadius: 11,
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontWeight: 900,
            fontSize: 18
          }}>Q</div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>QFlow</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Smart patient flow platform</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/register-clinic')} style={{
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            background: 'white',
            color: '#0f172a',
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            For Clinics
          </button>
          <button onClick={() => navigate('/')} style={{
            border: 'none',
            borderRadius: 10,
            background: 'linear-gradient(120deg, #1752d1, #2f76ff)',
            color: 'white',
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            Find Clinic
          </button>
        </div>
      </nav>

      <section style={{
        width: 'min(1120px, calc(100% - 24px))',
        margin: '18px auto 0',
        background: 'linear-gradient(120deg, #0f224f 0%, #1752d1 48%, #00a6a6 100%)',
        borderRadius: 24,
        padding: 'clamp(24px, 6vw, 72px) clamp(18px, 5vw, 44px)',
        color: 'white',
        boxShadow: '0 20px 50px rgba(15, 34, 79, 0.28)'
      }}>
        <div style={{
          display: 'inline-block',
          marginBottom: 16,
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 99,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700
        }}>
          Trusted by clinics and patients across Tricity
        </div>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(32px, 6vw, 60px)',
          lineHeight: 1.05,
          maxWidth: 760,
          fontWeight: 800
        }}>
          Hospital-grade queue intelligence for everyday care.
        </h1>
        <p style={{
          marginTop: 16,
          marginBottom: 24,
          color: 'rgba(232, 243, 255, 0.95)',
          maxWidth: 700,
          lineHeight: 1.7,
          fontSize: 'clamp(14px, 2vw, 17px)'
        }}>
          Discover clinics, compare live wait times, and arrive exactly when needed. QFlow removes waiting-room chaos for patients while giving clinics real operational control.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} style={{
            border: 'none',
            borderRadius: 12,
            background: 'white',
            color: '#0f224f',
            padding: '12px 18px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer'
          }}>
            Find Clinics Near Me
          </button>
          <button onClick={() => navigate('/register-clinic')} style={{
            border: '1.5px solid rgba(255,255,255,0.5)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            padding: '12px 18px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer'
          }}>
            Register Clinic
          </button>
        </div>
      </section>

      <section style={{ width: 'min(1120px, calc(100% - 24px))', margin: '14px auto 0' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10
        }}>
          {stats.map((s) => (
            <div key={s.label} className="qf-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ width: 'min(1120px, calc(100% - 24px))', margin: '28px auto 0' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 38px)', color: '#0f172a' }}>Built for real-time care operations</h2>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>Every patient interaction and queue update stays synchronized.</p>
        </div>
        <div style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
        }}>
          {features.map((f, i) => (
            <div key={f.title} className="qf-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 28 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, margin: '10px 0 6px', color: '#0f172a' }}>{f.title}</h3>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.65, fontSize: 13 }}>{f.desc}</p>
              <div style={{
                marginTop: 10,
                width: `${30 + ((i % 5) * 13)}%`,
                height: 3,
                borderRadius: 99,
                background: 'linear-gradient(90deg, #1752d1, #00a6a6)'
              }} />
            </div>
          ))}
        </div>
      </section>

      <section style={{
        width: 'min(1120px, calc(100% - 24px))',
        margin: '28px auto 18px',
        background: 'linear-gradient(140deg, #ffffff, #edf6ff)',
        border: '1px solid #dbe4f0',
        borderRadius: 24,
        padding: 'clamp(22px, 5vw, 34px)',
        boxShadow: '0 10px 30px rgba(2, 34, 87, 0.08)',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 34px)', margin: 0, color: '#0f172a' }}>Scale your clinic without scaling stress</h2>
        <p style={{ margin: '10px auto 0', maxWidth: 700, color: '#64748b', lineHeight: 1.7 }}>
          Online bookings, reminders, analytics, and queue visibility in one workflow your team can adopt quickly.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          {['Online bookings', 'Queue automation', 'Smart reminders', 'Performance analytics'].map((f) => (
            <span key={f} style={{
              background: 'white',
              color: '#1752d1',
              border: '1px solid #bfdbfe',
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 12,
              padding: '6px 12px'
            }}>{f}</span>
          ))}
        </div>
        <button onClick={() => navigate('/register-clinic')} style={{
          marginTop: 16,
          border: 'none',
          borderRadius: 12,
          padding: '12px 18px',
          background: 'linear-gradient(130deg, #1752d1, #2f76ff)',
          color: 'white',
          fontWeight: 800,
          cursor: 'pointer'
        }}>
          Register Your Clinic
        </button>
      </section>

      <footer style={{
        width: 'min(1120px, calc(100% - 24px))',
        margin: '0 auto 18px',
        borderRadius: 14,
        border: '1px solid #dbe4f0',
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        color: '#64748b',
        fontSize: 12
      }}>
        <span>QFlow · Real-time patient flow orchestration</span>
        <span>© 2026 QFlow</span>
      </footer>
    </div>
  )
}
