import { useState, useEffect } from 'react';
import { usersApi } from '../api';

function UserModal({ user, onClose, onSave }) {
  const editing = !!user;
  const [form, setForm] = useState({ name: user?.name||'', email: user?.email||'', password: '', role: user?.role||'user', is_active: user?.is_active!==undefined ? user.is_active : 1 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handle = async () => {
    setErr(''); setLoading(true);
    try { await onSave(form); onClose(); } catch (e) { setErr(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{editing ? 'Edit User' : 'Create User'}</h3>
        {err && <div style={{color:'var(--red)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:8}}>{err}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="form-group"><label>Full Name</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="John Doe"/></div>
          {!editing && <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="john@company.com"/></div>}
          <div className="form-group"><label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••"/></div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
              <option value="user">Team Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          {editing && (
            <div className="form-group">
              <label>Status</label>
              <select value={form.is_active} onChange={e=>setForm(p=>({...p,is_active:parseInt(e.target.value)}))}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>{loading ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | user-object

  const load = () => usersApi.list().then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (modal === 'create') {
      await usersApi.create(form);
    } else {
      const payload = {};
      if (form.name) payload.name = form.name;
      if (form.password) payload.password = form.password;
      if (form.role) payload.role = form.role;
      payload.is_active = form.is_active;
      await usersApi.update(modal.id, payload);
    }
    load();
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    await usersApi.remove(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>User Management</h2><p>Manage team members and their roles</p></div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Add User
        </button>
      </div>
      <div className="table-card">
        {loading ? <div className="loader"><div className="spinner"/></div> : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{fontWeight:600}}>{u.name}</td>
                  <td style={{color:'var(--text2)',fontSize:13}}>{u.email}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                  <td><span className={`badge badge-${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{color:'var(--text3)',fontSize:12}}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)}>Edit</button>
                      {u.is_active ? <button className="btn btn-red btn-sm" onClick={() => deactivate(u.id)}>Deactivate</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && <UserModal user={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSave={handleSave}/>}
    </div>
  );
}
