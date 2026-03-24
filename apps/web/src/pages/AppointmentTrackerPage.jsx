import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AddToCalendar from '../components/AddToCalendar'

export default function AppointmentTrackerPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appt-tracker', token],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/appointments/track/${token}`)
        .then(r => r.json()),
    refetchInterval: 30000
  })

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#93c5fd' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🦷</div>
        <p>Loading appointment...</p>
      </div>
    </div>
  )

  if (!appt || appt.error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <p>Appointment not found</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>Go Home</button>
      </div>
    </div>
  )

  const statusConfig = {
    confirmed: { bg: '#eff6ff', color: '#1d4ed8', icon: '✅', text: 'Confirmed' },
    completed: { bg: '#f0fdf4', color: '#15803d', icon: '🎉', text: 'Completed' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', icon: '❌', text: 'Cancelled' },
    pending: { bg: '#fefce8', color: '#ca8a04', icon: '⏳', text: 'Pending' },
  }
  const statusInfo = statusConfig[appt.status] || statusConfig.confirmed

  const appointmentDate = new Date(appt.date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '32px 20px 24px', color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🦷</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Appointment Details</h1>
        <p style={{ fontSize: 13, color: '#bfdbfe', margin: 0 }}>{appt.clinicName}</p>
      </div>

      <div style={{ padding: '16px 16px 80px' }}>

        {/* Status badge */}
        <div style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.color}30`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{statusInfo.icon}</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: statusInfo.color, margin: '0 0 2px' }}>{statusInfo.text}</p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              {appt.status === 'confirmed' ? 'Your appointment is confirmed' :
               appt.status === 'completed' ? 'Consultation completed' :
               appt.status === 'cancelled' ? 'This appointment was cancelled' : ''}
            </p>
          </div>
        </div>

        {/* Appointment card */}
        <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' }}>Appointment Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['📅 Date', appointmentDate],
              ['⏰ Time', appt.time],
              ['👨‍⚕️ Doctor', appt.doctorName],
              ['👤 Patient', appt.patientName],
              ['🏥 Clinic', appt.clinicName],
              ['📍 Address', appt.clinicAddress],
              ['📞 Clinic Phone', appt.clinicPhone],
            ].filter(([_, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: 13, color: '#64748b', minWidth: 120 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'right', flex: 1 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>💰 Consultation Fee</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>₹{appt.consultationFee}</span>
            </div>
          </div>
        </div>

        {/* Add to Calendar */}
        {appt?.status === 'confirmed' && (
          <div style={{ marginBottom: 16 }}>
            <AddToCalendar appointment={{
              clinicName: appt.clinicName,
              doctorName: appt.doctorName,
              date: appt.date,
              slotTime: appt.time,
              clinicAddress: appt.clinicAddress,
              consultationFee: appt.consultationFee,
              trackerToken: token
            }} />
          </div>
        )}

        {/* Reminder tips */}
        {appt.status === 'confirmed' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', margin: '0 0 8px' }}>📋 Before your appointment</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#166534' }}>
              <p style={{ margin: 0 }}>✓ Arrive 5 minutes before your slot time</p>
              <p style={{ margin: 0 }}>✓ Bring any previous dental records or X-rays</p>
              <p style={{ margin: 0 }}>✓ Fee of ₹{appt.consultationFee} to be paid at clinic</p>
              <p style={{ margin: 0 }}>✓ You'll get a WhatsApp reminder 1 hour before</p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom actions */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
        <button onClick={() => navigate('/')}
          style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Book Another
        </button>
        {appt.clinicPhone && (
          <a href={`tel:${appt.clinicPhone}`}
            style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            📞 Call Clinic
          </a>
        )}
      </div>
    </div>
  )
}
