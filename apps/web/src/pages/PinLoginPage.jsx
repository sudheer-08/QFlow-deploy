import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';;
import './PinLoginPage.css';

const PinLoginPage = () => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuthStore.getState();
    const queryClient = useQueryClient();

    const handlePinClick = (num) => {
        if (pin.length < 4) {
            setPin(pin + num);
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const pinLoginMutation = useMutation({
        mutationFn: async (enteredPin) => {
            const { data, error } = await supabase.rpc('verify_staff_pin', { staff_pin: enteredPin });
            if (error) throw new Error(error.message);
            if (!data) throw new Error('Invalid PIN or user not found.');
            return data;
        },
        onSuccess: (userData) => {
            // The user data from the RPC call includes the full user object and a new JWT
            login(userData.user_data, userData.token);
            
            // Invalidate all queries to refetch data with new auth context
            queryClient.invalidateQueries();

            if (userData.user_data.role === 'doctor') {
                navigate('/doctor');
            } else if (userData.user_data.role === 'admin') {
                navigate('/admin');
            } else {
                // Fallback for other staff roles if any
                navigate('/reception');
            }
        },
        onError: (err) => {
            setError('Invalid PIN. Please try again.');
            setPin('');
        },
    });

    const handleSubmit = () => {
        if (pin.length === 4) {
            setError('');
            pinLoginMutation.mutate(pin);
        } else {
            setError('PIN must be 4 digits.');
        }
    };
    
    // Automatically submit when 4 digits are entered
    React.useEffect(() => {
        if (pin.length === 4) {
            handleSubmit();
        }
    }, [pin]);

    return (
        <div className="pin-login-page">
            <div className="pin-login-container">
                <div className="pin-login-header">
                    <h2>Staff PIN Login</h2>
                    <p>Enter your 4-digit PIN to access your dashboard.</p>
                </div>

                <div className="pin-display">
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`}></div>
                    ))}
                </div>

                {error && <div className="pin-error">{error}</div>}

                <div className="numpad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button key={num} className="numpad-btn" onClick={() => handlePinClick(num.toString())}>
                            {num}
                        </button>
                    ))}
                    <button className="numpad-btn" onClick={handleClear}>C</button>
                    <button className="numpad-btn" onClick={() => handlePinClick('0')}>0</button>
                    <button className="numpad-btn" onClick={handleBackspace}>&larr;</button>
                </div>

                <button 
                    className="submit-pin-btn" 
                    onClick={handleSubmit}
                    disabled={pin.length !== 4 || pinLoginMutation.isPending}
                >
                    {pinLoginMutation.isPending ? 'Verifying...' : 'Login'}
                </button>
            </div>
        </div>
    );
};

export default PinLoginPage;