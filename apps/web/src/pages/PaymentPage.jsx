import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AddToCalendar from '../components/AddToCalendar'

export default function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const booking = location.state || {}

  const [step, setStep] = useState('select') // select | processing | success | failed
  const [method, setMethod] = useState('upi')
  const [upiId, setUpiId] = useState('')
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' })
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  // If no booking data redirect home
  useEffect(() => {
    if (!booking.appointmentId) navigate('/')
  }, [])

  const handlePay = async () => {
    // Basic validation
    if (method === 'upi' && !upiId) return setError('Please enter UPI ID')
    if (method === 'card') {
      if (card.number.length < 16) return setError('Enter valid card number')
      if (!card.expiry) return setError('Enter expiry date')
      if (card.cvv.length < 3) return setError('Enter valid CVV')
      if (!card.name) return setError('Enter cardholder name')
    }

    setError('')
    setStep('processing')

    // Simulate payment processing with progress bar
    let p = 0
    const interval = setInterval(() => {
      p += Math.random() * 20
      if (p >= 100) {
        p = 100
        clearInterval(interval)
        setTimeout(() => {
          // 95% success rate simulation
          Math.random() > 0.05 ? setStep('success') : setStep('failed')
        }, 500)
      }
      setProgress(Math.min(p, 100))
    }, 300)
  }

  // Processing screen
  if (step === 'processing') return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: 'white', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320, width: '100%' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: '4px solid #1e40af', borderTop: '4px solid #60a5fa', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Processing Payment</h2>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 28px' }}>Please do not close this window</p>

        {/* Progress bar */}
        <div style={{ background: '#1e293b', borderRadius: 99, height: 8, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg, #2563eb, #60a5fa)', height: '100%', width: `${progress}%`, borderRadius: 99, transition: 'width 0.3s ease' }} />
        </div>
        <p style={{ fontSize: 13, color: '#64748b' }}>{Math.round(progress)}%</p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Connecting to bank', done: progress > 20 },
            { label: 'Verifying payment', done: progress > 50 },
            { label: 'Confirming booking', done: progress > 80 },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: item.done ? 1 : 0.4 }}>
              <span style={{ fontSize: 14 }}>{item.done ? '✅' : '⏳'}</span>
              <span style={{ fontSize: 13, color: item.done ? '#86efac' : '#64748b' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // Success screen
  if (step === 'success') return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>

        {/* Success animation */}
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>
          ✅
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Payment Successful!</h2>
        <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, margin: '0 0 4px' }}>₹{booking.consultationFee} paid</p>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 24px' }}>Confirmation sent to your WhatsApp</p>

        {/* Receipt */}
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #e2e8f0' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Transaction ID</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
              QF{Date.now().toString().slice(-8)}
            </span>
          </div>
          {[
            ['🏥 Clinic', booking.clinicName],
            ['👨‍⚕️ Doctor', booking.doctorName],
            ['📅 Date', new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
            ['⏰ Time', booking.slotTime],
            ['💳 Method', method === 'upi' ? `UPI (${upiId})` : method === 'card' ? 'Credit/Debit Card' : 'Net Banking'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>{label}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '1px dashed #e2e8f0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Amount Paid</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>₹{booking.consultationFee}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/track-appointment/${booking.trackerToken}`)}
          style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}
        >
          View Appointment →
        </button>

        {/* Add to calendar */}
        <div style={{ marginBottom: 10 }}>
          <AddToCalendar appointment={{
            clinicName: booking.clinicName,
            doctorName: booking.doctorName,
            date: booking.date,
            slotTime: booking.slotTime,
            consultationFee: booking.consultationFee,
            trackerToken: booking.trackerToken
          }} />
        </div>

        <button
          onClick={() => navigate('/')}
          style={{ width: '100%', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Back to Home
        </button>
      </div>
    </div>
  )

  // Failed screen
  if (step === 'failed') return (
    <div style={{ minHeight: '100vh', background: '#fff1f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>❌</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Payment Failed</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>Your booking is saved. Please try again.</p>
        <button onClick={() => { setStep('select'); setProgress(0) }}
          style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          Try Again
        </button>
        <button onClick={() => navigate('/')}
          style={{ width: '100%', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Pay at Clinic
        </button>
      </div>
    </div>
  )

  // Payment selection screen
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ background: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0' }}>
        <button onClick={() => navigate(-1)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Complete Payment</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Secure checkout</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>🔒 Secured</span>
        </div>
      </div>

      {/* Amount summary */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '20px 16px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: '0 0 2px' }}>Consultation Fee</p>
            <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>₹{booking.consultationFee || 300}</p>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>{booking.clinicName} · {booking.doctorName}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: '0 0 2px' }}>Appointment</p>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{booking.slotTime}</p>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>
              {booking.date && new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Payment method selector */}
        <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Payment Method</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'upi', icon: '📲', label: 'UPI' },
            { id: 'card', icon: '💳', label: 'Card' },
            { id: 'netbanking', icon: '🏦', label: 'Net Banking' },
          ].map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              style={{ flex: 1, padding: '12px 8px', borderRadius: 12, border: `2px solid ${method === m.id ? '#2563eb' : '#e2e8f0'}`, background: method === m.id ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: method === m.id ? '#2563eb' : '#374151' }}>{m.label}</div>
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* UPI Form */}
        {method === 'upi' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>Enter UPI ID</p>
            <input value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Supported: GPay, PhonePe, Paytm, BHIM</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                <button key={app} onClick={() => setUpiId(`${form?.patientName?.toLowerCase().replace(' ', '') || 'user'}@${app.toLowerCase()}`)}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  {app}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card Form */}
        {method === 'card' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>Card Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Card Number</label>
                <input
                  value={card.number.replace(/(.{4})/g, '$1 ').trim()}
                  onChange={e => setCard({ ...card, number: e.target.value.replace(/\s/g, '').slice(0, 16) })}
                  placeholder="1234 5678 9012 3456"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', letterSpacing: '0.1em' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Expiry</label>
                  <input value={card.expiry} onChange={e => setCard({ ...card, expiry: e.target.value })}
                    placeholder="MM/YY" maxLength={5}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>CVV</label>
                  <input value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.slice(0, 3) })}
                    placeholder="•••" type="password" maxLength={3}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Cardholder Name</label>
                <input value={card.name} onChange={e => setCard({ ...card, name: e.target.value })}
                  placeholder="Name on card"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        )}

        {/* Net Banking */}
        {method === 'netbanking' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>Select Bank</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'Kotak', 'Yes Bank', 'Other'].map(bank => (
                <button key={bank}
                  style={{ padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', textAlign: 'left' }}>
                  🏦 {bank}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>🔒 256-bit SSL encrypted · Safe & Secure</span>
        </div>
      </div>

      {/* Pay button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
        <button onClick={handlePay}
          style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🔒 Pay ₹{booking.consultationFee || 300} Now
        </button>
      </div>
    </div>
  )
}
