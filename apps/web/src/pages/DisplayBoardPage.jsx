import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import socket, { connectClinic } from '../socket'

// This page runs on the clinic TV — no login needed
// URL: /display?tenant=TENANT_ID
export default function DisplayBoardPage() {
  const [searchParams] = useSearchParams()
  const tenantId = searchParams.get('tenant')
  const [lastCalled, setLastCalled] = useState(null)
  const [flash, setFlash] = useState(false)

  const { data: queue = [] } = useQuery({
    queryKey: ['display-queue', tenantId],
    queryFn: () => api.get('/queue/live').then(r => r.data),
    refetchInterval: 15000,
    enabled: !!tenantId
  })

  const called = queue.filter(e => e.status === 'called' || e.status === 'in_progress')
  const waiting = queue.filter(e => e.status === 'waiting').slice(0, 6)

  useEffect(() => {
    if (!tenantId) return
    // Connect to real-time updates for this clinic
    if (!socket.connected) socket.connect()
    socket.emit('connect_clinic', { tenantId, userId: 'display', role: 'display' })

    socket.on('queue:token_called', (data) => {
      setLastCalled(data)
      setFlash(true)
      setTimeout(() => setFlash(false), 3000)
    })

    return () => socket.off('queue:token_called')
  }, [tenantId])

  const priorityColor = (p) => ({
    critical: 'text-red-400',
    moderate: 'text-yellow-400',
    routine: 'text-green-400'
  })[p] || 'text-gray-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* Flash overlay when token is called */}
      {flash && (
        <div className="fixed inset-0 bg-blue-500 opacity-20 z-50 pointer-events-none animate-ping" />
      )}

      {/* Header */}
      <div className="bg-gray-900 px-8 py-5 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">Q</span>
          </div>
          <span className="text-xl font-bold text-white">QFlow</span>
        </div>
        <div className="text-gray-400 text-lg">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="flex flex-1 gap-0">

        {/* NOW SERVING — left panel */}
        <div className="w-1/2 bg-blue-900 flex flex-col items-center justify-center p-12 border-r border-blue-800">
          <p className="text-blue-300 text-xl font-semibold tracking-widest uppercase mb-6">
            Now Serving
          </p>

          {called.length > 0 ? (
            called.map((entry) => (
              <div key={entry.id} className="text-center">
                <div className={`text-9xl font-black tracking-tight mb-4 ${flash ? 'text-yellow-400' : 'text-white'} transition-colors duration-500`}>
                  {entry.token_number}
                </div>
                <div className="text-blue-200 text-2xl">{entry.doctors?.name}</div>
                {entry.registration_type === 'self_registered' && (
                  <div className="mt-3 text-blue-300 text-sm">📱 Remote Patient</div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center opacity-40">
              <div className="text-8xl font-black text-blue-300">---</div>
              <p className="text-blue-400 text-xl mt-4">Waiting for next call</p>
            </div>
          )}
        </div>

        {/* NEXT UP — right panel */}
        <div className="w-1/2 bg-gray-900 flex flex-col p-8">
          <p className="text-gray-400 text-lg font-semibold tracking-widest uppercase mb-6">
            Next in Queue
          </p>

          {waiting.length === 0 ? (
            <div className="flex-1 flex items-center justify-center opacity-30">
              <p className="text-gray-500 text-xl">Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {waiting.map((entry, idx) => (
                <div key={entry.id} className="flex items-center justify-between bg-gray-800 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 font-medium w-8">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-white text-2xl font-bold">{entry.token_number}</span>
                        <span className={`text-sm font-medium ${priorityColor(entry.priority)}`}>
                          {entry.priority === 'critical' ? '🔴' : entry.priority === 'moderate' ? '🟡' : '🟢'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{entry.doctors?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {entry.registration_type === 'self_registered' && (
                      <span className="text-xs text-indigo-400 block">📱 Remote</span>
                    )}
                    {entry.arrival_status === 'at_home' && (
                      <span className="text-xs text-yellow-400 block">🏠 En route</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats footer */}
          <div className="mt-auto pt-6 border-t border-gray-800 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{waiting.length}</div>
              <div className="text-gray-500 text-sm">Waiting</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {waiting.length > 0 ? `~${waiting.length * 8}` : '0'} min
              </div>
              <div className="text-gray-500 text-sm">Est. Wait</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
