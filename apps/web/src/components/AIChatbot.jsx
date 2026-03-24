import { useState, useRef, useEffect } from 'react'

const QUICK_QUESTIONS = [
  'Which clinic has shortest wait?',
  'Best rated dental clinic?',
  'Any clinic open right now?',
  'Cheapest consultation fee?',
  'Clinic in Mohali?',
]

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m QFlow AI. I have live data on all dental clinics in Chandigarh & Mohali.\n\nAsk me anything — wait times, ratings, locations, or which clinic to choose!'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const sendMessage = async (text) => {
    const userMessage = text || input.trim()
    if (!userMessage || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6)
        })
      })

      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Sorry, something went wrong. Please try again.'
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Connection error. Please check your internet and try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isOpen ? '#dc2626' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: 22,
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s'
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Unread badge */}
      {!isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 68,
          right: 18,
          background: '#dc2626',
          color: 'white',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          zIndex: 1001,
          fontFamily: 'sans-serif'
        }}>
          AI
        </div>
      )}

      {/* Chat window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          right: 16,
          width: 'calc(100vw - 32px)',
          maxWidth: 380,
          height: 500,
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          fontFamily: 'sans-serif',
          overflow: 'hidden'
        }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>QFlow AI Assistant</p>
              <p style={{ color: '#bfdbfe', fontSize: 11, margin: 0 }}>Live clinic data • Always available</p>
            </div>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#2563eb' : '#f1f5f9',
                  color: msg.role === 'user' ? 'white' : '#0f172a',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f1f5f9', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#94a3b8',
                      animation: 'bounce 1s infinite',
                      animationDelay: `${i * 0.2}s`
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 2 && (
            <div style={{ padding: '6px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q}
                  onClick={() => sendMessage(q)}
                  style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid #e2e8f0', background: 'white', fontSize: 11, fontWeight: 500, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about clinics, wait times..."
              disabled={loading}
              style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', background: loading ? '#f8fafc' : 'white' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{ width: 38, height: 38, borderRadius: 10, background: input.trim() && !loading ? '#2563eb' : '#e2e8f0', color: 'white', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-4px) }
        }
      `}</style>
    </>
  )
}
