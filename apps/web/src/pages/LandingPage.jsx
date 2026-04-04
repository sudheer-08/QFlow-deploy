import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Calendar, Bell, BarChart3, Brain, Star, ArrowRight, ChevronRight, Zap, Shield, Clock } from 'lucide-react'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ['clinics-count'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/patient/clinics`)
      const data = await response.json()
      return Array.isArray(data) ? data : []
    }
  })

  const activeClinicCount = isLoading ? null : clinics.length

  const features = [
    { icon: Activity, title: 'Live Queue Intelligence', desc: 'Track real-time queue depth across doctors and time windows.', color: '#1452ff' },
    { icon: Calendar, title: 'Online Booking Engine', desc: 'Convert discovery into confirmed appointments with fewer drop-offs.', color: '#00b48d' },
    { icon: Bell, title: 'Automated Follow-ups', desc: 'Send reminders and updates automatically over familiar channels.', color: '#7c3aed' },
    { icon: BarChart3, title: 'Operational Analytics', desc: 'Measure no-shows, utilization, and throughput in one dashboard.', color: '#f59e0b' },
    { icon: Brain, title: 'Smart Intake Layer', desc: 'Capture symptoms earlier to improve triage and appointment prep.', color: '#ec4899' },
    { icon: Star, title: 'Patient Trust Signals', desc: 'Surface verified reviews and care quality indicators clearly.', color: '#06b6d4' }
  ]

  const metrics = [
    { value: activeClinicCount === null ? '—' : `${activeClinicCount}+`, label: 'Active Clinics', icon: '🏥' },
    { value: '500+', label: 'Patients Served', icon: '👥' },
    { value: '4.8', label: 'Average Rating', icon: '⭐' },
    { value: '24x7', label: 'Digital Access', icon: '🌐' }
  ]

  const workflow = [
    { step: '01', label: 'Search', desc: 'Find clinics nearby' },
    { step: '02', label: 'Book', desc: 'Pick a time slot' },
    { step: '03', label: 'Queue', desc: 'Track live position' },
    { step: '04', label: 'Treat', desc: 'See the doctor' },
    { step: '05', label: 'Review', desc: 'Rate your visit' }
  ]

  return (
    <div className="lp-shell">
      <div className="lp-orb lp-orb-left" />
      <div className="lp-orb lp-orb-right" />
      <div className="lp-orb lp-orb-center" />

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
            Find Clinic <ArrowRight size={14} style={{ marginLeft: 4 }} />
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <div className="lp-hero-badge">
            <Zap size={12} />
            <span>Clinic Growth Platform</span>
          </div>
          <h1>Scale appointments without scaling front-desk chaos.</h1>
          <p>
            QFlow unifies booking, queue visibility, and patient communication into a single, practical workflow for modern clinics.
          </p>
          <div className="lp-hero-actions">
            <button type="button" className="lp-btn lp-btn-white" onClick={() => navigate('/register-clinic')}>
              List Your Clinic <ArrowRight size={14} />
            </button>
            <button type="button" className="lp-btn lp-btn-outline" onClick={() => navigate('/')}>
              Explore Patient App
            </button>
          </div>

          <div className="lp-trust-row">
            <div className="lp-trust-item">
              <Shield size={14} />
              <span>HIPAA Ready</span>
            </div>
            <div className="lp-trust-item">
              <Clock size={14} />
              <span>5-min Setup</span>
            </div>
            <div className="lp-trust-item">
              <Zap size={14} />
              <span>Real-time Sync</span>
            </div>
          </div>
        </div>

        <aside className="lp-hero-panel">
          <h3>What you launch with</h3>
          <ul>
            <li><ChevronRight size={14} /> Custom public clinic page</li>
            <li><ChevronRight size={14} /> Doctor-wise queue visibility</li>
            <li><ChevronRight size={14} /> Appointment and reminder workflow</li>
            <li><ChevronRight size={14} /> Actionable operations dashboard</li>
          </ul>
          <div className="lp-mini-metrics">
            <div>
              <strong>{activeClinicCount === null ? '…' : activeClinicCount}</strong>
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
            <div className="lp-metric-icon">{item.icon}</div>
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
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="lp-feature-card">
                <div className="lp-feature-icon-wrap" style={{ background: `${feature.color}12`, color: feature.color }}>
                  <Icon size={20} />
                </div>
                <div className="lp-feature-index">0{index + 1}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="lp-band">
        <div>
          <p className="lp-kicker">Workflow</p>
          <h2>From discovery to visit, fully orchestrated.</h2>
        </div>
        <div className="lp-flow">
          {workflow.map((item, i) => (
            <div key={item.label} className="lp-flow-step">
              <div className="lp-flow-num">{item.step}</div>
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
              {i < workflow.length - 1 && <div className="lp-flow-connector" />}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-glow" />
        <h2>Launch your clinic profile in minutes.</h2>
        <p>No setup complexity. No heavy onboarding. Start with core booking and queue workflows immediately.</p>
        <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => navigate('/register-clinic')}>
          Register Clinic <ArrowRight size={16} />
        </button>
      </section>
    </div>
  )
}
