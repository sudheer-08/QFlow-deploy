import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDES = [
  {
    emoji: '📍',
    title: 'Find Clinics Near You',
    desc: 'See all dental clinics in Chandigarh & Mohali on a live map with real-time wait times and ratings.',
    bg: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
  },
  {
    emoji: '📅',
    title: 'Book in 30 Seconds',
    desc: 'Choose your doctor, pick a time slot, and confirm your appointment — no phone calls needed.',
    bg: 'linear-gradient(135deg, #065f46, #059669)',
  },
  {
    emoji: '🏠',
    title: 'Wait at Home',
    desc: 'Skip the waiting room! We notify you when to head to the clinic — only when it is almost your turn.',
    bg: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
  },
  {
    emoji: '🤖',
    title: 'AI-Powered Care',
    desc: 'Our AI analyzes your symptoms, prioritizes urgent cases, and helps you find the right doctor.',
    bg: 'linear-gradient(135deg, #9a3412, #ea580c)',
  }
]

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  const finish = () => {
    localStorage.setItem('qflow_onboarded', 'true')
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: slide.bg, display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', transition: 'background 0.5s ease' }}>

      {/* Skip button */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={finish} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 99, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Skip
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>

        {/* Emoji illustration */}
        <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, marginBottom: 32, animation: 'float 3s ease-in-out infinite' }}>
          {slide.emoji}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', margin: '0 0 16px', lineHeight: 1.2 }}>
          {slide.title}
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, margin: 0, maxWidth: 300 }}>
          {slide.desc}
        </p>
      </div>

      {/* Bottom section */}
      <div style={{ padding: '0 24px 48px' }}>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {SLIDES.map((_, idx) => (
            <div key={idx} onClick={() => setCurrent(idx)}
              style={{ width: idx === current ? 24 : 8, height: 8, borderRadius: 99, background: idx === current ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s', cursor: 'pointer' }} />
          ))}
        </div>

        {/* CTA button */}
        {isLast ? (
          <button onClick={finish}
            style={{ width: '100%', background: 'white', color: '#1e40af', border: 'none', borderRadius: 16, padding: '16px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            🦷 Find Clinics Near Me →
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={finish}
              style={{ flex: 1, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Skip
            </button>
            <button onClick={() => setCurrent(current + 1)}
              style={{ flex: 2, background: 'white', color: '#1e40af', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
              Next →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-12px) }
        }
      `}</style>
    </div>
  )
}
