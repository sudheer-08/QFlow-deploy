import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
      padding: 24
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        background: 'white',
        padding: 24,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }}>
        <p style={{ margin: 0, color: '#6366f1', fontWeight: 700, letterSpacing: 0.2 }}>404</p>
        <h1 style={{ marginTop: 8, marginBottom: 8, color: '#0f172a' }}>Page not found</h1>
        <p style={{ marginTop: 0, color: '#475569', lineHeight: 1.6 }}>
          The page you are looking for does not exist or may have moved.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            marginTop: 12,
            textDecoration: 'none',
            borderRadius: 10,
            padding: '10px 14px',
            background: '#2563eb',
            color: 'white',
            fontWeight: 700
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
