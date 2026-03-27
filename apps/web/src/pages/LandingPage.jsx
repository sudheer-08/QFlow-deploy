import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics-count'],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics`).then(r => r.json())
  })

  const features = [
    { title: 'Live Queue Intelligence', desc: 'Track real-time queue depth across doctors and time windows.' },
    { title: 'Online Booking Engine', desc: 'Convert discovery into confirmed appointments with fewer drop-offs.' },
    { title: 'Automated Follow-ups', desc: 'Send reminders and updates automatically over familiar channels.' },
    { title: 'Operational Analytics', desc: 'Measure no-shows, utilization, and throughput in one dashboard.' },
    { title: 'Smart Intake Layer', desc: 'Capture symptoms earlier to improve triage and appointment prep.' },
    { title: 'Patient Trust Signals', desc: 'Surface verified reviews and care quality indicators clearly.' }
  ]

  const metrics = [
    { value: `${clinics.length}+`, label: 'Clinics Listed' },
    { value: '500+', label: 'Patients Served' },
    { value: '4.8', label: 'Average Rating' },
    { value: '24x7', label: 'Digital Access' }
  ]

  return (
    <div className="lp-shell">
      <div className="lp-orb lp-orb-left" />
      <div className="lp-orb lp-orb-right" />

      <header className="lp-topbar">
        <div className="lp-brand">
          <div className="lp-logo">Q</div>
          <div>
            <p className="lp-brand-title">QFlow</p>
            <p className="lp-brand-sub">Real-time care operations</p>
          </div>
        </div>

        <div className="lp-top-actions">
          <button type="button" className="lp-btn lp-btn-secondary" onClick={() => navigate('/register-clinic')}>
            For Clinics
          </button>
          <button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate('/')}>
            Find Clinic
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-kicker">Clinic Growth Platform</p>
          <h1>Scale appointments without scaling front-desk chaos.</h1>
          <p>
            QFlow unifies booking, queue visibility, and patient communication into a single, practical workflow for modern clinics.
          </p>
          <div className="lp-hero-actions">
            <button type="button" className="lp-btn lp-btn-white" onClick={() => navigate('/register-clinic')}>
              List Your Clinic
            </button>
            <button type="button" className="lp-btn lp-btn-outline" onClick={() => navigate('/')}>
              Explore Patient App
            </button>
          </div>
        </div>

        <aside className="lp-hero-panel">
          <h3>What you launch with</h3>
          <ul>
            <li>Custom public clinic page</li>
            <li>Doctor-wise queue visibility</li>
            <li>Appointment and reminder workflow</li>
            <li>Actionable operations dashboard</li>
          </ul>
          <div className="lp-mini-metrics">
            <div>
              <strong>{clinics.length}</strong>
              <span>Active clinics</span>
            </div>
            <div>
              <strong>0 min</strong>
              <span>Wasted wait goal</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="lp-metric-grid">
        {metrics.map((item) => (
          <article key={item.label} className="lp-metric-card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <p className="lp-kicker">Capabilities</p>
          <h2>Designed for high-volume clinic days.</h2>
        </div>
        <div className="lp-feature-grid">
          {features.map((feature, index) => (
            <article key={feature.title} className="lp-feature-card">
              <div className="lp-feature-index">0{index + 1}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-band">
        <div>
          <p className="lp-kicker">Workflow</p>
          <h2>From discovery to visit, fully orchestrated.</h2>
        </div>
        <div className="lp-flow">
          {['Search', 'Book', 'Queue', 'Treat', 'Review'].map(step => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2>Launch your clinic profile in minutes.</h2>
        <p>No setup complexity. No heavy onboarding. Start with core booking and queue workflows immediately.</p>
        <button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate('/register-clinic')}>
          Register Clinic
        </button>
      </section>
    </div>
  )
}
