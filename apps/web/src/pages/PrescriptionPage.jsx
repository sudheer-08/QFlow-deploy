import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { smartBack } from '../utils/navigation'

export default function PrescriptionPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const goBack = () => smartBack(navigate, '/doctor')
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const patientId = searchParams.get('patient')
  const patientName = searchParams.get('name')
  const queueEntryId = searchParams.get('entry')

  const [form, setForm] = useState({
    chiefComplaint: '',
    diagnosis: '',
    medicines: [{ name: '', dosage: '', duration: '', instructions: '' }],
    advice: '',
    followUpDate: '',
    followUpNotes: ''
  })

  const addMedicine = () => {
    setForm(f => ({ ...f, medicines: [...f.medicines, { name: '', dosage: '', duration: '', instructions: '' }] }))
  }

  const updateMedicine = (idx, field, value) => {
    const updated = [...form.medicines]
    updated[idx] = { ...updated[idx], [field]: value }
    setForm(f => ({ ...f, medicines: updated }))
  }

  const removeMedicine = (idx) => {
    setForm(f => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }))
  }

  const saveMutation = useMutation({
    mutationFn: (data) => api.post('/health-records/notes', data),
    onSuccess: () => {
      toast.success('Prescription saved! Patient will receive it by email.')
      navigate('/doctor')
    },
    onError: () => toast.error('Failed to save prescription')
  })

  const handleSave = () => {
    const prescriptionText = `
DIAGNOSIS: ${form.diagnosis}

MEDICINES:
${form.medicines.map((m, i) => `${i+1}. ${m.name} - ${m.dosage} - ${m.duration}\n   Instructions: ${m.instructions}`).join('\n')}

ADVICE: ${form.advice}

${form.followUpDate ? `FOLLOW UP: ${new Date(form.followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
${form.followUpNotes ? `Notes: ${form.followUpNotes}` : ''}
    `.trim()

    saveMutation.mutate({
      patientId,
      queueEntryId,
      diagnosis: form.diagnosis,
      prescription: prescriptionText,
      notes: form.chiefComplaint,
      followUpDate: form.followUpDate || null
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={goBack} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', margin: 0 }}>Digital Prescription</h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Patient: {patientName || 'Unknown'}</p>
        </div>
        <div style={{ marginLeft: 'auto', background: '#eff6ff', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
          Dr. {user?.name}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Prescription header */}
        <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', borderRadius: 16, padding: '16px', color: 'white', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: '#bfdbfe', margin: '0 0 2px' }}>PRESCRIPTION</p>
            <p style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Dr. {user?.name}</p>
            <p style={{ fontSize: 12, color: '#bfdbfe', margin: 0 }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#bfdbfe', margin: '0 0 2px' }}>PATIENT</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{patientName}</p>
          </div>
        </div>

        {/* Chief complaint */}
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Chief Complaint</label>
          <textarea value={form.chiefComplaint} onChange={e => setForm({...form, chiefComplaint: e.target.value})}
            placeholder="Patient's main complaint..."
            rows={2}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
        </div>

        {/* Diagnosis */}
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Diagnosis *</label>
          <textarea value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})}
            placeholder="e.g. Dental caries in upper left molar..."
            rows={2}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
        </div>

        {/* Medicines */}
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Medicines</label>
            <button onClick={addMedicine} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {form.medicines.map((med, idx) => (
              <div key={idx} style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Medicine {idx + 1}</span>
                  {form.medicines.length > 1 && (
                    <button onClick={() => removeMedicine(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)}
                    placeholder="Medicine name *"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)}
                      placeholder="Dosage (e.g. 500mg)"
                      style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
                    <input value={med.duration} onChange={e => updateMedicine(idx, 'duration', e.target.value)}
                      placeholder="Duration (e.g. 5 days)"
                      style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
                  </div>
                  <input value={med.instructions} onChange={e => updateMedicine(idx, 'instructions', e.target.value)}
                    placeholder="Instructions (e.g. After meals)"
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advice */}
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Advice & Instructions</label>
          <textarea value={form.advice} onChange={e => setForm({...form, advice: e.target.value})}
            placeholder="e.g. Avoid cold drinks for 3 days. Brush gently..."
            rows={3}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
        </div>

        {/* Follow up */}
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Follow Up (optional)</label>
          <input value={form.followUpDate} onChange={e => setForm({...form, followUpDate: e.target.value})}
            type="date" min={new Date().toISOString().split('T')[0]}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          <input value={form.followUpNotes} onChange={e => setForm({...form, followUpNotes: e.target.value})}
            placeholder="Follow up notes..."
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>

      </div>

      {/* Bottom save button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
        <button onClick={handleSave} disabled={!form.diagnosis || saveMutation.isPending}
          style={{ width: '100%', background: form.diagnosis ? '#2563eb' : '#e2e8f0', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {saveMutation.isPending ? 'Saving...' : '💾 Save & Send to Patient'}
        </button>
      </div>
    </div>
  )
}
