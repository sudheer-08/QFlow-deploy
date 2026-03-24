import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/Toast';

const SYMPTOM_CHIPS = [
  { en: 'Fever',        hi: 'बुखार',           emoji: '🤒' },
  { en: 'Headache',     hi: 'सिर दर्द',         emoji: '🤕' },
  { en: 'Toothache',    hi: 'दांत दर्द',         emoji: '🦷' },
  { en: 'Stomach pain', hi: 'पेट दर्द',          emoji: '🤢' },
  { en: 'Eye problem',  hi: 'आंख में तकलीफ',     emoji: '👁️' },
  { en: 'Cough/Cold',   hi: 'खांसी/जुकाम',       emoji: '🤧' },
  { en: 'Body pain',    hi: 'बदन दर्द',           emoji: '💪' },
  { en: 'Skin problem', hi: 'चमड़ी की समस्या',    emoji: '🩹' },
  { en: 'Weakness',     hi: 'कमजोरी',            emoji: '😴' },
  { en: 'Other',        hi: 'कुछ और',            emoji: '✍️' },
];

export default function IntakeFormPage() {
  const { token } = useParams();
  const toast = useToast();

  const [appointment, setAppointment] = useState(null);
  const [selectedChips, setSelectedChips] = useState([]);
  const [customComplaint, setCustomComplaint] = useState('');
  const [medicines, setMedicines] = useState('');
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Silently try to load appointment — never block the form
    const fetchAppointment = async () => {
      try {
        const res = await api.get(`/appointments/track/${token}`);
        if (res.data) setAppointment(res.data);
      } catch {
        // Silently ignore — form works without appointment
      }
    };
    if (token && token !== 'test-token') {
      fetchAppointment();
    }
  }, [token]);

  const toggleChip = (chip) => {
    setSelectedChips(prev =>
      prev.includes(chip.en)
        ? prev.filter(c => c !== chip.en)
        : [...prev, chip.en]
    );
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return toast.error('Voice not supported on this browser');
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setCustomComplaint(prev => prev ? `${prev}, ${text}` : text);
      toast.success('Voice captured!');
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('Could not hear clearly, please try again');
    };
    recognition.start();
  };

  const handleSubmit = async () => {
    if (selectedChips.length === 0 && !customComplaint.trim()) {
      return toast.error('Please tell us what is bothering you');
    }
    setSubmitting(true);
    try {
      const complaint = [...selectedChips, customComplaint]
        .filter(Boolean).join(', ');

      await api.post('/intake', {
        appointment_id: appointment?.id || null,
        tenant_id: appointment?.tenant_id || null,
        patient_id: appointment?.patient_id || null,
        chief_complaint: complaint,
        symptom_tags: selectedChips,
        current_medicines: medicines,
        filled_by: 'patient'
      });

      setSubmitted(true);
    } catch {
      toast.error('Could not save, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Shukriya! / Thank you!
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            आपकी जानकारी डॉक्टर को मिल गई
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Doctor has received your information
          </p>
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-blue-700 text-sm font-medium">
              अब क्लिनिक में बैठें और अपना नंबर आने का इंतज़ार करें
            </p>
            <p className="text-blue-500 text-xs mt-1">
              Please wait at the clinic for your turn
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Form ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-5">
        <h1 className="text-xl font-bold">डॉक्टर से मिलने से पहले</h1>
        <p className="text-blue-200 text-sm mt-0.5">Before seeing the doctor</p>
        {/* Step indicator */}
        <div className="flex gap-2 mt-3">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
              step >= s ? 'bg-white' : 'bg-blue-400'
            }`} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-5">

        {/* ─── Step 1 — Symptoms ─── */}
        {step === 1 && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">आज क्या तकलीफ है?</h2>
              <p className="text-gray-500 text-sm">What is bothering you today?</p>
            </div>

            {/* Symptom chips */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {SYMPTOM_CHIPS.map(chip => (
                <button
                  key={chip.en}
                  onClick={() => toggleChip(chip)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedChips.includes(chip.en)
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <span className="text-2xl">{chip.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">
                      {chip.hi}
                    </p>
                    <p className="text-gray-400 text-xs">{chip.en}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected chips summary */}
            {selectedChips.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 flex flex-wrap gap-2">
                {selectedChips.map(c => {
                  const chip = SYMPTOM_CHIPS.find(s => s.en === c);
                  return (
                    <span key={c}
                      onClick={() => toggleChip(chip)}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full cursor-pointer">
                      {chip?.emoji} {chip?.hi} ✕
                    </span>
                  );
                })}
              </div>
            )}

            {/* Voice + text input */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
              <p className="text-sm font-medium text-gray-700 mb-3">
                कुछ और बताना है? / Anything else?
              </p>
              <button
                onClick={startVoice}
                className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl mb-3 font-medium text-sm transition-all ${
                  listening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}>
                <span className="text-xl">🎤</span>
                {listening
                  ? 'सुन रहे हैं... / Listening...'
                  : 'बोलकर बताएं / Speak your symptoms'}
              </button>
              <textarea
                value={customComplaint}
                onChange={e => setCustomComplaint(e.target.value)}
                placeholder="या यहाँ लिखें... / Or type here..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:border-blue-400"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold text-base hover:bg-blue-700 transition-colors">
              आगे बढ़ें / Next →
            </button>
          </div>
        )}

        {/* ─── Step 2 — Medicines ─── */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">
                क्या आप कोई दवाई लेते हैं?
              </h2>
              <p className="text-gray-500 text-sm">Are you taking any medicines?</p>
            </div>

            <div className="flex gap-3 mb-5">
              <button
                onClick={() => { setMedicines(''); setStep(3); }}
                className="flex-1 bg-green-50 border-2 border-green-200 text-green-700 py-4 rounded-2xl font-semibold text-sm hover:bg-green-100 transition-colors">
                नहीं / No
              </button>
              <button
                onClick={() => {}}
                className="flex-1 bg-orange-50 border-2 border-orange-200 text-orange-700 py-4 rounded-2xl font-semibold text-sm hover:bg-orange-100 transition-colors">
                हाँ, लिखूँगा / Yes
              </button>
            </div>

            <textarea
              value={medicines}
              onChange={e => setMedicines(e.target.value)}
              placeholder="दवाई का नाम लिखें... / Write medicine names..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:border-blue-400 mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl text-sm hover:bg-gray-50">
                ← वापस / Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-blue-700">
                आगे / Next →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3 — Review & Submit ─── */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">जानकारी देखें</h2>
              <p className="text-gray-500 text-sm">Review your information</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 space-y-4">
              {selectedChips.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">तकलीफ / Symptoms</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedChips.map(c => {
                      const chip = SYMPTOM_CHIPS.find(s => s.en === c);
                      return (
                        <span key={c}
                          className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm">
                          {chip?.emoji} {chip?.hi}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {customComplaint && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">अन्य / Other</p>
                  <p className="text-sm text-gray-700">{customComplaint}</p>
                </div>
              )}

              {medicines && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">दवाइयाँ / Medicines</p>
                  <p className="text-sm text-gray-700">{medicines}</p>
                </div>
              )}

              {!selectedChips.length && !customComplaint && (
                <p className="text-gray-400 text-sm text-center py-2">
                  कोई जानकारी नहीं / No information added
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl text-sm hover:bg-gray-50">
                ← वापस / Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-green-700 disabled:opacity-50 transition-colors">
                {submitting ? 'भेज रहे हैं...' : '✅ भेजें / Submit'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}