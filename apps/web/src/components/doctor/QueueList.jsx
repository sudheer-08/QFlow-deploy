import { Phone, Eye, AlertTriangle } from 'lucide-react'

const priorityConfig = {
  critical: { label: '🔴 Critical', color: 'critical' },
  moderate: { label: '🟡 Moderate', color: 'moderate' },
  routine: { label: '🟢 Routine', color: 'routine' }
}

export default function QueueList({
  entries,
  selectedId,
  onSelect,
  onViewBrief,
  onCall,
  isLoading
}) {
  return (
    <div className="dr-queue-list">
      {entries.map((entry, index) => {
        const cfg = priorityConfig[entry.priority] || priorityConfig.routine
        const isSelected = entry.id === selectedId
        const waitTime = entry.wait_time_mins || 0

        return (
          <div
            key={entry.id}
            className={`dr-queue-item ${entry.priority} ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(entry)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dr-queue-item-token">#{index + 1}</span>
              <span className="dr-queue-item-token">{entry.token_number}</span>
            </div>

            <div className="dr-queue-item-name">
              {entry.users?.name || 'Patient'}
            </div>

            <div className="dr-queue-item-meta">
              <span className={`dr-queue-badge ${cfg.color}`}>
                {cfg.label}
              </span>

              {entry.registration_type === 'self_registered' && (
                <span className="dr-queue-badge remote">📱 Remote</span>
              )}

              {entry.arrival_status === 'arrived' && (
                <span className="dr-queue-badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                  ✅ Arrived
                </span>
              )}

              {waitTime > 0 && (
                <span className="dr-queue-badge" style={{ background: '#f0f0ff', color: '#4f46e5' }}>
                  ⏱ {waitTime}m
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCall(entry)
                }}
                disabled={isLoading}
                className="dr-btn-primary"
                style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }}
              >
                <Phone size={12} /> Call
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewBrief(entry)
                }}
                className="dr-btn-secondary"
                style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }}
              >
                <Eye size={12} /> Brief
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
