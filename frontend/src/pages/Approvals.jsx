import { useState, useEffect, useMemo, useRef } from 'react';
import { expensesApi, categoriesApi, budgetApi } from '../api';
import { useNotif } from '../context/NotifContext';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

function RejectModal({ expense, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    if (!reason.trim()) return alert('Reason required');
    setLoading(true);
    try { await onConfirm(expense, reason); onClose(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Reject {expense.is_update_request ? 'Update Request' : 'Expense'}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Rejecting: <strong>{expense.description}</strong> — {fmt(expense.amount)}</p>
        <div className="form-group">
          <label>Rejection Reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide a reason for rejection…" rows={3} autoFocus />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-red" onClick={handle} disabled={loading}>{loading ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ expense, onClose, onConfirm, categories, categoryBudgets, byCategory }) {
  const [expenseType, setExpenseType] = useState(expense.expense_type || 'planned');
  const [category, setCategory] = useState(expense.category);
  const [loading, setLoading] = useState(false);

  const catBudget = categoryBudgets.find(cb => cb.category === category);
  const catSpend = byCategory.find(c => c.category === category);
  const allocated = catBudget?.allocated_amount || 0;
  const spent = catSpend?.total || 0;
  const remaining = allocated - spent;
  const catPct = allocated > 0 ? Math.round((spent / allocated) * 100) : null;
  const catColor = catPct === null ? 'var(--text3)' : catPct >= 95 ? 'var(--red)' : catPct >= 80 ? 'var(--yellow)' : 'var(--green)';
  const wouldExceed = allocated > 0 && (spent + expense.amount) > allocated;

  const handle = async () => {
    setLoading(true);
    try {
      await onConfirm(expense, expenseType, category !== expense.category ? category : undefined);
      onClose();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Approve {expense.is_update_request ? 'Update Request' : 'Expense'}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Approving: <strong>{expense.description}</strong> — {fmt(expense.amount)}
        </p>

        {/* Category tag */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Tag to Budget Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: 13 }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          {category !== expense.category && (
            <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 4 }}>
              ⚠️ Category will be changed from "{expense.category}" to "{category}"
            </div>
          )}
        </div>

        {/* Category budget status */}
        {allocated > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: wouldExceed ? 'rgba(239,68,68,.08)' : 'var(--bg2)', border: `1px solid ${wouldExceed ? 'rgba(239,68,68,.3)' : 'var(--border)'}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
              {category} Budget
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Allocated</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(allocated)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Spent</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmt(spent)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Remaining</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: remaining < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(remaining)}</div>
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
              <div style={{ width: `${Math.min(catPct || 0, 100)}%`, height: '100%', background: catColor, borderRadius: 3, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: catColor, marginTop: 4, fontWeight: 600 }}>
              {catPct !== null ? `${catPct}% used` : ''}
              {wouldExceed && ` · ⚠️ Approving this will exceed the category budget by ${fmt((spent + expense.amount) - allocated)}`}
            </div>
          </div>
        )}

        {/* Expense type */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Classify this expense *</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[
              { value: 'planned', label: '📅 Planned', desc: 'Budgeted / expected expense', color: 'var(--green)', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.4)' },
              { value: 'unplanned', label: '⚡ Unplanned', desc: 'Unbudgeted / ad-hoc expense', color: 'var(--red)', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.4)' },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => setExpenseType(opt.value)}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${expenseType === opt.value ? opt.border : 'var(--border)'}`,
                  background: expenseType === opt.value ? opt.bg : 'var(--bg2)',
                  transition: 'all .18s',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: expenseType === opt.value ? opt.color : 'var(--text)', marginBottom: 4 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-green" onClick={handle} disabled={loading}>
            {loading ? 'Approving…' : '✓ Approve as ' + (expenseType === 'planned' ? 'Planned' : 'Unplanned')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminAddExpenseModal({ onClose, onAdded, categories }) {
  const [form, setForm] = useState({ category: categories[0] || '', description: '', amount: '', date: new Date().toISOString().split('T')[0], expense_type: 'planned', vendor_name: '', po_number: '', business_line: '', project: '', reference_link: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.category || !form.description.trim() || !form.amount || !form.date) {
      return alert('Category, description, amount, and date are required');
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      fd.append('direct_add', 'true');
      if (file) fd.append('invoice', file);
      await expensesApi.submit(fd);
      onAdded();
      onClose();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Add Expense (Admin Direct)</h3>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Expense will be immediately approved and recorded against the budget.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="form-group">
            <label>Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="What was this expense for?" />
          </div>
          <div className="form-group">
            <label>Amount (INR) *</label>
            <input type="number" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Vendor Name</label>
            <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="Vendor / Supplier" />
          </div>
          <div className="form-group">
            <label>PO Number</label>
            <input value={form.po_number} onChange={e => set('po_number', e.target.value)} placeholder="PO-XXXX" />
          </div>
          <div className="form-group">
            <label>Business Line</label>
            <input value={form.business_line} onChange={e => set('business_line', e.target.value)} placeholder="e.g. Engineering" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Project</label>
            <input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Project name" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Reference Link</label>
            <input value={form.reference_link} onChange={e => set('reference_link', e.target.value)} placeholder="https://…" />
          </div>
        </div>

        {/* Expense type */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Expense Type *</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[
              { value: 'planned', label: '📅 Planned', desc: 'Budgeted / expected', color: 'var(--green)', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.4)' },
              { value: 'unplanned', label: '⚡ Unplanned', desc: 'Ad-hoc / unbudgeted', color: 'var(--red)', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.4)' },
            ].map(opt => (
              <div key={opt.value} onClick={() => set('expense_type', opt.value)} style={{
                flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${form.expense_type === opt.value ? opt.border : 'var(--border)'}`,
                background: form.expense_type === opt.value ? opt.bg : 'var(--bg2)',
                transition: 'all .18s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: form.expense_type === opt.value ? opt.color : 'var(--text)', marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice */}
        <div className="form-group" style={{ marginBottom: 4 }}>
          <label>Invoice / Receipt (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} type="button">
              📎 {file ? file.name : 'Attach file'}
            </button>
            {file && <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>✕</button>}
          </div>
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>
            {loading ? 'Adding…' : '✓ Add & Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Approvals() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [processing, setProcessing] = useState({});
  const { refresh: refreshNotifs } = useNotif();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sortCol, setSortCol] = useState('submitted_at');
  const [sortDir, setSortDir] = useState('desc');

  const load = () => {
    expensesApi.list({ status: 'pending' }).then(r => setExpenses(r.data.expenses)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    categoriesApi.list().then(r => setCategories((r.data.categories || []).filter(c => c.is_active).map(c => c.name)));
    budgetApi.get().then(r => {
      setCategoryBudgets(r.data.categoryBudgets || []);
      setByCategory(r.data.byCategory || []);
    });
  }, []);

  const approve = async (expense, expenseType, category) => {
    const id = expense.id;
    setProcessing(p => ({ ...p, [id]: 'approving' }));
    try { await expensesApi.approve(id, expenseType, category); refreshNotifs(); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setProcessing(p => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const approveUpdateRequest = async (expense, expenseType) => {
    const id = expense.update_request_id;
    setProcessing(p => ({ ...p, [id]: 'approving' }));
    try { await expensesApi.approveUpdateRequest(id, expenseType); refreshNotifs(); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setProcessing(p => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const handleApproveConfirm = async (expense, expenseType, category) => {
    if (expense.is_update_request) {
      await approveUpdateRequest(expense, expenseType);
    } else {
      await approve(expense, expenseType, category);
    }
  };

  const reject = async (expense, reason) => {
    if (expense.is_update_request) {
      await expensesApi.rejectUpdateRequest(expense.update_request_id, reason);
    } else {
      await expensesApi.reject(expense.id, reason);
    }
    refreshNotifs();
    load();
  };

  const filtered = useMemo(() => {
    let list = [...expenses];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.user_name || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.vendor_name || '').toLowerCase().includes(q) ||
        (e.po_number || '').toLowerCase().includes(q)
      );
    }
    if (catFilter) list = list.filter(e => e.category === catFilter);
    if (dateFrom) list = list.filter(e => e.date >= dateFrom);
    if (dateTo) list = list.filter(e => e.date <= dateTo);

    list.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === 'amount') { va = Number(va); vb = Number(vb); }
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [expenses, search, catFilter, dateFrom, dateTo, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity: .3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const hasFilters = search || catFilter || dateFrom || dateTo;
  const clearAllFilters = () => { setSearch(''); setCatFilter(''); setDateFrom(''); setDateTo(''); };

  return (
    <div>
      <div className="page-header">
        <div><h2>Pending Approvals</h2><p>Review and action expense requests from team members</p></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowAddExpense(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Add Expense
          </button>
          <div className="badge badge-pending" style={{ padding: '6px 14px', fontSize: 13 }}>
            {filtered.length}{hasFilters ? ` / ${expenses.length}` : ''} Pending
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
          <label style={{ fontSize: 11, marginBottom: 2 }}>Search</label>
          <input
            placeholder="Submitter, description, vendor, PO…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px' }}
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 150px', margin: 0 }}>
          <label style={{ fontSize: 11, marginBottom: 2 }}>Category</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ fontSize: 13, padding: '7px 10px' }}>
            <option value="">All</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: '0 0 130px', margin: 0 }}>
          <label style={{ fontSize: 11, marginBottom: 2 }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 13, padding: '7px 10px' }} />
        </div>
        <div className="form-group" style={{ flex: '0 0 130px', margin: 0 }}>
          <label style={{ fontSize: 11, marginBottom: 2 }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 13, padding: '7px 10px' }} />
        </div>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '7px 12px', whiteSpace: 'nowrap' }} onClick={clearAllFilters}>✕ Clear all</button>
        )}
      </div>

      <div className="table-card">
        {loading ? <div className="loader"><div className="spinner" /></div> :
          filtered.length === 0 ? (
            <div className="table-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{hasFilters ? 'No matching results' : 'All caught up!'}</div>
              <div>{hasFilters ? 'Try adjusting your filters.' : 'No pending expense requests at this time.'}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('user_name')}>Submitted By{sortIcon('user_name')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>Description{sortIcon('description')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('vendor_name')}>Vendor{sortIcon('vendor_name')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('amount')}>Amount{sortIcon('amount')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>Date{sortIcon('date')}</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('submitted_at')}>Submitted{sortIcon('submitted_at')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const processKey = e.is_update_request ? e.update_request_id : e.id;
                  return (
                    <tr key={`${e.is_update_request ? 'ur' : 'e'}-${processKey}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{e.user_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.user_email}</div>
                      </td>
                      <td>
                        {e.is_update_request && (
                          <div style={{ fontSize: 10, color: 'var(--yellow)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                            Update Request
                          </div>
                        )}
                        <div style={{ fontWeight: 500 }}>{e.description}</div>
                        {e.po_number && <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2 }}>🏷️ PO: {e.po_number}</div>}
                        {e.business_line && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>🏢 {e.business_line}</div>}
                        {e.project && <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 2 }}>📋 {e.project}</div>}
                        {e.reference_link && (
                          <a href={e.reference_link} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2, display: 'block', textDecoration: 'underline' }}
                            onClick={ev => ev.stopPropagation()}>
                            🔗 Reference link
                          </a>
                        )}
                        {e.file_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>📎 {e.file_name}</div>}
                      </td>
                      <td><span style={{ fontSize: 12, padding: '3px 8px', background: 'var(--bg2)', borderRadius: 6, color: 'var(--text2)' }}>{e.category}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>{e.vendor_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={{ fontWeight: 700, fontSize: 15 }}>{fmt(e.amount)}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{e.date}</td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{new Date(e.submitted_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-green btn-sm"
                            onClick={() => setApproveTarget(e)}
                            disabled={!!processing[processKey]}
                          >
                            {processing[processKey] === 'approving' ? '…' : '✓ Approve'}
                          </button>
                          <button className="btn btn-red btn-sm" onClick={() => setRejectTarget(e)}>
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>

      {rejectTarget && <RejectModal expense={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={reject} />}
      {approveTarget && (
        <ApproveModal
          expense={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={handleApproveConfirm}
          categories={categories}
          categoryBudgets={categoryBudgets}
          byCategory={byCategory}
        />
      )}
      {showAddExpense && (
        <AdminAddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onAdded={() => { load(); budgetApi.get().then(r => { setCategoryBudgets(r.data.categoryBudgets || []); setByCategory(r.data.byCategory || []); }); }}
          categories={categories}
        />
      )}
    </div>
  );
}
