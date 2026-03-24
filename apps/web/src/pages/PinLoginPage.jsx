import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

const ROLE_REDIRECTS = {
  receptionist: '/reception',
  doctor: '/doctor',
  clinic_admin: '/admin'
};

export default function PinLoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const toast = useToast();
  const [pin, setPin] = useState(['', '', '', '']);
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('tenant'); // tenant | pin

  const handlePinInput = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const newPin = [...pin];
    newPin[idx] = val;
    setPin(newPin);

    // Auto-focus next
    if (val && idx < 3) {
      document.getElementById(`pin-${idx + 1}`)?.focus();
    }

    // Auto-submit when all 4 digits filled
    if (idx === 3 && val) {
      const fullPin = [...newPin.slice(0, 3), val].join('');
      if (fullPin.length === 4) handleLogin(fullPin);
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      document.getElementById(`pin-${idx - 1}`)?.focus();
    }
  };

  const handleLogin = async (fullPin) => {
    if (!tenantId) return toast.error('Please enter clinic ID first');
    setLoading(true);
    try {
      const res = await api.post('/pin/login', {
        pin: fullPin,
        tenant_id: tenantId
      });

      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);

      const redirect = ROLE_REDIRECTS[res.data.user.role] || '/reception';
      navigate(redirect);
      toast.success(`Welcome, ${res.data.user.name}!`);
    } catch {
      toast.error('Invalid PIN. Try again.');
      setPin(['', '', '', '']);
      document.getElementById('pin-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-black text-2xl">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">QFlow Staff Login</h1>
          <p className="text-gray-400 text-sm mt-1">Quick PIN access for clinic staff</p>
        </div>

        {step === 'tenant' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinic ID
            </label>
            <input
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              placeholder="Enter your clinic ID"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 mb-4"
            />
            <button
              onClick={() => {
                if (!tenantId.trim()) return toast.error('Enter clinic ID');
                setStep('pin');
                setTimeout(() => document.getElementById('pin-0')?.focus(), 100);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700">
              Continue →
            </button>
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-xs text-gray-400 hover:text-gray-600">
                Login with email & password instead
              </button>
            </div>
          </div>
        )}

        {step === 'pin' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => { setStep('tenant'); setPin(['','','','']); }}
                className="text-gray-400 hover:text-gray-600 text-sm">
                ← Back
              </button>
            </div>

            <p className="text-center text-gray-600 text-sm mb-6">
              Enter your 4-digit staff PIN
            </p>

            {/* PIN inputs */}
            <div className="flex justify-center gap-3 mb-8">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  id={`pin-${idx}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinInput(e.target.value, idx)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-2xl focus:outline-none transition-all ${
                    digit
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 focus:border-blue-400'
                  }`}
                />
              ))}
            </div>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((num, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (num === '⌫') {
                      const lastFilled = [...pin].reverse().findIndex(d => d !== '');
                      if (lastFilled !== -1) {
                        const idx = 3 - lastFilled;
                        const newPin = [...pin];
                        newPin[idx] = '';
                        setPin(newPin);
                        document.getElementById(`pin-${idx}`)?.focus();
                      }
                    } else if (num !== '') {
                      const firstEmpty = pin.findIndex(d => d === '');
                      if (firstEmpty !== -1) {
                        handlePinInput(String(num), firstEmpty);
                      }
                    }
                  }}
                  disabled={num === ''}
                  className={`h-12 rounded-xl font-semibold text-lg transition-all ${
                    num === ''
                      ? 'invisible'
                      : num === '⌫'
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-800 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100'
                  }`}>
                  {num}
                </button>
              ))}
            </div>

            {loading && (
              <p className="text-center text-blue-600 text-sm animate-pulse">
                Verifying PIN...
              </p>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-xs text-gray-400 hover:text-gray-600">
                Login with email & password instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}