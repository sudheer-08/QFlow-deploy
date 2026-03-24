import { useState, useEffect, useRef } from 'react'

export default function VoiceInput({ onResult, placeholder = "Tap mic and speak your symptoms..." }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-IN' // Indian English

      recognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        const currentText = finalTranscript || interimTranscript
        setTranscript(currentText)

        if (finalTranscript) {
          onResult(finalTranscript)
          setListening(false)
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech error:', event.error)
        setError(event.error === 'not-allowed'
          ? 'Microphone access denied. Please allow microphone permission.'
          : 'Could not understand. Please try again.')
        setListening(false)
      }

      recognition.onend = () => {
        setListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const startListening = () => {
    if (!recognitionRef.current) return
    setError('')
    setTranscript('')
    setListening(true)
    recognitionRef.current.start()
  }

  const stopListening = () => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
    setListening(false)
  }

  if (!supported) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

        {/* Mic button */}
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: listening
              ? 'linear-gradient(135deg, #dc2626, #ef4444)'
              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: listening ? '0 0 0 6px rgba(220, 38, 38, 0.2)' : 'none',
            transition: 'all 0.3s',
            flexShrink: 0
          }}
        >
          {listening ? '⏹' : '🎤'}
        </button>

        {/* Status text */}
        <div style={{ flex: 1 }}>
          {listening ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 3,
                    background: '#dc2626',
                    borderRadius: 99,
                    animation: 'voiceBar 0.8s infinite',
                    animationDelay: `${i * 0.15}s`,
                    height: 16
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                {transcript || 'Listening...'}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              {transcript || placeholder}
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>
      )}

      <style>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.4) }
          50% { transform: scaleY(1.2) }
        }
      `}</style>
    </div>
  )
}
