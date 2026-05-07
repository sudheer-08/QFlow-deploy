import { useState } from 'react'
import { Plus, X, Pill } from 'lucide-react'
import './PrescriptionBuilder.css'

const dosageUnits = ['mg', 'ml', 'tab', 'cap', 'gm', 'mcg', 'IU']
const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'As needed']
const durations = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '30 days', 'Ongoing']

export default function PrescriptionBuilder({ medicines, setMedicines, patientName }) {
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    dosage: '',
    unit: 'mg',
    frequency: 'Twice daily',
    duration: '7 days',
    instructions: ''
  })

  const addMedicine = () => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim()) {
      return
    }

    setMedicines([
      ...medicines,
      {
        ...newMedicine,
        id: Math.random().toString(36).substr(2, 9)
      }
    ])

    setNewMedicine({
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Twice daily',
      duration: '7 days',
      instructions: ''
    })
  }

  const removeMedicine = (id) => {
    setMedicines(medicines.filter(m => m.id !== id))
  }

  return (
    <div className="dr-prescription">
      <div className="dr-rx-header">
        <h3>Prescription for {patientName}</h3>
        <span className="dr-rx-count">{medicines.length} medicine{medicines.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add Medicine Form */}
      <div className="dr-rx-form">
        <div className="dr-rx-form-row">
          <div className="dr-rx-form-group">
            <label>Medicine Name *</label>
            <input
              type="text"
              value={newMedicine.name}
              onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
              placeholder="e.g., Amoxicillin"
              className="dr-rx-input"
            />
          </div>

          <div className="dr-rx-form-group" style={{ maxWidth: 140 }}>
            <label>Dosage *</label>
            <div className="dr-rx-dosage">
              <input
                type="number"
                value={newMedicine.dosage}
                onChange={(e) => setNewMedicine({ ...newMedicine, dosage: e.target.value })}
                placeholder="500"
                className="dr-rx-input"
                min="0"
              />
              <select
                value={newMedicine.unit}
                onChange={(e) => setNewMedicine({ ...newMedicine, unit: e.target.value })}
                className="dr-rx-select"
              >
                {dosageUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="dr-rx-form-row">
          <div className="dr-rx-form-group">
            <label>Frequency</label>
            <select
              value={newMedicine.frequency}
              onChange={(e) => setNewMedicine({ ...newMedicine, frequency: e.target.value })}
              className="dr-rx-select"
            >
              {frequencies.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="dr-rx-form-group">
            <label>Duration</label>
            <select
              value={newMedicine.duration}
              onChange={(e) => setNewMedicine({ ...newMedicine, duration: e.target.value })}
              className="dr-rx-select"
            >
              {durations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="dr-rx-form-row">
          <div className="dr-rx-form-group">
            <label>Instructions (Optional)</label>
            <input
              type="text"
              value={newMedicine.instructions}
              onChange={(e) => setNewMedicine({ ...newMedicine, instructions: e.target.value })}
              placeholder="e.g., Take with food, Avoid dairy"
              className="dr-rx-input"
            />
          </div>
          <button
            onClick={addMedicine}
            disabled={!newMedicine.name.trim() || !newMedicine.dosage.trim()}
            className="dr-rx-btn-add"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Medicine List */}
      <div className="dr-rx-list">
        {medicines.length === 0 ? (
          <div className="dr-rx-empty">
            <Pill size={24} />
            <p>No medicines added yet</p>
          </div>
        ) : (
          medicines.map((medicine) => (
            <div key={medicine.id} className="dr-rx-item">
              <div className="dr-rx-item-content">
                <div className="dr-rx-item-name">{medicine.name}</div>
                <div className="dr-rx-item-meta">
                  <span className="dr-rx-badge">{medicine.dosage}{medicine.unit}</span>
                  <span className="dr-rx-badge">{medicine.frequency}</span>
                  <span className="dr-rx-badge">{medicine.duration}</span>
                </div>
                {medicine.instructions && (
                  <div className="dr-rx-item-instructions">💡 {medicine.instructions}</div>
                )}
              </div>
              <button
                onClick={() => removeMedicine(medicine.id)}
                className="dr-rx-btn-remove"
                title="Remove medicine"
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {medicines.length > 0 && (
        <div className="dr-rx-summary">
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            💊 Total {medicines.length} medicine{medicines.length !== 1 ? 's' : ''} will be sent to patient
          </p>
        </div>
      )}
    </div>
  )
}
