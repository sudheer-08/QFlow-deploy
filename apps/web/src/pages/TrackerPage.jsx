import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import socket, { connectTracker } from '../socket'
import ShareToken from '../components/ShareToken'

// Public page — no login needed
// URL: /track/:trackerToken
export default function TrackerPage() {
  const { trackerToken } = useParams()
  const [liveData, setLiveData] = useState(null)
  const [arrivedConfirmed, setArrivedConfirmed] = useState(false)
  const [called, setCalled] = useState(false)

  // Fetch initial tracker data
  const { data, isLoading, error } = useQuery({
    queryKey: ['tracker', trackerToken],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/public/track/${trackerToken}`)
        .then(r => r.json()),
    refetchInterval: 60000  // Refetch every minute as backup
  })

  // Merge server data with live socket updates
  const info = liveData || data

  // Confirm arrival mutation
  const arrivalMutation = useMutation({
    mutationFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/public/track/${trackerToken}/arrived`, {
        method: 'POST'
      }).then(r => r.json()),
    onSuccess: () => setArrivedConfirmed(true)
  })

  // Connect to personal Socket.io room for live updates
  useEffect(() => {
    connectTracker(trackerToken)

    // Live position update — fires whenever queue changes
    socket.on('patient:position_update', (update) => {
      setLiveData(prev => ({ ...prev, ...update }))
    })

    // Called by doctor
    socket.on('patient:called', (update) => {
      setCalled(true)
      setLiveData(prev => ({ ...prev, status: 'called', ...update }))
    })

    return () => {
      socket.off('patient:position_update')
      socket.off('patient:called')
    }
  }, [trackerToken])

  if (isLoading) return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>Loading your queue status...</p>
      </div>
    </div>
  )

  if (error || data?.error) return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-xl font-bold">Token not found</h2>
        <p className="text-gray-500 mt-2">This link may have expired</p>
      </div>
    </div>
  )

  // CALLED state — big alert
  if (info?.status === 'called' || called) return (
    <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-8 text-white text-center">
      <div className="text-8xl mb-6 animate-bounce">🔔</div>
      <h1 className="text-4xl font-black mb-3">Your Turn!</h1>
      <p className="text-2xl font-bold mb-2">{info?.token}</p>
      <p className="text-green-100 text-xl mb-8">
        {info?.doctorName} is ready for you
      </p>
      <div className="bg-white/20 rounded-2xl p-6 w-full max-w-sm">
        <p className="text-lg font-semibold">Please proceed to the</p>
        <p className="text-3xl font-black mt-1">Consultation Room</p>
      </div>
    </div>
  )

  // DONE state
  if (info?.status === 'done') return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-7xl mb-6">✅</div>
      <h1 className="text-3xl font-bold text-gray-800">Consultation Complete</h1>
      <p className="text-gray-500 mt-3">Thank you for visiting {info?.clinicName}</p>
    </div>
  )

  const progressPercent = info?.tokensAhead === 0 ? 100 : Math.max(10, 100 - (info?.tokensAhead * 15))

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800">
      {/* Header */}
      <div className="px-6 pt-10 pb-6 text-center text-white">
        <p className="text-blue-200 text-sm mb-1">{info?.clinicName}</p>
        <h1 className="text-5xl font-black mb-2">{info?.token}</h1>
        <p className="text-blue-200">Hi {info?.patientName}! 👋</p>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-t-3xl min-h-screen px-6 pt-8 pb-12">

        {/* Called alert */}
        {called && (
          <div className="bg-green-500 text-white rounded-2xl p-4 mb-6 text-center font-bold animate-pulse">
            🔔 The doctor is calling you now!
          </div>
        )}

        {/* Position */}
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline gap-2">
            <span className="text-7xl font-black text-blue-600">{info?.position}</span>
            <span className="text-2xl text-gray-400">/ queue</span>
          </div>
          <p className="text-gray-500 mt-2">
            {info?.tokensAhead === 0
              ? 'You are next! 🎉'
              : `${info?.tokensAhead} patient${info?.tokensAhead === 1 ? '' : 's'} ahead of you`}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-gray-100 rounded-full h-3 mb-6">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{info?.estimatedWaitMins}</p>
            <p className="text-sm text-gray-500 mt-1">Est. minutes</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-gray-700 mt-1">{info?.doctorName}</p>
            <p className="text-xs text-gray-400 mt-1">Your doctor</p>
          </div>
        </div>

        {/* Arrival confirmation for remote patients */}
        {info?.arrivalStatus === 'at_home' && !arrivedConfirmed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 mb-6">
            <p className="font-semibold text-yellow-800 mb-1">Are you at the clinic?</p>
            <p className="text-sm text-yellow-700 mb-4">
              Tap below when you arrive so the receptionist knows you're here.
            </p>
            <button
              onClick={() => arrivalMutation.mutate()}
              disabled={arrivalMutation.isPending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl"
            >
              {arrivalMutation.isPending ? 'Confirming...' : "✅ I've Arrived at the Clinic"}
            </button>
          </div>
        )}

        {(info?.arrivalStatus === 'arrived' || arrivedConfirmed) && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-center">
            <p className="text-green-700 font-semibold">✅ Arrival confirmed! The clinic knows you're here.</p>
          </div>
        )}

        {/* Share with family */}
        <div style={{ marginBottom: 12 }}>
          <ShareToken
            token={info?.token}
            clinicName={info?.clinicName}
            patientName={info?.patientName}
            trackerUrl={window.location.href}
          />
        </div>

        {/* Tips */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">While you wait</p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>📱 This page updates live — no need to refresh</p>
            <p>💬 You'll also get a WhatsApp message when it's your turn</p>
            <p>🏥 Head to the clinic when you're 2nd in line</p>
          </div>
        </div>
      </div>
    </div>
  )
}
