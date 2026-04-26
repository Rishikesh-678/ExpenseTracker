import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = user?.role === 'admin' ? '/dashboard' : '/expenses';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: 'var(--bg)',
      color: 'var(--text)',
      textAlign: 'center',
      padding: 24,
    }}>
      <div style={{ fontSize: 72, lineHeight: 1 }}>🔍</div>
      <h1 style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>404</h1>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Page Not Found</h2>
      <p style={{ color: 'var(--text3)', maxWidth: 360, fontSize: 14, lineHeight: 1.6 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button className="btn btn-primary" onClick={() => navigate(home)} style={{ marginTop: 8 }}>
        ← Back to Home
      </button>
    </div>
  );
}
