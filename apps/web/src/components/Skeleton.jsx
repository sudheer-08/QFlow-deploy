// Skeleton loading components — use these instead of "Loading..." text

// ─── Base skeleton block ──────────────────────────────
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style
    }} />
  )
}

// ─── Clinic card skeleton ─────────────────────────────
export function ClinicCardSkeleton() {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          <Skeleton height={18} width="70%" borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton height={13} width="90%" borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={13} width="60%" borderRadius={4} />
        </div>
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <Skeleton height={28} width={50} borderRadius={6} style={{ marginBottom: 4 }} />
          <Skeleton height={12} width={40} borderRadius={4} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #f8fafc' }}>
        <Skeleton height={13} width="40%" borderRadius={4} />
        <Skeleton height={13} width="30%" borderRadius={4} />
      </div>
      <Skeleton height={40} borderRadius={10} style={{ marginTop: 10 }} />
    </div>
  )
}

// ─── Appointment card skeleton ────────────────────────
export function AppointmentCardSkeleton() {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <Skeleton height={16} width="60%" borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton height={13} width="45%" borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={13} width="70%" borderRadius={4} />
        </div>
        <Skeleton height={24} width={80} borderRadius={99} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {[1,2,3].map(i => <Skeleton key={i} height={52} borderRadius={10} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton height={40} borderRadius={10} style={{ flex: 2 }} />
        <Skeleton height={40} borderRadius={10} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

// ─── Doctor card skeleton ─────────────────────────────
export function DoctorCardSkeleton() {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 14, border: '1.5px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <div>
            <Skeleton height={15} width={120} borderRadius={6} style={{ marginBottom: 6 }} />
            <Skeleton height={12} width={90} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton height={11} width={70} borderRadius={4} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Skeleton height={22} width={32} borderRadius={6} style={{ marginBottom: 4 }} />
          <Skeleton height={11} width={45} borderRadius={4} />
        </div>
      </div>
    </div>
  )
}

// ─── Stats bar skeleton ───────────────────────────────
export function StatsBarSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ borderRadius: 12, padding: 16, background: '#f1f5f9', textAlign: 'center' }}>
          <Skeleton height={32} width={40} borderRadius={6} style={{ margin: '0 auto 6px' }} />
          <Skeleton height={12} width={60} borderRadius={4} style={{ margin: '0 auto' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Profile skeleton ─────────────────────────────────
export function ProfileSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <Skeleton width={72} height={72} borderRadius={36} />
        <div>
          <Skeleton height={18} width={140} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton height={13} width={100} borderRadius={4} />
        </div>
      </div>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ marginBottom: 14 }}>
          <Skeleton height={12} width={80} borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={44} borderRadius={10} />
        </div>
      ))}
    </div>
  )
}

export default Skeleton

// Add this to your global CSS or index.css:
// @keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
