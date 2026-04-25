import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { expensesApi, categoriesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotif } from '../context/NotifContext';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const CUSTOM_KEY = '__custom__';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>;
}

export default function Expenses() {
  const { isAdmin } = useAuth();
  const { refresh: refreshNotifs } = useNotif();
  const location = useLocation();
  const initialStatus = new URLSearchParams(location.search).get('status') || '';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: initialStatus, category: '' });
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: '', po_number: '' });
  const [showCustom, setShowCustom] = useState(false);
  const [customCatInput, setCustomCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState('');
  const [file, setFile] = useState(null);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const fileRef = useRef();

  const loadCategories = () =>
    categoriesApi.list().then(r => {
      const cats = r.data.categories;
      setCategories(cats);
      // Set default form category only once
      setForm(prev => prev.category ? prev : { ...prev, category: cats[0]?.name || '' });
    });

  useEffect(() => { loadCategories(); }, []);

  const load = () =>
    expensesApi.list(filter).then(r => setExpenses(r.data.expenses)).finally(() => setLoading(false));
  useEffect(() => { setLoading(true); load(); }, [filter]);

  // --- Custom category handlers ---
  const handleCategoryChange = (e) => {
    if (e.target.value === CUSTOM_KEY) {
      setShowCustom(true);
      setCatError('');
    } else {
      setShowCustom(false);
      setForm(p => ({ ...p, category: e.target.value }));
    }
  };

  const handleAddCategory = async () => {
    const name = customCatInput.trim();
    if (!name) { setCatError('Enter a category name'); return; }
    if (name.length > 50) { setCatError('Max 50 characters'); return; }
    setAddingCat(true); setCatError('');
    try {
      await categoriesApi.create(name);
      await loadCategories();
      setForm(p => ({ ...p, category: name }));
      setShowCustom(false);
      setCustomCatInput('');
    } catch (e) {
      setCatError(e.response?.data?.error || 'Failed to add category');
    } finally { setAddingCat(false); }
  };

  // --- Expense submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) { setSubmitErr('Please select a category'); return; }
    setSubmitting(true); setSubmitMsg(''); setSubmitErr('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('invoice', file);
    try {
      await expensesApi.submit(fd);
      setSubmitMsg('Expense submitted successfully!');
      setForm(p => ({ ...p, description: '', amount: '', date: '', po_number: '' }));
      setFile(null);
      load(); refreshNotifs();
    } catch (err) {
      setSubmitErr(err.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>{isAdmin ? 'All Expenses' : 'My Expenses'}</h2><p>Submit and track expense requests</p></div>
      </div>

      {!isAdmin && (
        <div className="form-card" style={{marginBottom:24}}>
          <h3 className="form-title">Submit New Expense</h3>
          {submitMsg && <div className="alert-bar success" style={{marginBottom:16}}>{submitMsg}</div>}
          {submitErr && <div className="alert-bar" style={{marginBottom:16,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',color:'var(--red)'}}>{submitErr}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category *</label>
                <select value={showCustom ? CUSTOM_KEY : form.category} onChange={handleCategoryChange}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option disabled>──────────────</option>
                  <option value={CUSTOM_KEY}>➕ Other (custom category)…</option>
                </select>
                {/* Custom category inline input */}
                {showCustom && (
                  <div style={{marginTop:8,padding:'12px',background:'var(--bg2)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:12,color:'var(--text3)',marginBottom:8,fontWeight:600}}>New category name</div>
                    <div style={{display:'flex',gap:8}}>
                      <input
                        type="text"
                        value={customCatInput}
                        onChange={e => setCustomCatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                        placeholder="e.g. Networking Equipment"
                        maxLength={50}
                        style={{flex:1}}
                        autoFocus
                      />
                      <button type="button" className="btn btn-primary" onClick={handleAddCategory} disabled={addingCat} style={{whiteSpace:'nowrap'}}>
                        {addingCat ? '…' : 'Use this'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => { setShowCustom(false); setCustomCatInput(''); setCatError(''); }}>
                        Cancel
                      </button>
                    </div>
                    {catError && <div style={{color:'var(--red)',fontSize:12,marginTop:6}}>{catError}</div>}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Amount (INR) *</label>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00" required/>
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <label>PO Number <span style={{fontWeight:400,color:'var(--text3)'}}>(optional)</span></label>
                <input type="text" value={form.po_number} onChange={e=>setForm(p=>({...p,po_number:e.target.value}))} placeholder="e.g. PO-2024-0042" maxLength={50}/>
              </div>
              <div className="form-group">
                <label>Invoice / Receipt (optional)</label>
                <div className="file-input-wrap" onClick={() => fileRef.current.click()}>
                  <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files[0])}/>
                  <div className="file-label">
                    {file ? <span style={{color:'var(--green)'}}>{file.name}</span> : <span>Drop file or <span>browse</span> (JPG, PNG, PDF · max 5MB)</span>}
                  </div>
                </div>
              </div>
              <div className="form-group full">
                <label>Description *</label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Brief description of the expense…" required rows={3}/>
              </div>
            </div>
            <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}>
              <button type="submit" className="btn btn-primary" disabled={submitting || showCustom}>
                {submitting ? 'Submitting…' : 'Submit Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <span className="table-title">{isAdmin ? 'All Expense Records' : 'My Submissions'}</span>
          <div className="filter-bar">
            <select value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filter.category} onChange={e=>setFilter(p=>({...p,category:e.target.value}))}>
              <option value="">All Categories</option>
              {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {loading ? <div className="loader"><div className="spinner"/></div> :
          expenses.length === 0 ? <div className="table-empty">No expenses found</div> :
          <table>
            <thead>
              <tr>
                {isAdmin && <th>Submitted By</th>}
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Reviewed By</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  {isAdmin && <td style={{fontWeight:500}}>{e.user_name}</td>}
                  <td>
                    <div style={{fontWeight:500}}>{e.description}</div>
                    {e.po_number && <div style={{fontSize:11,color:'var(--accent2)',marginTop:3}}>🏷️ PO: {e.po_number}</div>}
                    {e.status === 'rejected' && e.rejection_reason && <div style={{fontSize:11,color:'var(--red)',marginTop:3}}>Reason: {e.rejection_reason}</div>}
                    {e.file_name && <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>📎 {e.file_name}</div>}
                  </td>
                  <td><span style={{fontSize:12,color:'var(--text2)'}}>{e.category}</span></td>
                  <td style={{fontWeight:700}}>{fmt(e.amount)}</td>
                  <td style={{color:'var(--text2)',fontSize:12}}>{e.date}</td>
                  <td><StatusBadge status={e.status}/></td>
                  <td style={{color:'var(--text3)',fontSize:12}}>{e.reviewer_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
}
