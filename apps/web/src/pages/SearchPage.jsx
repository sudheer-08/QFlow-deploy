import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClinicCardSkeleton } from '../components/Skeleton'
import { smartBack } from '../utils/navigation'

export default function SearchPage() {
  const navigate = useNavigate()
  const goBack = () => smartBack(navigate, '/')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    city: 'all',
    specialization: 'all',
    openNow: false,
    minRating: 0,
    maxWait: 999,
    sortBy: 'wait'
  })
  const [showFilters, setShowFilters] = useState(false)

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ['clinics-search'],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/patient/clinics`).then(r => r.json()),
    refetchInterval: 30000
  })

  const isOpen = (openTime, closeTime) => {
    if (!openTime || !closeTime) return true
    const now = new Date()
    const cur = now.getHours() * 60 + now.getMinutes()
    const [oh, om] = openTime.split(':').map(Number)
    const [ch, cm] = closeTime.split(':').map(Number)
    return cur >= oh * 60 + om && cur <= ch * 60 + cm
  }

  const filtered = clinics
    .filter(c => {
      const matchSearch = !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.address?.toLowerCase().includes(search.toLowerCase()) ||
        c.specialization?.toLowerCase().includes(search.toLowerCase())
      const matchCity = filters.city === 'all' || c.city === filters.city
      const matchSpec = filters.specialization === 'all' || c.specialization?.includes(filters.specialization)
      const matchOpen = !filters.openNow || isOpen(c.open_time, c.close_time)
      const matchRating = (c.rating || 0) >= filters.minRating
      const matchWait = (c.totalWaiting || 0) * 8 <= filters.maxWait
      return matchSearch && matchCity && matchSpec && matchOpen && matchRating && matchWait
    })
    .sort((a, b) => {
      if (filters.sortBy === 'wait') return (a.totalWaiting || 0) - (b.totalWaiting || 0)
      if (filters.sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (filters.sortBy === 'name') return a.name.localeCompare(b.name)
      return 0
    })

  const activeFiltersCount = [
    filters.city !== 'all',
    filters.specialization !== 'all',
    filters.openNow,
    filters.minRating > 0,
    filters.maxWait < 999
  ].filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--qf-bg)', paddingBottom: 80 }}>

      {/* Search header with Glassmorphism */}
      <div style={{ background: 'rgba(245, 246, 252, 0.72)', backdropFilter: 'blur(20px)', padding: '16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={goBack} className="qf-btn-ghost" style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>←</button>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--qf-surface-lowest)', borderRadius: 'var(--ui-radius-md)', padding: '4px 14px', border: '1px solid var(--qf-border)' }}>
            <span style={{ color: 'var(--qf-text-variant)', marginRight: 8, fontSize: '1.2rem' }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clinics, areas..."
              autoFocus
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', padding: '10px 0', fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: 'var(--qf-text)' }}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="qf-btn-secondary"
            style={{ padding: '12px 16px', background: activeFiltersCount > 0 ? 'var(--qf-primary)' : 'var(--qf-surface-lowest)', color: activeFiltersCount > 0 ? 'var(--qf-on-primary)' : 'var(--qf-primary)', border: '1px solid var(--qf-border)' }}
          >
            🔧 {activeFiltersCount > 0 ? `${activeFiltersCount} filters` : 'Filter'}
          </button>
        </div>

        {/* Recessed Filter panel */}
        {showFilters && (
          <div className="qf-card-recessed" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Sort */}
            <div>
              <p className="qf-label">Sort by</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {[['wait', '⏱ Wait Time'], ['rating', '⭐ Rating'], ['name', '🔤 Name']].map(([val, label]) => (
                  <button key={val} onClick={() => setFilters(f => ({ ...f, sortBy: val }))}
                    className={`qf-chip ${filters.sortBy === val ? 'active' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <p className="qf-label">City</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {['all', 'Chandigarh', 'Mohali', 'Panchkula'].map(city => (
                  <button key={city} onClick={() => setFilters(f => ({ ...f, city }))}
                    className={`qf-chip ${filters.city === city ? 'active' : ''}`}>
                    {city === 'all' ? 'All' : city}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialization */}
            <div>
              <p className="qf-label">Specialization</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {['all', 'Dental', 'Orthodontics', 'Oral Surgery', 'Pediatric'].map(spec => (
                  <button key={spec} onClick={() => setFilters(f => ({ ...f, specialization: spec }))}
                    className={`qf-chip ${filters.specialization === spec ? 'active' : ''}`}>
                    {spec === 'all' ? 'All' : spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button 
                onClick={() => setFilters({ city: 'all', specialization: 'all', openNow: false, minRating: 0, maxWait: 999, sortBy: 'wait' })}
                className="qf-btn-danger"
              >
                ✕ Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ padding: '0 16px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', color: 'var(--qf-text-variant)', margin: '16px 0' }}>
          {isLoading ? 'Searching...' : `${filtered.length} clinic${filtered.length !== 1 ? 's' : ''} found`}
        </p>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {[1,2,3].map(i => <ClinicCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>No clinics found</p>
            <p style={{ color: 'var(--qf-text-variant)' }}>Try different search terms or clear filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {filtered.map(clinic => (
              <div key={clinic.id} onClick={() => navigate(`/clinic/${clinic.subdomain}`)} className="ph-clinic-card">
                <div className="ph-card-top">
                  <div className="ph-card-main">
                    <div className="ph-badges">
                      {isOpen(clinic.open_time, clinic.close_time)
                        ? <span className="qf-badge qf-badge-green">● OPEN</span>
                        : <span className="qf-badge qf-badge-red">● CLOSED</span>
                      }
                    </div>
                    <h3 className="headline-font" style={{ fontSize: '1.125rem', margin: '0 0 6px' }}>{clinic.name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--qf-text-variant)', margin: '0 0 12px', fontFamily: 'Inter, sans-serif' }}>📍 {clinic.address}</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--qf-text-variant)', margin: 0, fontFamily: 'Inter, sans-serif' }}>🦷 {clinic.specialization} · ⭐ {clinic.rating || 0}</p>
                  </div>
                  
                  {/* Bespoke Queue Pill extracted from home page css */}
                  <div className="ph-queue-block">
                    <div className="live-queue-pill">
                      <div className="live-queue-dot" style={{ backgroundColor: (clinic.totalWaiting || 0) > 10 ? 'var(--qf-error)' : (clinic.totalWaiting || 0) > 5 ? 'var(--qf-warning)' : 'var(--qf-tertiary)' }}></div>
                      <span style={{ color: 'inherit', fontWeight: 'bold' }}>{clinic.totalWaiting || 0} in queue</span>
                    </div>
                    <em style={{ marginTop: '8px', display: 'block', fontStyle: 'normal' }}>~{(clinic.totalWaiting || 0) * 8}m</em>
                  </div>
                </div>
                <button className="qf-btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                  View & Book →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
