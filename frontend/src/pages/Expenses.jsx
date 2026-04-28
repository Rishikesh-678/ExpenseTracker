import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { expensesApi, categoriesApi, budgetApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotif } from '../context/NotifContext';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const CAT_COLORS = {
  Hardware: { bg: 'rgba(59,130,246,.12)', color: '#3b82f6' },
  'Software License': { bg: 'rgba(16,185,129,.12)', color: '#10b981' },
  'Cloud Billing': { bg: 'rgba(99,102,241,.12)', color: '#6366f1' },
  Miscellaneous: { bg: 'rgba(245,158,11,.12)', color: '#f59e0b' },
};
const catStyle = cat => CAT_COLORS[cat] || { bg: 'rgba(148,163,184,.1)', color: '#94a3b8' };

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

// ── Expense Detail Drawer ──────────────────────────────────────────────────
function ExpenseDrawer({ expense: e, onClose, isAdmin, onRequestUpdate, tippingExpenseIds = new Set() }) {
  if (!e) return null;
  const cs = catStyle(e.category);
  const isTipping = tippingExpenseIds.has(e.id);

  const rows = [
    e.user_name   && { icon: '👤', label: 'Submitted By',  value: e.user_name },
    e.vendor_name && { icon: '🏪', label: 'Vendor Name',   value: e.vendor_name },
    e.po_number   && { icon: '🏷️', label: 'PO Number',     value: e.po_number },
    e.business_line && { icon: '🏢', label: 'Business Line', value: e.business_line },
    e.project     && { icon: '📋', label: 'Project',        value: e.project },
    e.expense_type && {
      icon: e.expense_type === 'planned' ? '📅' : '⚡',
      label: 'Classification',
      value: e.expense_type === 'planned' ? 'Planned' : 'Unplanned',
    },
    e.reference_link && {
      icon: '🔗',
      label: 'Reference Link',
      isLink: true,
      href: e.reference_link,
      value: e.reference_link.length > 55 ? e.reference_link.slice(0, 55) + '…' : e.reference_link,
    },
    e.file_name   && { icon: '📎', label: 'Invoice',       value: e.file_name },
    { icon: '📅', label: 'Submitted At', value: e.submitted_at ? new Date(e.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
    e.reviewer_name && { icon: '✅', label: 'Reviewed By',  value: e.reviewer_name },
    e.reviewed_at   && { icon: '🕒', label: 'Reviewed At',  value: new Date(e.reviewed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
    e.status === 'rejected' && e.rejection_reason && { icon: '❌', label: 'Rejection Reason', value: e.rejection_reason, danger: true },
  ].filter(Boolean);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end',
        animation: 'fadeIn .2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={ev => ev.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: 'var(--card)', borderLeft: '1px solid var(--border)',
          height: '100%', overflowY: 'auto', padding: 28,
          display: 'flex', flexDirection: 'column', gap: 20,
          animation: 'slideInRight .25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: cs.bg, color: cs.color,
              }}>{e.category}</span>
              {isTipping && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                  background: 'rgba(239,68,68,.12)', color: 'var(--red)',
                }}>🚨 Exceeded budget</span>
              )}
              <StatusBadge status={e.status} />
              {e.expense_type && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: e.expense_type === 'planned' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)',
                  color: e.expense_type === 'planned' ? 'var(--green)' : 'var(--red)',
                }}>
                  {e.expense_type === 'planned' ? '📅 Planned' : '⚡ Unplanned'}
                </span>
              )}
              {!isAdmin && e.has_pending_update_request === 1 && (
                <span className="badge" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,.3)' }}>
                  Update Request Pending
                </span>
              )}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{e.description}</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
              color: 'var(--text2)', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all .2s',
            }}
          >×</button>
        </div>

        {/* Amount highlight */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,.15), rgba(139,92,246,.1))',
          border: '1px solid rgba(99,102,241,.25)',
          borderRadius: 12, padding: '18px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>Amount</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent2)' }}>{fmt(e.amount)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>Date</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{e.date}</div>
          </div>
        </div>

        {/* Detail rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {rows.map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', gap: 12, padding: '12px 16px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'var(--card)' : 'var(--bg2)',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.4px' }}>{row.label}</div>
                {row.isLink ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent2)', wordBreak: 'break-all', textDecoration: 'underline' }}
                  >
                    {row.value}
                  </a>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 500, color: row.danger ? 'var(--red)' : 'var(--text)', wordBreak: 'break-word' }}>{row.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!isAdmin && e.status === 'approved' && (
          <button
            className="btn btn-primary"
            onClick={() => onRequestUpdate(e)}
            disabled={e.has_pending_update_request === 1}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {e.has_pending_update_request === 1 ? 'Update Request Pending' : 'Request Update'}
          </button>
        )}

        <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          Close
        </button>
      </div>
    </div>
  );
}

function UpdateExpenseModal({ expense, categories, loading, error, onClose, onSubmit }) {
  const [form, setForm] = useState({
    category: expense.category || '',
    description: expense.description || '',
    amount: expense.amount || '',
    date: expense.date || '',
    po_number: expense.po_number || '',
    vendor_name: expense.vendor_name || '',
    reference_link: expense.reference_link || '',
    business_line: expense.business_line || '',
    project: expense.project || '',
  });
  const [file, setFile] = useState(null);

  const submit = async e => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
    if (file) fd.append('invoice', file);
    await onSubmit(expense.id, fd);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
        <h3 className="modal-title">Request Expense Update</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
          Submit corrected details. Admin approval is required before the original approved expense is replaced.
        </p>
        {error && (
          <div className="alert-bar" style={{ marginBottom: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)' }}>
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Category *</label>
              <input
                type="text"
                list="update-modal-categories"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Hardware, Software License…"
                required
              />
              <datalist id="update-modal-categories">
                {categories.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Amount (INR) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} onClick={e => e.currentTarget.showPicker?.()} required />
            </div>
            <div className="form-group">
              <label>Vendor Name</label>
              <input type="text" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} maxLength={100} />
            </div>
            <div className="form-group">
              <label>PO Number</label>
              <input type="text" value={form.po_number} onChange={e => setForm(p => ({ ...p, po_number: e.target.value }))} maxLength={50} />
            </div>
            <div className="form-group">
              <label>Business Line</label>
              <input type="text" value={form.business_line} onChange={e => setForm(p => ({ ...p, business_line: e.target.value }))} placeholder="e.g. Enterprise IT" maxLength={200} />
            </div>
            <div className="form-group">
              <label>Project</label>
              <input type="text" value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} placeholder="e.g. Network Upgrade Q2" maxLength={200} />
            </div>
            <div className="form-group">
              <label>Invoice / Receipt (optional)</label>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="form-group full">
              <label>Reference Link <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
              <input type="url" value={form.reference_link} onChange={e => setForm(p => ({ ...p, reference_link: e.target.value }))} placeholder="https://vendor.com/quote" maxLength={500} />
            </div>
            <div className="form-group full">
              <label>Description *</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit for Review'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expense Card ───────────────────────────────────────────────────────────
function ExpenseCard({ expense: e, isAdmin, onClick, tippingExpenseIds = new Set() }) {
  const cs = catStyle(e.category);
  const isTipping = tippingExpenseIds.has(e.id);
  return (
    <div
      onClick={() => onClick(e)}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
        transition: 'transform .18s, box-shadow .18s, border-color .18s',
        display: 'flex', flexDirection: 'column', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}
      className="expense-card"
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: isTipping ? 'var(--red)' : cs.color,
        borderRadius: '14px 0 0 14px',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: cs.bg, color: cs.color,
          }}>{e.category}</span>
          {isTipping && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: 'rgba(239,68,68,.12)', color: 'var(--red)',
            }} title="This expense exceeded the category budget">🚨 Exceeded budget</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {e.expense_type && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: e.expense_type === 'planned' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)',
              color: e.expense_type === 'planned' ? 'var(--green)' : 'var(--red)',
            }}>
              {e.expense_type === 'planned' ? '📅 Planned' : '⚡ Unplanned'}
            </span>
          )}
          {!isAdmin && e.has_pending_update_request === 1 && (
            <span className="badge" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,.3)' }}>
              Update Pending
            </span>
          )}
          <StatusBadge status={e.status} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4 }}>
          {e.description}
        </div>
        {isAdmin && e.user_name && (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>👤 {e.user_name}</div>
        )}
      </div>

      {(e.vendor_name || e.po_number || e.business_line || e.project || e.reference_link) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {e.vendor_name && (
            <span style={{ fontSize: 11, background: 'rgba(59,130,246,.1)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              🏪 {e.vendor_name}
            </span>
          )}
          {e.po_number && (
            <span style={{ fontSize: 11, background: 'rgba(99,102,241,.1)', color: 'var(--accent2)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              🏷️ {e.po_number}
            </span>
          )}
          {e.business_line && (
            <span style={{ fontSize: 11, background: 'rgba(16,185,129,.1)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              🏢 {e.business_line}
            </span>
          )}
          {e.project && (
            <span style={{ fontSize: 11, background: 'rgba(245,158,11,.1)', color: 'var(--yellow)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              📋 {e.project}
            </span>
          )}
          {e.reference_link && (
            <span style={{ fontSize: 11, background: 'rgba(148,163,184,.1)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
              🔗 link
            </span>
          )}
        </div>
      )}

      {e.status === 'rejected' && e.rejection_reason && (
        <div style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(239,68,68,.07)', borderRadius: 6, padding: '5px 8px', borderLeft: '2px solid var(--red)' }}>
          {e.rejection_reason.length > 60 ? e.rejection_reason.slice(0, 60) + '…' : e.rejection_reason}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{fmt(e.amount)}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.date}</div>
          {e.file_name && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>📎 receipt</div>}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 12, right: 14,
        fontSize: 10, color: 'var(--text3)', fontWeight: 600,
        letterSpacing: '.4px', textTransform: 'uppercase',
        opacity: 0.7,
      }}>View →</div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Expenses() {
  const { isAdmin } = useAuth();
  const { refresh: refreshNotifs } = useNotif();
  const location = useLocation();
  const initialStatus = new URLSearchParams(location.search).get('status') || '';

  const emptyForm = { category: '', description: '', amount: '', date: '', po_number: '', vendor_name: '', reference_link: '', business_line: '', project: '' };

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: initialStatus, category: '', month: '', quarter: '' });
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [tippingExpenseIds, setTippingExpenseIds] = useState(new Set());
  const [file, setFile] = useState(null);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const [selected, setSelected] = useState(null);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateErr, setUpdateErr] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 12;
  const fileRef = useRef();

  const loadCategories = () =>
    categoriesApi.list().then(r => {
      const cats = r.data.categories;
      setCategories(cats);
      setForm(prev => prev.category ? prev : { ...prev, category: cats[0]?.name || '' });
    });

  useEffect(() => { loadCategories(); }, []);

  useEffect(() => {
    budgetApi.get().then(r => {
      setTippingExpenseIds(new Set(r.data.tippingExpenseIds || []));
    }).catch(() => {});
  }, []);

  const load = (pg = page) =>
    expensesApi.list({ ...filter, search: search || undefined, page: pg, limit: LIMIT })
      .then(r => { setExpenses(r.data.expenses); setTotal(r.data.total); })
      .finally(() => setLoading(false));

  // Reset to page 1 and reload when filters change
  useEffect(() => { setLoading(true); setPage(1); load(1); }, [filter, search]);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    const catName = form.category.trim();
    if (!catName) { setSubmitErr('Please enter a category'); return; }
    setSubmitting(true); setSubmitMsg(''); setSubmitErr('');
    const match = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    const finalCat = match ? match.name : catName;
    if (!match) {
      try {
        await categoriesApi.create(finalCat);
        await loadCategories();
      } catch (err) {
        setSubmitErr(err.response?.data?.error || 'Failed to create category');
        setSubmitting(false);
        return;
      }
    }
    const fd = new FormData();
    Object.entries({ ...form, category: finalCat }).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('invoice', file);
    try {
      await expensesApi.submit(fd);
      setSubmitMsg('Expense submitted successfully!');
      setForm(p => ({ ...emptyForm, category: p.category }));
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load(); refreshNotifs();
    } catch (err) {
      setSubmitErr(err.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const handleRequestUpdate = async (expenseId, formData) => {
    setUpdateSubmitting(true);
    setUpdateErr('');
    try {
      await expensesApi.requestUpdate(expenseId, formData);
      setUpdateTarget(null);
      setSubmitMsg('Update request submitted. Admin review is required before changes are applied.');
      load();
      refreshNotifs();
    } catch (err) {
      setUpdateErr(err.response?.data?.error || 'Failed to submit update request');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const setMonthFilter = val => setFilter(p => ({ ...p, month: val, quarter: '' }));
  const setQuarterFilter = val => setFilter(p => ({ ...p, quarter: val, month: '' }));

  const totalPages = Math.ceil(total / LIMIT);

  const goToPage = pg => {
    const p = Math.max(1, Math.min(pg, totalPages));
    setPage(p);
    setLoading(true);
    load(p);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isAdmin ? 'All Expenses' : 'My Expenses'}</h2>
          <p>Submit and track expense requests</p>
        </div>
      </div>

      {/* Submit form — non-admin only */}
      {!isAdmin && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 className="form-title">Submit New Expense</h3>
          {submitMsg && <div className="alert-bar success" style={{ marginBottom: 16 }}>{submitMsg}</div>}
          {submitErr && <div className="alert-bar" style={{ marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)' }}>{submitErr}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category *</label>
                <input
                  type="text"
                  list="submit-expense-categories"
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Hardware, Software License…"
                  maxLength={50}
                  required
                />
                <datalist id="submit-expense-categories">
                  {categories.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Amount (INR) *</label>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  onClick={e => e.currentTarget.showPicker?.()}
                  style={{ cursor: 'pointer' }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Vendor Name <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                <input type="text" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="e.g. Dell India Pvt. Ltd." maxLength={100} />
              </div>
              <div className="form-group">
                <label>PO Number <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                <input type="text" value={form.po_number} onChange={e => setForm(p => ({ ...p, po_number: e.target.value }))} placeholder="e.g. PO-2024-0042" maxLength={50} />
              </div>
              <div className="form-group">
                <label>Business Line <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(if applicable)</span></label>
                <input type="text" value={form.business_line} onChange={e => setForm(p => ({ ...p, business_line: e.target.value }))} placeholder="e.g. Enterprise IT" maxLength={200} />
              </div>
              <div className="form-group">
                <label>Project <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(if applicable)</span></label>
                <input type="text" value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} placeholder="e.g. Network Upgrade Q2" maxLength={200} />
              </div>
              <div className="form-group">
                <label>Invoice / Receipt <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                <div className="file-input-wrap" onClick={() => fileRef.current.click()}>
                  <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.pdf" onChange={e => setFile(e.target.files[0])} />
                  <div className="file-label">
                    {file
                      ? <span style={{ color: 'var(--green)' }}>{file.name}</span>
                      : <span>Drop file or <span>browse</span> (JPG, PNG, PDF · max 5MB)</span>}
                  </div>
                </div>
              </div>
              <div className="form-group full">
                <label>Reference Link <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional — paste a quote/vendor URL)</span></label>
                <input
                  type="url"
                  value={form.reference_link}
                  onChange={e => setForm(p => ({ ...p, reference_link: e.target.value }))}
                  placeholder="https://vendor.com/quote/12345"
                  maxLength={500}
                />
              </div>
              <div className="form-group full">
                <label>Description *</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the expense…" required rows={3} />
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expense cards section */}
      <div className="table-card">
        <div className="table-header">
          <span className="table-title">{isAdmin ? 'All Expense Records' : 'My Submissions'}</span>
          <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              placeholder="Search description, vendor, PO…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', minWidth: 200, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <select value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filter.category} onChange={e => setFilter(p => ({ ...p, category: e.target.value }))}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={filter.quarter} onChange={e => setQuarterFilter(e.target.value)}>
              <option value="">All Quarters</option>
              <option value="Q1">Q1 (Apr – Jun)</option>
              <option value="Q2">Q2 (Jul – Sep)</option>
              <option value="Q3">Q3 (Oct – Dec)</option>
              <option value="Q4">Q4 (Jan – Mar)</option>
            </select>
            <select
              value={filter.month}
              onChange={e => setMonthFilter(e.target.value)}
            >
              <option value="">All Months</option>
              {(() => {
                const now = new Date();
                const mo = now.getMonth() + 1;
                const yr = now.getFullYear();
                const fyStart = mo >= 4 ? yr : yr - 1;
                return Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(fyStart, 3 + i);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
                  return <option key={val} value={val}>{label}</option>;
                });
              })()}
            </select>
            {(filter.month || filter.quarter) && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '6px 10px', whiteSpace: 'nowrap' }}
                onClick={() => setFilter(p => ({ ...p, month: '', quarter: '' }))}
              >✕ Clear period</button>
            )}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {loading ? (
            <div className="loader"><div className="spinner" /></div>
          ) : expenses.length === 0 ? (
            <div className="table-empty">{search ? 'No expenses match your search' : 'No expenses found'}</div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 14,
              }}>
                {expenses.map(e => (
                  <ExpenseCard key={e.id} expense={e} isAdmin={isAdmin} onClick={setSelected} tippingExpenseIds={tippingExpenseIds} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} expenses
                  </span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 1}
                      style={{ padding: '5px 10px', fontSize: 13 }}
                    >‹ Prev</button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '…' ? (
                          <span key={`ellipsis-${i}`} style={{ fontSize: 13, color: 'var(--text3)', padding: '0 4px' }}>…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => goToPage(p)}
                            style={{
                              padding: '5px 10px', fontSize: 13, borderRadius: 7, cursor: 'pointer',
                              border: '1px solid var(--border)',
                              background: p === page ? 'var(--accent2)' : 'var(--card)',
                              color: p === page ? '#fff' : 'var(--text)',
                              fontWeight: p === page ? 700 : 400,
                              transition: 'all .15s',
                            }}
                          >{p}</button>
                        )
                      )}

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => goToPage(page + 1)}
                      disabled={page === totalPages}
                      style={{ padding: '5px 10px', fontSize: 13 }}
                    >Next ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <ExpenseDrawer
        expense={selected}
        onClose={() => setSelected(null)}
        isAdmin={isAdmin}
        tippingExpenseIds={tippingExpenseIds}
        onRequestUpdate={expense => {
          setSelected(null);
          setUpdateErr('');
          setUpdateTarget(expense);
        }}
      />

      {updateTarget && (
        <UpdateExpenseModal
          expense={updateTarget}
          categories={categories}
          loading={updateSubmitting}
          error={updateErr}
          onClose={() => { if (!updateSubmitting) setUpdateTarget(null); }}
          onSubmit={handleRequestUpdate}
        />
      )}
    </div>
  );
}
