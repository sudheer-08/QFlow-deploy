import { useState, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'
import './ConsultationNotes.css'

export default function ConsultationNotes({ notes, setNotes, patientName }) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in your browser')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          setNotes((prev) => prev + (prev ? ' ' : '') + transcript)
        } else {
          interimTranscript += transcript
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  return (
    <div className="dr-consult-notes">
      <div className="dr-notes-header">
        <h3>Consultation Notes for {patientName}</h3>
        <button
          onClick={isListening ? stopVoiceInput : startVoiceInput}
          className={`dr-voice-btn ${isListening ? 'listening' : ''}`}
          title={isListening ? 'Stop recording' : 'Start voice input'}
        >
          {isListening ? (
            <>
              <MicOff size={14} /> Stop
            </>
          ) : (
            <>
              <Mic size={14} /> Voice
            </>
          )}
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={`Enter consultation notes, diagnosis, observations, and recommendations for ${patientName}...\n\nYou can also use voice input by clicking the microphone button above.`}
        className="dr-notes-textarea"
      />

      <div className="dr-notes-footer">
        <span className="dr-notes-char-count">
          {notes.length} characters
        </span>
      </div>
    </div>
  )
}
