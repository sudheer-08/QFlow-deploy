import { useState } from 'react'

export default function ShareToken({ token, clinicName, patientName, trackerUrl }) {
  const [copied, setCopied] = useState(false)

  const shareMessage = `Hi! I'm waiting at ${clinicName}.\nTrack my position live:\n${trackerUrl}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `QFlow — ${patientName}'s Queue Token`,
          text: shareMessage,
          url: trackerUrl
        })
      } catch (err) {
        copyToClipboard()
      }
    } else {
      copyToClipboard()
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${shareMessage}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
    window.open(url, '_blank')
  }

  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: 14, fontFamily: 'sans-serif' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', margin: '0 0 10px' }}>
        📤 Share with family
      </p>
      <p style={{ fontSize: 12, color: '#3b82f6', margin: '0 0 12px' }}>
        Let family track your position live — they'll know when you're called
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={shareWhatsApp}
          style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          💬 Share on WhatsApp
        </button>
        <button onClick={handleShare}
          style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? '✅ Copied!' : '📋 Copy Link'}
        </button>
      </div>
    </div>
  )
}
