import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import socket, { connectClinic } from '../socket'
import { useToast } from '../components/Toast'

export default function ReceptionPage() {
  const { user, logout } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    patientName: '', phone: '', symptoms: '',
    doctorId: '', isEmergency: false
  })
  const [registered, setRegistered] = useState(null)
  const [arrivedAlert, setArrivedAlert] = useState(null)
  const [noShowLoading, setNoShowLoading] = useState({})

  // Fetch doctors list
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => api.get('/queue/doctors').then(r => r.data)
  })

  // Fetch live queue
  const { data: queue = [] } = useQuery({
    queryKey: ['queue-live'],
    queryFn: () => api.get('/queue/live').then(r => r.data),
    refetchInterval: 30000
  })

  // Today's summary
  const { data: summary } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api.get('/analytics/summary/today').then(r => r.data),
    refetchInterval: 30000
  })

  // Register patient mutation
  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/queue/register', data),
    onSuccess: (res) => {
      setRegistered(res.data)
      setForm({ patientName: '', phone: '', symptoms: '', doctorId: '', isEmergency: false })
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    }
  })

  // Socket.io — real-time updates
  useEffect(() => {
    connectClinic(user.tenantId, user.id, user.role)
    socket.on('queue:patient_added', () => {
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    })
    socket.on('queue:token_called', () => queryClient.invalidateQueries(['queue-live']))
    socket.on('queue:entry_completed', () => {
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    })
    socket.on('queue:no_show', () => queryClient.invalidateQueries(['queue-live']))
    socket.on('patient:arrived', (data) => {
      setArrivedAlert(`${data.patientName} (${data.token}) has arrived at the clinic!`)
      setTimeout(() => setArrivedAlert(null), 5000)
      queryClient.invalidateQueries(['queue-live'])
    })
    return () => {
      socket.off('queue:patient_added')
      socket.off('queue:token_called')
      socket.off('queue:entry_completed')
      socket.off('queue:no_show')
      socket.off('patient:arrived')
    }
  }, [])

  const markNoShow = async (entryId) => {
    setNoShowLoading(p => ({ ...p, [entryId]: true }))
    try {
      await api.patch(`/no-show/queue/${entryId}/no-show`)
      toast.success('Marked as no-show, patient notified')
      queryClient.invalidateQueries(['queue-live'])
      queryClient.invalidateQueries(['summary-today'])
    } catch {
      toast.error('Failed to mark no-show')
    } finally {
      setNoShowLoading(p => ({ ...p, [entryId]: false }))
    }
  }

  const priorityColor = (p) => ({
    critical: 'bg-red-100 text-red-700 border-red-200',
    moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    routine:  'bg-green-100 text-green-700 border-green-200'
  })[p] || 'bg-gray-100 text-gray-700'

  const statusColor = (s) => ({
    waiting:     'bg-blue-100 text-blue-700',
    called:      'bg-orange-100 text-orange-700',
    in_progress: 'bg-purple-100 text-purple-700',
    done:        'bg-green-100 text-green-700'
  })[s] || 'bg-gray-100 text-gray-700'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">QFlow Reception</h1>
            <p className="text-xs text-gray-500">{user?.clinicName}</p>
          </div>
        </div>

        {/* ✅ Nav links to new pages */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/reception/bookings"
            className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
            📥 Bookings
          </Link>
          <Link to="/reception/waitlist"
            className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
            📋 Waitlist
          </Link>
          <Link to="/reception/dashboard"
            className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
            📊 Dashboard
          </Link>
        </div>

        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </header>

      {/* Arrived alert */}
      {arrivedAlert && (
        <div className="bg-green-500 text-white text-center py-3 px-6 font-medium animate-pulse">
          ✅ {arrivedAlert}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Stats bar */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Today',    value: summary?.total || 0,      color: 'bg-gray-800 text-white' },
            { label: 'Waiting',        value: summary?.waiting || 0,    color: 'bg-blue-600 text-white' },
            { label: 'In Progress',    value: summary?.inProgress || 0, color: 'bg-purple-600 text-white' },
            { label: 'Done',           value: summary?.done || 0,       color: 'bg-green-600 text-white' },
            { label: 'Remote Patients',value: summary?.remote || 0,     color: 'bg-indigo-600 text-white' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold">{s.value}</div>
              <div className="text-xs opacity-80 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Registration form */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-5">Register Walk-in Patient</h2>

          {registered && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
              <p className="font-bold text-green-800 text-lg">Token: {registered.token}</p>
              <p className="text-green-700 text-sm mt-1">Priority: {registered.priority}</p>
              {registered.aiSummary && (
                <p className="text-green-600 text-xs mt-1">AI: {registered.aiSummary}</p>
              )}
              <button
                onClick={() => setRegistered(null)}
                className="text-xs text-green-600 underline mt-2">
                Register another
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Name *
              </label>
              <input
                value={form.patientName}
                onChange={e => setForm({ ...form, patientName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (WhatsApp)
              </label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
              <textarea
                value={form.symptoms}
                onChange={e => setForm({ ...form, symptoms: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe symptoms..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
              <select
                value={form.doctorId}
                onChange={e => setForm({ ...form, doctorId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select doctor...</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isEmergency}
                onChange={e => setForm({ ...form, isEmergency: e.target.checked })}
                className="w-4 h-4 accent-red-600"
              />
              <span className="text-sm font-medium text-red-600">Mark as Emergency</span>
            </label>
            <button
              onClick={() => registerMutation.mutate(form)}
              disabled={!form.patientName || !form.doctorId || registerMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
              {registerMutation.isPending ? 'Registering...' : 'Generate Token'}
            </button>
          </div>
        </div>

        {/* Live Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-lg">Live Queue</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{queue.length} patients</span>
              <Link to="/reception/waitlist"
                className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg hover:bg-yellow-100">
                📋 Waitlist
              </Link>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">🏥</div>
              <p>Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {queue.map((entry) => (
                <div key={entry.id}
                  className="border rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="text-center min-w-[60px]">
                      <div className="font-bold text-blue-600 text-lg">
                        {entry.token_number}
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full border mt-1 ${priorityColor(entry.priority)}`}>
                        {entry.priority}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{entry.users?.name}</p>
                      <p className="text-xs text-gray-500">
                        {entry.symptoms?.substring(0, 50)}
                      </p>
                      {entry.ai_summary && (
                        <p className="text-xs text-indigo-600 mt-1">
                          🤖 {entry.ai_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(entry.status)}`}>
                          {entry.status}
                        </span>
                        {entry.registration_type === 'self_registered' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            📱 Remote
                          </span>
                        )}
                        {entry.arrival_status === 'at_home' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                            🏠 At home
                          </span>
                        )}
                        {entry.arrival_status === 'arrived' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            ✅ Arrived
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ✅ Right side — time + no-show button */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(entry.registered_at).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {entry.status === 'waiting' && (
                      <button
                        onClick={() => markNoShow(entry.id)}
                        disabled={noShowLoading[entry.id]}
                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
                        {noShowLoading[entry.id] ? '...' : '✗ No-show'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}