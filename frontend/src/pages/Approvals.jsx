import { useState, useEffect } from 'react';
import { expensesApi } from '../api';
import { useNotif } from '../context/NotifContext';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

function RejectModal({ expense, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    if (!reason.trim()) return alert('Reason required');
    setLoading(true);
    try { await onConfirm(expense.id, reason); onClose(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Reject Expense</h3>
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>Rejecting: <strong>{expense.description}</strong> — {fmt(expense.amount)}</p>
        <div className="form-group">
          <label>Rejection Reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide a reason for rejection…" rows={3} autoFocus/>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-red" onClick={handle} disabled={loading}>{loading ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Approvals() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [processing, setProcessing] = useState({});
  const { refresh: refreshNotifs } = useNotif();

  const load = () => expensesApi.list({ status: 'pending' }).then(r => setExpenses(r.data.expenses)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setProcessing(p => ({ ...p, [id]: 'approving' }));
    try { await expensesApi.approve(id); refreshNotifs(); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setProcessing(p => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const reject = async (id, reason) => {
    await expensesApi.reject(id, reason);
    refreshNotifs();
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Pending Approvals</h2><p>Review and action expense requests from team members</p></div>
        <div className="badge badge-pending" style={{padding:'6px 14px',fontSize:13}}>
          {expenses.length} Pending
        </div>
      </div>

      <div className="table-card">
        {loading ? <div className="loader"><div className="spinner"/></div> :
          expenses.length === 0 ? (
            <div className="table-empty">
              <div style={{fontSize:40,marginBottom:12}}>✅</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>All caught up!</div>
              <div>No pending expense requests at this time.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Submitted By</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{fontWeight:600}}>{e.user_name}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>{e.user_email}</div>
                    </td>
                    <td>
                      <div style={{fontWeight:500}}>{e.description}</div>
                      {e.po_number && <div style={{fontSize:11,color:'var(--accent2)',marginTop:2}}>🏷️ PO: {e.po_number}</div>}
                      {e.file_name && <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>📎 {e.file_name}</div>}
                    </td>
                    <td><span style={{fontSize:12,padding:'3px 8px',background:'var(--bg2)',borderRadius:6,color:'var(--text2)'}}>{e.category}</span></td>
                    <td style={{fontWeight:700,fontSize:15}}>{fmt(e.amount)}</td>
                    <td style={{color:'var(--text2)',fontSize:12}}>{e.date}</td>
                    <td style={{color:'var(--text3)',fontSize:12}}>{new Date(e.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-green btn-sm" onClick={() => approve(e.id)} disabled={!!processing[e.id]}>
                          {processing[e.id] === 'approving' ? '…' : '✓ Approve'}
                        </button>
                        <button className="btn btn-red btn-sm" onClick={() => setRejectTarget(e)}>
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {rejectTarget && <RejectModal expense={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={reject}/>}
    </div>
  );
}
