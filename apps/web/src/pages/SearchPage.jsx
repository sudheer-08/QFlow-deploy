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
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: 80 }}>

      {/* Search header */}
      <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={goBack} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>←</button>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clinics, doctors, areas..."
            autoFocus
            style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none' }}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{ background: activeFiltersCount > 0 ? '#2563eb' : '#f1f5f9', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: activeFiltersCount > 0 ? 'white' : '#374151', flexShrink: 0 }}
          >
            🔧 {activeFiltersCount > 0 ? `${activeFiltersCount} filters` : 'Filter'}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Sort */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px', textTransform: 'uppercase' }}>Sort by</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['wait', '⏱ Wait Time'], ['rating', '⭐ Rating'], ['name', '🔤 Name']].map(([val, label]) => (
                  <button key={val} onClick={() => setFilters(f => ({ ...f, sortBy: val }))}
                    style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${filters.sortBy === val ? '#2563eb' : '#e2e8f0'}`, background: filters.sortBy === val ? '#eff6ff' : 'white', color: filters.sortBy === val ? '#2563eb' : '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px', textTransform: 'uppercase' }}>City</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'Chandigarh', 'Mohali', 'Panchkula'].map(city => (
                  <button key={city} onClick={() => setFilters(f => ({ ...f, city }))}
                    style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${filters.city === city ? '#2563eb' : '#e2e8f0'}`, background: filters.city === city ? '#eff6ff' : 'white', color: filters.city === city ? '#2563eb' : '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {city === 'all' ? 'All' : city}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialization */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px', textTransform: 'uppercase' }}>Specialization</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'Dental', 'Orthodontics', 'Oral Surgery', 'Pediatric'].map(spec => (
                  <button key={spec} onClick={() => setFilters(f => ({ ...f, specialization: spec }))}
                    style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${filters.specialization === spec ? '#2563eb' : '#e2e8f0'}`, background: filters.specialization === spec ? '#eff6ff' : 'white', color: filters.specialization === spec ? '#2563eb' : '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {spec === 'all' ? 'All' : spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick toggles */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFilters(f => ({ ...f, openNow: !f.openNow }))}
                style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${filters.openNow ? '#16a34a' : '#e2e8f0'}`, background: filters.openNow ? '#f0fdf4' : 'white', color: filters.openNow ? '#16a34a' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {filters.openNow ? '✅' : '⚪'} Open Now
              </button>
              <button onClick={() => setFilters(f => ({ ...f, minRating: f.minRating > 0 ? 0 : 4 }))}
                style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${filters.minRating > 0 ? '#f59e0b' : '#e2e8f0'}`, background: filters.minRating > 0 ? '#fffbeb' : 'white', color: filters.minRating > 0 ? '#d97706' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {filters.minRating > 0 ? '⭐' : '☆'} 4+ Rating
              </button>
              <button onClick={() => setFilters(f => ({ ...f, maxWait: f.maxWait < 999 ? 999 : 30 }))}
                style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${filters.maxWait < 999 ? '#7c3aed' : '#e2e8f0'}`, background: filters.maxWait < 999 ? '#f5f3ff' : 'white', color: filters.maxWait < 999 ? '#7c3aed' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {filters.maxWait < 999 ? '⏱' : '⏱'} {'<'}30 min
              </button>
            </div>

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button onClick={() => setFilters({ city: 'all', specialization: 'all', openNow: false, minRating: 0, maxWait: 999, sortBy: 'wait' })}
                style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ✕ Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ padding: '12px 16px' }}>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
          {isLoading ? 'Searching...' : `${filtered.length} clinic${filtered.length !== 1 ? 's' : ''} found`}
        </p>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <ClinicCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>No clinics found</p>
            <p style={{ color: '#64748b', fontSize: 13 }}>Try different search terms or clear filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(clinic => (
              <div key={clinic.id} onClick={() => navigate(`/clinic/${clinic.subdomain}`)}
                style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      {isOpen(clinic.open_time, clinic.close_time)
                        ? <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>● OPEN</span>
                        : <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>● CLOSED</span>
                      }
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>{clinic.name}</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 3px' }}>📍 {clinic.address}</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>🦷 {clinic.specialization} · ⭐ {clinic.rating}</p>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 65 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: (clinic.totalWaiting || 0) > 10 ? '#dc2626' : (clinic.totalWaiting || 0) > 5 ? '#d97706' : '#16a34a' }}>
                      {clinic.totalWaiting || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>waiting</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>~{(clinic.totalWaiting || 0) * 8}m</div>
                  </div>
                </div>
                <button style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
