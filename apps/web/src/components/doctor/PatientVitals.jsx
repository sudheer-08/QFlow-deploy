import { useState } from 'react'
import './PatientVitals.css'

export default function PatientVitals({ vitals, setVitals }) {
  const vitalFields = [
    { key: 'bp_systolic', label: 'BP Systolic', unit: 'mmHg', placeholder: '120' },
    { key: 'bp_diastolic', label: 'BP Diastolic', unit: 'mmHg', placeholder: '80' },
    { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', placeholder: '72' },
    { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: '37' },
    { key: 'respiratory_rate', label: 'Respiratory Rate', unit: 'breaths/min', placeholder: '16' },
    { key: 'oxygen_saturation', label: 'O2 Saturation', unit: '%', placeholder: '98' },
    { key: 'weight', label: 'Weight', unit: 'kg', placeholder: '70' },
    { key: 'height', label: 'Height', unit: 'cm', placeholder: '170' },
  ]

  const updateVital = (key, value) => {
    setVitals({
      ...vitals,
      [key]: value ? parseFloat(value) : null
    })
  }

  const calculateBMI = () => {
    if (vitals.weight && vitals.height) {
      const heightM = vitals.height / 100
      return (vitals.weight / (heightM * heightM)).toFixed(1)
    }
    return null
  }

  const bmi = calculateBMI()
  const getBMICategory = (bmiValue) => {
    if (!bmiValue) return null
    if (bmiValue < 18.5) return { category: 'Underweight', color: '#3b82f6' }
    if (bmiValue < 25) return { category: 'Normal', color: '#10b981' }
    if (bmiValue < 30) return { category: 'Overweight', color: '#f59e0b' }
    return { category: 'Obese', color: '#ef4444' }
  }

  const bmiInfo = bmi ? getBMICategory(bmi) : null

  return (
    <div className="dr-vitals">
      <h3>Patient Vitals</h3>

      <div className="dr-vitals-grid">
        {vitalFields.map(field => (
          <div key={field.key} className="dr-vital-field">
            <label>{field.label}</label>
            <div className="dr-vital-input-group">
              <input
                type="number"
                value={vitals[field.key] ?? ''}
                onChange={(e) => updateVital(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="dr-vital-input"
              />
              <span className="dr-vital-unit">{field.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {bmiInfo && (
        <div className="dr-vitals-summary">
          <div className="dr-vital-card">
            <div className="dr-vital-label">BMI</div>
            <div className="dr-vital-value" style={{ color: bmiInfo.color }}>
              {bmi}
            </div>
            <div className="dr-vital-category" style={{ color: bmiInfo.color }}>
              {bmiInfo.category}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 12 }}>
        ℹ️ Enter vitals as recorded. Fields are optional.
      </div>
    </div>
  )
}
