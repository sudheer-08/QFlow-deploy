import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import VoiceInput from '../components/VoiceInput'

// Public page — no login needed
// URL: /join/:subdomain  e.g. /join/citycare
export default function JoinPage() {
  const { subdomain } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    patientName: '',
    phone: '',
    symptoms: '',
    doctorId: '',
    visitType: 'first_visit'
  })
  const [step, setStep] = useState('form') // form | success

  // Fetch clinic info — doctors, wait times
  const { data: clinicInfo, isLoading, error } = useQuery({
    queryKey: ['clinic-info', subdomain],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/public/${subdomain}/info`)
        .then(r => r.json())
  })

  // Self-register mutation
  const registerMutation = useMutation({
    mutationFn: (data) =>
      fetch(`${import.meta.env.VITE_API_URL}/public/${subdomain}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) return alert(data.error)
      // Redirect to tracker page
      navigate(data.trackerUrl)
    }
  })

  if (isLoading) return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading clinic info...</p>
      </div>
    </div>
  )

  if (error || clinicInfo?.error) return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-xl font-bold text-gray-800">Clinic not found</h2>
        <p className="text-gray-500 mt-2">Check the link and try again</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800">
      {/* Clinic header */}
      <div className="px-6 py-8 text-center text-white">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-3xl font-bold">🏥</span>
        </div>
        <h1 className="text-2xl font-bold">{clinicInfo?.clinic?.name}</h1>
        <p className="text-blue-200 mt-1">Join the queue from here</p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-t-3xl min-h-screen px-6 pt-8 pb-12">

        {/* Doctor availability */}
        {clinicInfo?.doctors?.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Available Doctors
            </p>
            <div className="grid gap-3">
              {clinicInfo.doctors.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setForm({ ...form, doctorId: doc.id })}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                    form.doctorId === doc.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{doc.name}</p>
                    <p className="text-sm text-gray-500">{doc.currentQueueCount} patients ahead</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-600 font-semibold">~{doc.estimatedWaitMins} min</p>
                    <p className="text-xs text-gray-400">est. wait</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
            <input
              value={form.patientName}
              onChange={e => setForm({ ...form, patientName: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-gray-900"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              WhatsApp Number *
            </label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              type="tel"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-gray-900"
              placeholder="+91 98765 43210"
            />
            <p className="text-xs text-gray-400 mt-1">You'll receive your token on WhatsApp</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Describe your symptoms
            </label>
            <VoiceInput
              onResult={(text) => setForm({ ...form, symptoms: text })}
              placeholder="Tap mic or type your symptoms"
            />
            <textarea
              value={form.symptoms}
              onChange={e => setForm({ ...form, symptoms: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-gray-900"
              rows={3}
              placeholder="e.g. Fever since yesterday, headache, mild cough..."
              style={{ marginTop: 8 }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Visit Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'first_visit', label: 'First Visit' },
                { value: 'follow_up', label: 'Follow Up' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, visitType: opt.value })}
                  className={`py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
                    form.visitType === opt.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => registerMutation.mutate(form)}
            disabled={!form.patientName || !form.phone || !form.doctorId || registerMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-colors mt-4"
          >
            {registerMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Joining queue...
              </span>
            ) : (
              '🏥 Join Queue'
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            No account needed. You'll get live updates on WhatsApp.
          </p>
        </div>
      </div>
    </div>
  )
}
