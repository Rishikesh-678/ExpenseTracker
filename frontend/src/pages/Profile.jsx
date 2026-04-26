import { useState } from 'react';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    setErr(''); setSuccess('');
    if (!form.current || !form.newPass || !form.confirm) {
      return setErr('All fields are required.');
    }
    if (form.newPass.length < 8) {
      return setErr('New password must be at least 8 characters.');
    }
    if (form.newPass !== form.confirm) {
      return setErr('New passwords do not match.');
    }
    setLoading(true);
    try {
      await usersApi.changePassword({
        currentPassword: form.current,
        newPassword: form.newPass,
      });
      setSuccess('Password updated successfully.');
      setForm({ current: '', newPass: '', confirm: '' });
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Profile</h2>
          <p>Manage your account settings</p>
        </div>
      </div>

      {/* Account info card */}
      <div className="form-card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <h3 className="form-title">Account Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Full Name</span>
            <span style={{ fontWeight: 600 }}>{user?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Email</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Role</span>
            <span className={`badge badge-${user?.role}`}>{user?.role === 'admin' ? 'Administrator' : 'Team Member'}</span>
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className="form-card" style={{ maxWidth: 480 }}>
        <h3 className="form-title">Change Password</h3>
        {err && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 8 }}>
            {err}
          </div>
        )}
        {success && (
          <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(34,197,94,.1)', borderRadius: 8 }}>
            {success}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Current Password *</label>
            <input
              type="password"
              placeholder="Enter current password"
              value={form.current}
              onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={form.newPass}
              onChange={e => setForm(p => ({ ...p, newPass: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input
              type="password"
              placeholder="Repeat new password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
