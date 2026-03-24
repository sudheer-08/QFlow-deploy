import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

export default function QRPosterPage() {
  const { subdomain } = useParams()
  const canvasRef = useRef(null)

  const { data: clinic } = useQuery({
    queryKey: ['clinic-poster', subdomain],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics/${subdomain}`).then(r => r.json())
  })

  const joinUrl = `${window.location.origin}/join/${subdomain}`

  // Generate QR code using Google Charts API (free, no key needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=1e40af&margin=10`

  const handlePrint = () => window.print()

  const handleDownload = () => {
    const img = document.getElementById('qr-image')
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 800
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 600, 800)

    // Blue header
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, 600, 160)

    // Title
    ctx.fillStyle = 'white'
    ctx.font = 'bold 32px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🦷 ' + (clinic?.name || subdomain), 300, 60)

    ctx.font = '18px sans-serif'
    ctx.fillText('Scan to join queue from your phone', 300, 100)
    ctx.fillText('No waiting room • Real-time updates', 300, 130)

    // QR code
    ctx.drawImage(img, 150, 200, 300, 300)

    // URL
    ctx.fillStyle = '#1e40af'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(joinUrl, 300, 560)

    // Footer
    ctx.fillStyle = '#64748b'
    ctx.font = '14px sans-serif'
    ctx.fillText('Powered by QFlow • qflow.app', 300, 620)

    const link = document.createElement('a')
    link.download = `QFlow-QR-${subdomain}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>

      {/* Controls - hide on print */}
      <div className="no-print" style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
        <button onClick={() => window.history.back()} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
        <button onClick={handlePrint} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print Poster</button>
        <button onClick={handleDownload} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇️ Download PNG</button>
      </div>

      {/* Poster */}
      <div id="qr-poster" style={{ maxWidth: 400, margin: '20px auto', background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '28px 24px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🦷</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>{clinic?.name || subdomain}</h1>
          <p style={{ fontSize: 14, color: '#bfdbfe', margin: 0 }}>Skip the waiting room!</p>
        </div>

        {/* QR Code */}
        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, display: 'inline-block', marginBottom: 16 }}>
            <img id="qr-image" src={qrUrl} alt="QR Code" width={220} height={220} style={{ display: 'block' }} crossOrigin="anonymous" />
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Scan to Join Queue</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
            Open your phone camera and scan this QR code to join our queue from anywhere — no need to wait inside!
          </p>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20 }}>
            {[
              ['1️⃣', 'Scan QR code with your phone camera'],
              ['2️⃣', 'Fill your name and symptoms'],
              ['3️⃣', 'Wait at home — get notified when it\'s your turn'],
            ].map(([num, text]) => (
              <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>{num}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* URL */}
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>Or open this link:</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', margin: 0, wordBreak: 'break-all' }}>{joinUrl}</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', padding: '14px 24px', textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Powered by <strong style={{ color: '#2563eb' }}>QFlow</strong> — Real-time clinic queue management</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #qr-poster { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
        }
      `}</style>
    </div>
  )
}
