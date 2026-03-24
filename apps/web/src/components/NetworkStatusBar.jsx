import { useEffect, useState } from 'react'

export default function NetworkStatusBar() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2000,
      background: '#b91c1c',
      color: 'white',
      padding: '10px 12px',
      textAlign: 'center',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: 0.2
    }}>
      You are offline. Changes may not sync until your connection is restored.
    </div>
  )
}
