import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetApi } from '../api';
import { PieChart, Pie, Cell, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

const COLORS = { Hardware: '#6366f1', 'Software License': '#10b981', 'Cloud Billing': '#3b82f6', Miscellaneous: '#f59e0b' };

function BudgetModal({ current, fiscalYear, fyList, onClose, onSave }) {
  const [amount, setAmount] = useState(current || '');
  const [fy, setFy] = useState(fiscalYear);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    try { await onSave(amount, notes, fy); onClose(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Set Department Budget</h3>
        <div className="form-group" style={{marginBottom:14}}>
          <label>Fiscal Year</label>
          <select value={fy} onChange={e => setFy(e.target.value)}>
            {fyList.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-group" style={{marginBottom:14}}>
          <label>Total Budget (INR)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000000" />
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Approved by finance committee" rows={2}/>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading?'Saving…':'Save Budget'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFY, setSelectedFY] = useState(null);

  const navigate = useNavigate();
  const load = (fy) => budgetApi.get(fy ? { fy } : {}).then(r => {
    setData(r.data);
    if (!selectedFY) setSelectedFY(r.data.currentFY);
  }).finally(() => setLoading(false));

  useEffect(() => { load(selectedFY); }, [selectedFY]);

  if (loading) return <div className="loader"><div className="spinner"/></div>;
  if (!data) return null;

  const { fiscalYear, currentFY, fyList, totalBudget, approvedTotal, remaining, pendingCount, pendingTotal, byCategory, monthly } = data;
  const usedPct = totalBudget > 0 ? Math.round((approvedTotal / totalBudget) * 100) : 0;
  const alertLevel = usedPct >= 95 ? 'danger' : usedPct >= 80 ? 'warning' : null;
  const isCurrentFY = fiscalYear === currentFY;
  const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>IT Department Dashboard</h2>
          <p>Budget tracking and expense analytics</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{fontSize:12,color:'var(--text3)',fontWeight:600}}>Fiscal Year</label>
            <select value={selectedFY||currentFY} onChange={e => { setSelectedFY(e.target.value); setLoading(true); }}
              style={{padding:'7px 12px',fontSize:13,borderRadius:8,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)'}}>
              {(fyList||[]).map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          {!isCurrentFY && (
            <span style={{fontSize:11,padding:'4px 10px',background:'rgba(245,158,11,.1)',color:'var(--yellow)',border:'1px solid rgba(245,158,11,.3)',borderRadius:20,fontWeight:600}}>
              📁 Viewing past FY
            </span>
          )}
          {isCurrentFY && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              Set Budget
            </button>
          )}
        </div>
      </div>

      {!isCurrentFY && (
        <div className="alert-bar warning" style={{marginBottom:20}}>
          📂 You are viewing archived data for <strong>{fiscalYear}</strong>. This is read-only historical data. Switch to <strong>{currentFY}</strong> for live tracking.
        </div>
      )}

      {alertLevel && isCurrentFY && (
        <div className={`alert-bar ${alertLevel}`}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          {alertLevel === 'danger' ? `🚨 Critical: Budget is ${usedPct}% utilized! Only ${fmt(remaining)} remaining.` : `⚠️ Warning: Budget is ${usedPct}% utilized. Consider reviewing pending expenses.`}
        </div>
      )}

      {totalBudget === 0 && isCurrentFY && (
        <div className="alert-bar" style={{background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',color:'var(--accent2)',marginBottom:20}}>
          💡 No budget has been set for <strong>{fiscalYear}</strong> yet. Click "Set Budget" to configure the department budget for this financial year.
        </div>
      )}

      <div className="cards-grid">
        <div className="stat-card blue">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <div className="stat-label">Total Budget · {fiscalYear}</div>
          <div className="stat-value">{totalBudget > 0 ? fmt(totalBudget) : '—'}</div>
          <div className="progress-wrap"><div className="progress-bar" style={{width:`${Math.min(usedPct,100)}%`, background: alertLevel==='danger'?'var(--red)':alertLevel==='warning'?'var(--yellow)':'var(--green)'}}/></div>
          <div className="stat-sub">{usedPct}% utilized</div>
        </div>
        <div className="stat-card green" onClick={() => navigate('/expenses?status=approved')}
          style={{cursor:'pointer'}} title="View approved expenses">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <div className="stat-label">Approved Expenses · {fiscalYear}</div>
          <div className="stat-value">{fmt(approvedTotal)}</div>
          <div className="stat-sub">Allocated against budget &nbsp;↗</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg></div>
          <div className="stat-label">Remaining Budget</div>
          <div className="stat-value" style={{color: remaining < 0 ? 'var(--red)' : 'inherit'}}>{totalBudget > 0 ? fmt(remaining) : '—'}</div>
          <div className="stat-sub">{totalBudget > 0 ? `${100-usedPct}% available` : 'No budget set'}</div>
        </div>
        <div className="stat-card yellow" onClick={() => navigate('/approvals')}
          style={{cursor:'pointer'}} title="Go to approvals">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <div className="stat-label">Pending Approvals (All FY)</div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-sub">{fmt(pendingTotal)} awaiting review &nbsp;↗</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Spend by Category · {fiscalYear}</div>
          {byCategory.length === 0 ? <div style={{color:'var(--text3)',fontSize:13,textAlign:'center',paddingTop:40}}>No approved expenses for {fiscalYear}</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                  {byCategory.map(entry => <Cell key={entry.category} fill={COLORS[entry.category] || '#6366f1'}/>)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}/>
                <Legend iconType="circle" iconSize={10} wrapperStyle={{fontSize:12}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <div className="chart-title">Monthly Burn Rate · {fiscalYear} <span style={{fontSize:11,color:'var(--text3)',fontWeight:400,marginLeft:8}}>Apr → Mar · all 12 months</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly} margin={{top:8,right:12,left:0,bottom:0}}>
              <XAxis
                dataKey="month"
                tick={{fontSize:10,fill:'var(--text3)'}}
                axisLine={false} tickLine={false}
                tickFormatter={m => {
                  const [y, mo] = m.split('-');
                  const name = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1];
                  return `${name} '${y.slice(2)}`;
                }}
              />
              <YAxis
                yAxisId="monthly"
                tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="right"
                tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
              />
              <Tooltip
                formatter={(v, name) => [fmt(v || 0), name]}
                labelFormatter={m => {
                  const [y, mo] = m.split('-');
                  const name = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1];
                  return `${name} ${y}`;
                }}
                contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}
              />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{fontSize:11}}/>
              {totalBudget > 0 && (
                <ReferenceLine
                  yAxisId="cumulative"
                  y={totalBudget}
                  stroke="var(--red)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: 'Budget limit', position: 'insideTopRight', fontSize: 10, fill: 'var(--red)' }}
                />
              )}
              <Bar yAxisId="monthly" dataKey="approved" name="Monthly Approved" fill="#10b981" radius={[3,3,0,0]} maxBarSize={32}/>
              <Bar yAxisId="monthly" dataKey="pending" name="Monthly Pending" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={32}/>
              <Line
                yAxisId="cumulative"
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Spend"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:16,padding:'8px 4px 0',flexWrap:'wrap'}}>
            <div style={{fontSize:11,color:'var(--text3)'}}>🟩 Monthly approved spend &nbsp;|&nbsp; 🟨 Monthly pending &nbsp;|&nbsp; <span style={{color:'#6366f1',fontWeight:600}}>— Cumulative spend</span>{totalBudget > 0 ? <span style={{color:'var(--red)'}}> &nbsp;|&nbsp; - - Budget ceiling ({fmt(totalBudget)})</span> : ''}</div>
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="table-card">
          <div className="table-header"><span className="table-title">Category Breakdown · {fiscalYear}</span></div>
          <table>
            <thead><tr><th>Category</th><th>Total Approved</th><th>Requests</th><th>% of Budget</th></tr></thead>
            <tbody>
              {byCategory.map(c => (
                <tr key={c.category}>
                  <td><span style={{display:'inline-flex',alignItems:'center',gap:8}}><span style={{width:10,height:10,borderRadius:'50%',background:COLORS[c.category],display:'inline-block'}}/>{c.category}</span></td>
                  <td style={{fontWeight:600}}>{fmt(c.total)}</td>
                  <td>{c.count}</td>
                  <td>{totalBudget > 0 ? `${((c.total/totalBudget)*100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <BudgetModal current={totalBudget} fiscalYear={currentFY} fyList={fyList} onClose={() => setShowModal(false)} onSave={async (a,n,fy) => { await budgetApi.update({total_budget:a,notes:n,fiscal_year:fy}); load(selectedFY); }}/>}
    </div>
  );
}
