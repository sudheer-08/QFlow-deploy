// Google Calendar sync — no API key needed!
// Uses Google Calendar URL format which is completely free

export default function AddToCalendar({ appointment }) {
  const {
    clinicName,
    doctorName,
    date,
    slotTime,
    clinicAddress,
    consultationFee,
    trackerToken
  } = appointment

  const addToGoogleCalendar = () => {
    // Format date and time for Google Calendar URL
    // Google Calendar needs: YYYYMMDDTHHMMSS format
    const dateStr = date?.replace(/-/g, '') // 2024-03-15 -> 20240315
    const timeStr = slotTime?.replace(':', '') + '00' // 09:30 -> 093000

    const startDateTime = `${dateStr}T${timeStr}`

    // End time = start + 30 minutes
    const [hours, minutes] = slotTime?.split(':').map(Number) || [9, 0]
    const endMinutes = minutes + 30
    const endHours = hours + Math.floor(endMinutes / 60)
    const endMin = endMinutes % 60
    const endTimeStr = `${String(endHours).padStart(2, '0')}${String(endMin).padStart(2, '0')}00`
    const endDateTime = `${dateStr}T${endTimeStr}`

    const title = encodeURIComponent(`🦷 Appointment at ${clinicName}`)
    const details = encodeURIComponent(
      `Doctor: ${doctorName}\n` +
      `Consultation Fee: ₹${consultationFee}\n` +
      `Track your appointment: ${window.location.origin}/track-appointment/${trackerToken}`
    )
    const location = encodeURIComponent(clinicAddress || clinicName)

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${location}&sf=true&output=xml`

    window.open(googleUrl, '_blank')
  }

  const addToAppleCalendar = () => {
    // Create .ics file for Apple Calendar / Outlook
    const dateStr = date?.replace(/-/g, '')
    const timeStr = slotTime?.replace(':', '') + '00'
    const startDateTime = `${dateStr}T${timeStr}`

    const [hours, minutes] = slotTime?.split(':').map(Number) || [9, 0]
    const endMinutes = minutes + 30
    const endHours = hours + Math.floor(endMinutes / 60)
    const endMin = endMinutes % 60
    const endTimeStr = `${String(endHours).padStart(2, '0')}${String(endMin).padStart(2, '0')}00`
    const endDateTime = `${dateStr}T${endTimeStr}`

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//QFlow//Appointment//EN
BEGIN:VEVENT
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:🦷 Appointment at ${clinicName}
DESCRIPTION:Doctor: ${doctorName}\\nFee: ₹${consultationFee}
LOCATION:${clinicAddress || clinicName}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `QFlow-Appointment-${date}.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!date || !slotTime) return null

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 14, fontFamily: 'sans-serif' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', margin: '0 0 4px' }}>
        🗓️ Add to Calendar
      </p>
      <p style={{ fontSize: 12, color: '#16a34a', margin: '0 0 12px' }}>
        Never miss your appointment — get a reminder automatically
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={addToGoogleCalendar}
          style={{ flex: 1, background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 14 }}>📅</span> Google Calendar
        </button>
        <button
          onClick={addToAppleCalendar}
          style={{ flex: 1, background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 14 }}>🍎</span> Apple / Outlook
        </button>
      </div>
    </div>
  )
}
