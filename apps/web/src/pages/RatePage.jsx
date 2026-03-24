import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'

export default function RatePage() {
  const { tenantId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const clinicName = searchParams.get('clinic') || 'the clinic'
  const patientId = searchParams.get('patient')

  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (data) =>
      fetch(`${import.meta.env.VITE_API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: () => setSubmitted(true)
  })

  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🙏</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Thank You!</h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
          Your feedback helps other patients choose the right clinic.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 24 }}>
          {[1,2,3,4,5].map(s => (
            <span key={s} style={{ fontSize: 28, color: s <= rating ? colors[rating] : '#e2e8f0' }}>★</span>
          ))}
        </div>
        <button onClick={() => navigate('/')}
          style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Find More Clinics →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '40px 20px 28px', color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Rate Your Experience</h1>
        <p style={{ fontSize: 13, color: '#bfdbfe', margin: 0 }}>{clinicName}</p>
      </div>

      <div style={{ padding: 20 }}>

        {/* Star rating */}
        <div style={{ background: 'white', borderRadius: 20, padding: 24, marginBottom: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 20px' }}>
            How was your visit?
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            {[1,2,3,4,5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 40, transition: 'transform 0.1s', transform: (hover || rating) >= star ? 'scale(1.2)' : 'scale(1)' }}
              >
                <span style={{ color: (hover || rating) >= star ? colors[hover || rating] : '#e2e8f0' }}>★</span>
              </button>
            ))}
          </div>

          {(hover || rating) > 0 && (
            <p style={{ fontSize: 16, fontWeight: 700, color: colors[hover || rating], margin: 0 }}>
              {labels[hover || rating]}
            </p>
          )}
        </div>

        {/* Quick tags */}
        {rating > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 18, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>
              What did you like? (optional)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(rating >= 4
                ? ['Friendly staff', 'Short wait time', 'Clean clinic', 'Skilled doctor', 'Good explanation', 'Easy booking']
                : ['Long wait', 'Rude staff', 'Expensive', 'Unclear advice', 'Unclean', 'Hard to book']
              ).map(tag => {
                const selected = comment.includes(tag)
                return (
                  <button key={tag}
                    onClick={() => setComment(prev =>
                      selected ? prev.replace(tag, '').replace(', ,', ',').trim().replace(/^,|,$/, '').trim()
                               : prev ? `${prev}, ${tag}` : tag
                    )}
                    style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${selected ? '#2563eb' : '#e2e8f0'}`, background: selected ? '#eff6ff' : 'white', color: selected ? '#2563eb' : '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Comment */}
        {rating > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 18, marginBottom: 20, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>
              Add a comment (optional)
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience to help other patients..."
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
            />
          </div>
        )}

        <button
          onClick={() => reviewMutation.mutate({ tenantId, patientId, rating, comment })}
          disabled={rating === 0 || reviewMutation.isPending}
          style={{ width: '100%', background: rating > 0 ? '#2563eb' : '#e2e8f0', color: rating > 0 ? 'white' : '#94a3b8', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: rating > 0 ? 'pointer' : 'not-allowed' }}
        >
          {reviewMutation.isPending ? 'Submitting...' : '⭐ Submit Review'}
        </button>

        <button onClick={() => navigate('/')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
