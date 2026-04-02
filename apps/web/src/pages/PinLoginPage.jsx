import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import './PinLoginPage.css';

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
      navigate(redirect, { replace: true });
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
    <div className="pin-shell">
      <div className="pin-orb pin-orb-left" />
      <div className="pin-orb pin-orb-right" />

      <div className="pin-card">
        <div className="pin-brand">
          <div className="pin-logo">Q</div>
          <h1>QFlow PIN Access</h1>
          <p>Fast login for reception and clinic staff.</p>
        </div>

        {step === 'tenant' && (
          <div className="pin-step">
            <label className="pin-field">
              <span>Clinic ID</span>
              <input
                value={tenantId}
                onChange={e => setTenantId(e.target.value)}
                placeholder="Enter your clinic ID"
                autoComplete="organization"
              />
            </label>

            <button
              type="button"
              className="pin-submit"
              onClick={() => {
                if (!tenantId.trim()) return toast.error('Enter clinic ID');
                setStep('pin');
                setTimeout(() => document.getElementById('pin-0')?.focus(), 100);
              }}
            >
              Continue
            </button>

            <div className="pin-links">
              <button type="button" onClick={() => navigate('/login', { replace: true })}>
                Use email and password
              </button>
            </div>
          </div>
        )}

        {step === 'pin' && (
          <div className="pin-step">
            <div className="pin-head-row">
              <button
                type="button"
                onClick={() => {
                  setStep('tenant');
                  setPin(['', '', '', '']);
                }}
              >
                Back
              </button>
              <p>{tenantId}</p>
            </div>

            <p className="pin-helper">Enter your 4-digit staff PIN</p>

            <div className="pin-inputs">
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
                  className={digit ? 'is-filled' : ''}
                />
              ))}
            </div>

            <div className="pin-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'DEL'].map((num, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (num === 'DEL') {
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
                  disabled={num === '' || loading}
                  className={num === '' ? 'is-gap' : num === 'DEL' ? 'is-delete' : ''}
                >
                  {num}
                </button>
              ))}
            </div>

            {loading && <p className="pin-loading">Verifying PIN...</p>}

            <div className="pin-links">
              <button type="button" onClick={() => navigate('/login', { replace: true })}>
                Use email and password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}