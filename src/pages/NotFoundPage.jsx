import { Link } from 'react-router-dom';
import { Compass, Home, LayoutDashboard } from 'lucide-react';

export default function NotFoundPage({ role = 'user' }) {
  const homePath = role === 'admin' ? '/admin' : '/dashboard';

  return (
    <div className="page-content" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div style={{ maxWidth: '480px', padding: '40px 20px' }}>
        <div style={{ width: '64px', height: '64px', margin: '0 auto 20px', borderRadius: '16px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
          <Compass size={36} />
        </div>
        <p className="eyebrow" style={{ color: 'var(--primary)', fontWeight: '700', marginBottom: '8px' }}>404 · NOT FOUND</p>
        <h2 style={{ fontSize: '32px', marginBottom: '12px' }}>Page not found</h2>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
          The page or URL you entered does not exist or has been moved. Use the navigation sidebar or return to your overview.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to={homePath} className="button primary">
            <LayoutDashboard size={16} /> Return to {role === 'admin' ? 'Admin Overview' : 'Overview'}
          </Link>
          <Link to="/" className="button ghost">
            <Home size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
