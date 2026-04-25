import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/dashboard' : '/expenses');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (e, pw) => { setEmail(e); setPassword(pw); };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>Net<span>Ops</span></h1>
          <p>IT Department Expense Tracker</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="demo-accounts">
          <p>Demo Accounts</p>
          <div className="demo-creds">
            <button type="button" className="demo-cred-btn" onClick={() => fillDemo('admin@netops.com','Admin@123')}>
              <span>Administrator</span>
              <p>admin@netops.com · Admin@123</p>
            </button>
            <button type="button" className="demo-cred-btn" onClick={() => fillDemo('alice@netops.com','User@123')}>
              <span>Team Member</span>
              <p>alice@netops.com · User@123</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
