import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetApi } from '../api';
import {
  PieChart, Pie, Cell, Tooltip, ComposedChart, Bar, Line,
  XAxis, YAxis, ResponsiveContainer, Legend, ReferenceLine, BarChart,
} from 'recharts';

const COLORS = { Hardware: '#6366f1', 'Software License': '#10b981', 'Cloud Billing': '#3b82f6', Miscellaneous: '#f59e0b' };
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtMonth = m => {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]} '${y.slice(2)}`;
};

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
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Fiscal Year</label>
          <select value={fy} onChange={e => setFy(e.target.value)}>
            {fyList.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Total Budget (INR)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000000" />
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Approved by finance committee" rows={2} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save Budget'}</button>
        </div>
      </div>
    </div>
  );
}

function BudgetCard({ totalBudget, approvedTotal, remaining, usedPct, alertLevel, fiscalYear, fmt }) {
  const [expanded, setExpanded] = useState(false);

  const barColor = alertLevel === 'danger' ? 'var(--red)' : alertLevel === 'warning' ? 'var(--yellow)' : 'var(--green)';
  const remainColor = remaining < 0 ? 'var(--red)' : remaining < totalBudget * 0.2 ? 'var(--yellow)' : 'var(--green)';

  return (
    <div
      className="stat-card purple"
      onClick={() => setExpanded(e => !e)}
      style={{ cursor: 'pointer', gridColumn: 'span 1', transition: 'all .3s' }}
      title="Click to see budget breakdown"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-card-icon">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: expanded ? 'var(--accent2)' : 'var(--text3)',
          letterSpacing: '.5px', textTransform: 'uppercase', marginTop: 4, transition: 'color .2s'
        }}>
          {expanded ? '▲ Less' : '▼ Details'}
        </span>
      </div>

      <div className="stat-label" style={{ marginTop: 2 }}>Remaining Budget · {fiscalYear}</div>
      <div className="stat-value" style={{ color: totalBudget > 0 ? remainColor : 'inherit' }}>
        {totalBudget > 0 ? fmt(remaining) : '—'}
      </div>

      <div className="progress-wrap" style={{ marginTop: 10 }}>
        <div className="progress-bar" style={{ width: `${Math.min(usedPct, 100)}%`, background: barColor }} />
      </div>
      <div className="stat-sub">
        {totalBudget > 0 ? `${usedPct}% used · ${100 - usedPct}% free` : 'No budget set'}
      </div>

      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
            animation: 'fadeSlideIn .25s ease'
          }}
        >
          {[
            { label: 'Total Budget', value: totalBudget > 0 ? fmt(totalBudget) : '—', color: 'var(--text)' },
            { label: 'Approved Spend', value: fmt(approvedTotal), color: 'var(--green)' },
            { label: 'Remaining', value: totalBudget > 0 ? fmt(remaining) : '—', color: remainColor },
            { label: '% Utilized', value: totalBudget > 0 ? `${usedPct}%` : '—', color: barColor },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}

          {totalBudget > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 6 }}>
                <div style={{ width: `${Math.min(usedPct, 100)}%`, background: barColor, transition: 'width .5s' }} />
                <div style={{ flex: 1, background: 'var(--bg2)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>₹0</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{fmt(totalBudget)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFY, setSelectedFY] = useState(null);
  const [spotlightMonth, setSpotlightMonth] = useState('');

  const navigate = useNavigate();
  const load = (fy) => budgetApi.get(fy ? { fy } : {}).then(r => {
    setData(r.data);
    if (!selectedFY) setSelectedFY(r.data.currentFY);
  }).finally(() => setLoading(false));

  useEffect(() => { load(selectedFY); }, [selectedFY]);

  const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // Compute quarterly data from monthly array
  const quarterlyData = useMemo(() => {
    if (!data?.monthly) return [];
    const sum = months => months.reduce((acc, m) => ({
      approved: acc.approved + (m.approved || 0),
      pending: acc.pending + (m.pending || 0),
      planned: acc.planned + (m.planned || 0),
      unplanned: acc.unplanned + (m.unplanned || 0),
      unclassified: acc.unclassified + (m.unclassified || 0),
    }), { approved: 0, pending: 0, planned: 0, unplanned: 0, unclassified: 0 });

    const m = data.monthly;
    return [
      { name: 'Q1 (Apr–Jun)', ...sum(m.slice(0, 3)) },
      { name: 'Q2 (Jul–Sep)', ...sum(m.slice(3, 6)) },
      { name: 'Q3 (Oct–Dec)', ...sum(m.slice(6, 9)) },
      { name: 'Q4 (Jan–Mar)', ...sum(m.slice(9, 12)) },
    ];
  }, [data]);

  const spotlightData = useMemo(() => {
    if (!spotlightMonth || !data?.monthly) return null;
    return data.monthly.find(m => m.month === spotlightMonth) || null;
  }, [spotlightMonth, data]);

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!data) return null;

  const { fiscalYear, currentFY, fyList, totalBudget, approvedTotal, remaining, pendingCount, pendingTotal, byCategory, monthly } = data;
  const usedPct = totalBudget > 0 ? Math.round((approvedTotal / totalBudget) * 100) : 0;
  const alertLevel = usedPct >= 95 ? 'danger' : usedPct >= 80 ? 'warning' : null;
  const isCurrentFY = fiscalYear === currentFY;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>IT Department Dashboard</h2>
          <p>Budget tracking and expense analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Fiscal Year</label>
            <select value={selectedFY || currentFY} onChange={e => { setSelectedFY(e.target.value); setLoading(true); }}
              style={{ padding: '7px 12px', fontSize: 13, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {(fyList || []).map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          {!isCurrentFY && (
            <span style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(245,158,11,.1)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 20, fontWeight: 600 }}>
              📁 Viewing past FY
            </span>
          )}
          {isCurrentFY && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Set Budget
            </button>
          )}
        </div>
      </div>

      {!isCurrentFY && (
        <div className="alert-bar warning" style={{ marginBottom: 20 }}>
          📂 You are viewing archived data for <strong>{fiscalYear}</strong>. This is read-only historical data. Switch to <strong>{currentFY}</strong> for live tracking.
        </div>
      )}

      {alertLevel && isCurrentFY && (
        <div className={`alert-bar ${alertLevel}`}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {alertLevel === 'danger' ? `🚨 Critical: Budget is ${usedPct}% utilized! Only ${fmt(remaining)} remaining.` : `⚠️ Warning: Budget is ${usedPct}% utilized. Consider reviewing pending expenses.`}
        </div>
      )}

      {totalBudget === 0 && isCurrentFY && (
        <div className="alert-bar" style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', color: 'var(--accent2)', marginBottom: 20 }}>
          💡 No budget has been set for <strong>{fiscalYear}</strong> yet. Click "Set Budget" to configure the department budget for this financial year.
        </div>
      )}

      <div className="cards-grid">
        <BudgetCard
          totalBudget={totalBudget}
          approvedTotal={approvedTotal}
          remaining={remaining}
          usedPct={usedPct}
          alertLevel={alertLevel}
          fiscalYear={fiscalYear}
          fmt={fmt}
        />
        <div className="stat-card green" onClick={() => navigate('/expenses?status=approved')}
          style={{ cursor: 'pointer' }} title="View approved expenses">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div className="stat-label">Approved Expenses · {fiscalYear}</div>
          <div className="stat-value">{fmt(approvedTotal)}</div>
          <div className="stat-sub">Allocated against budget &nbsp;↗</div>
        </div>
        <div className="stat-card yellow" onClick={() => navigate('/approvals')}
          style={{ cursor: 'pointer' }} title="Go to approvals">
          <div className="stat-card-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div className="stat-label">Pending Approvals (All FY)</div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-sub">{fmt(pendingTotal)} awaiting review &nbsp;↗</div>
        </div>
      </div>

      {/* Monthly burn rate + pie charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Spend by Category · {fiscalYear}</div>
          {byCategory.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No approved expenses for {fiscalYear}</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                  {byCategory.map(entry => <Cell key={entry.category} fill={COLORS[entry.category] || '#6366f1'} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <div className="chart-title">Monthly Burn Rate · {fiscalYear} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>Apr → Mar · all 12 months</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={fmtMonth} />
              <YAxis yAxisId="monthly" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
              <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
              <Tooltip
                formatter={(v, name) => [fmt(v || 0), name]}
                labelFormatter={m => { const [y, mo] = m.split('-'); return `${MONTH_NAMES[parseInt(mo)-1]} ${y}`; }}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
              {totalBudget > 0 && (
                <ReferenceLine yAxisId="cumulative" y={totalBudget} stroke="var(--red)" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: 'Budget limit', position: 'insideTopRight', fontSize: 10, fill: 'var(--red)' }} />
              )}
              <Bar yAxisId="monthly" dataKey="approved" name="Monthly Approved" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar yAxisId="monthly" dataKey="pending" name="Monthly Pending" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative Spend"
                stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, padding: '8px 4px 0', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>🟩 Monthly approved &nbsp;|&nbsp; 🟨 Monthly pending &nbsp;|&nbsp; <span style={{ color: '#6366f1', fontWeight: 600 }}>— Cumulative</span>{totalBudget > 0 ? <span style={{ color: 'var(--red)' }}> &nbsp;|&nbsp; - - Budget ceiling ({fmt(totalBudget)})</span> : ''}</div>
          </div>
        </div>
      </div>

      {/* ── Quarterly Breakdown ───────────────────────────────────── */}
      <div className="chart-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 2 }}>Quarterly Expense Breakdown · {fiscalYear}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Planned <span style={{ color: 'var(--green)' }}>■</span> &nbsp;|&nbsp;
              Unplanned <span style={{ color: 'var(--red)' }}>■</span> &nbsp;|&nbsp;
              Unclassified <span style={{ color: 'var(--text3)' }}>■</span> &nbsp;|&nbsp;
              Pending <span style={{ color: '#f59e0b' }}>■</span>
            </div>
          </div>
          {/* Month Spotlight Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Month spotlight:</label>
            <select
              value={spotlightMonth}
              onChange={e => setSpotlightMonth(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="">— Select a month —</option>
              {monthly.map(m => (
                <option key={m.month} value={m.month}>{fmtMonth(m.month)}</option>
              ))}
            </select>
            {spotlightMonth && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setSpotlightMonth('')}>✕</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Quarterly stacked bar chart */}
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={quarterlyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
                <Tooltip
                  formatter={(v, name) => [fmt(v || 0), name]}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="planned" name="Planned" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unplanned" name="Unplanned" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unclassified" name="Unclassified" stackId="a" fill="#6b7280" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quarter summary cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '0 0 auto', minWidth: 180 }}>
            {quarterlyData.map(q => (
              <div key={q.name} style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                minWidth: 170,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>{q.name}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{fmt(q.approved)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {q.planned > 0 && <span style={{ fontSize: 11, color: 'var(--green)' }}>📅 Planned: {fmt(q.planned)}</span>}
                  {q.unplanned > 0 && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚡ Unplanned: {fmt(q.unplanned)}</span>}
                  {q.pending > 0 && <span style={{ fontSize: 11, color: 'var(--yellow)' }}>⏳ Pending: {fmt(q.pending)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Month Spotlight panel */}
        {spotlightData && (
          <div style={{
            marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16,
            animation: 'fadeSlideIn .2s ease',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              📍 Month Spotlight — {fmtMonth(spotlightData.month)}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Approved', value: fmt(spotlightData.approved), color: 'var(--green)', bg: 'rgba(16,185,129,.1)' },
                { label: 'Pending', value: fmt(spotlightData.pending), color: 'var(--yellow)', bg: 'rgba(245,158,11,.1)' },
                { label: 'Planned', value: fmt(spotlightData.planned || 0), color: 'var(--green)', bg: 'rgba(16,185,129,.07)' },
                { label: 'Unplanned', value: fmt(spotlightData.unplanned || 0), color: 'var(--red)', bg: 'rgba(239,68,68,.08)' },
                { label: 'Unclassified', value: fmt(spotlightData.unclassified || 0), color: 'var(--text3)', bg: 'var(--bg2)' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{
                  flex: '1 1 110px', padding: '12px 14px', borderRadius: 10,
                  background: bg, border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category breakdown table */}
      {byCategory.length > 0 && (
        <div className="table-card" style={{ marginTop: 20 }}>
          <div className="table-header"><span className="table-title">Category Breakdown · {fiscalYear}</span></div>
          <table>
            <thead><tr><th>Category</th><th>Total Approved</th><th>Requests</th><th>% of Budget</th></tr></thead>
            <tbody>
              {byCategory.map(c => (
                <tr key={c.category}>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[c.category] || '#6366f1', display: 'inline-block' }} />{c.category}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(c.total)}</td>
                  <td>{c.count}</td>
                  <td>{totalBudget > 0 ? `${((c.total / totalBudget) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <BudgetModal current={totalBudget} fiscalYear={currentFY} fyList={fyList} onClose={() => setShowModal(false)} onSave={async (a, n, fy) => { await budgetApi.update({ total_budget: a, notes: n, fiscal_year: fy }); load(selectedFY); }} />}
    </div>
  );
}
