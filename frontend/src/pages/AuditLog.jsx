import { useState, useEffect, useMemo } from 'react';
import { auditApi } from '../api';

const ACTION_COLORS = {
  EXPENSE_SUBMITTED: 'var(--accent2)',
  EXPENSE_APPROVED: 'var(--green)',
  EXPENSE_REJECTED: 'var(--red)',
  BUDGET_SET: 'var(--yellow)',
  USER_CREATED: 'var(--green)',
  USER_UPDATED: 'var(--blue)',
  USER_DEACTIVATED: 'var(--red)',
};

const EVENT_COLORS = {
  LOGIN: 'var(--green)',
  LOGOUT: 'var(--text3)',
};

const LIMIT = 25;

function formatDetails(details) {
  try {
    const d = JSON.parse(details);
    return Object.entries(d).filter(([,v]) => v !== null).map(([k,v]) => `${k}: ${v}`).join(' · ');
  } catch { return details || '—'; }
}

function ActionLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi.list({ page, limit: LIMIT })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="table-card">
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <>
          {logs.length === 0
            ? <div className="table-empty">No action events recorded yet</div>
            : (
              <table>
                <thead>
                  <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td style={{color:'var(--text3)',fontSize:12,whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{fontWeight:500}}>{l.actor_name || '—'}</td>
                      <td>
                        <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,background:'rgba(0,0,0,.3)',color:ACTION_COLORS[l.action]||'var(--text2)'}}>
                          {l.action}
                        </span>
                      </td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>{l.target_type ? `${l.target_type} #${l.target_id}` : '—'}</td>
                      <td style={{fontSize:12,color:'var(--text3)',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formatDetails(l.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage(p=>p-1)} disabled={page===1}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p=>p+1)} disabled={page===totalPages}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccessLog() {
  const [allLogs, setAllLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setLoading(true);
    // Fetch a generous batch; access logs are typically smaller
    auditApi.listAccess({ page: 1, limit: 500 })
      .then(r => setAllLogs(r.data.logs || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...allLogs];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.ip_address || '').toLowerCase().includes(q)
      );
    }
    if (eventFilter) list = list.filter(l => l.event === eventFilter);
    if (dateFrom) list = list.filter(l => l.created_at >= dateFrom);
    if (dateTo) {
      // Include the full end-of-day
      const end = dateTo + 'T23:59:59';
      list = list.filter(l => l.created_at <= end);
    }

    return list;
  }, [allLogs, search, eventFilter, dateFrom, dateTo]);

  // Client-side pagination on filtered data
  const totalPages = Math.ceil(filtered.length / LIMIT);
  const paginated = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, eventFilter, dateFrom, dateTo]);

  const hasFilters = search || eventFilter || dateFrom || dateTo;

  return (
    <>
      {/* Filter bar */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14,alignItems:'flex-end'}}>
        <div className="form-group" style={{flex:'1 1 180px',margin:0}}>
          <label style={{fontSize:11,marginBottom:2}}>Search</label>
          <input
            placeholder="User name or IP address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{fontSize:13,padding:'7px 10px'}}
          />
        </div>
        <div className="form-group" style={{flex:'0 0 130px',margin:0}}>
          <label style={{fontSize:11,marginBottom:2}}>Event</label>
          <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} style={{fontSize:13,padding:'7px 10px'}}>
            <option value="">All Events</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
          </select>
        </div>
        <div className="form-group" style={{flex:'0 0 140px',margin:0}}>
          <label style={{fontSize:11,marginBottom:2}}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{fontSize:13,padding:'7px 10px'}} />
        </div>
        <div className="form-group" style={{flex:'0 0 140px',margin:0}}>
          <label style={{fontSize:11,marginBottom:2}}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{fontSize:13,padding:'7px 10px'}} />
        </div>
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            style={{fontSize:11,padding:'7px 12px',whiteSpace:'nowrap'}}
            onClick={() => { setSearch(''); setEventFilter(''); setDateFrom(''); setDateTo(''); }}
          >✕ Clear</button>
        )}
      </div>

      <div className="table-card">
        {loading ? <div className="loader"><div className="spinner"/></div> : (
          <>
            {paginated.length === 0
              ? <div className="table-empty">{hasFilters ? 'No matching access events' : 'No access events recorded yet'}</div>
              : (
                <table>
                  <thead>
                    <tr><th>Time</th><th>User</th><th>Event</th><th>IP Address</th><th>User Agent</th></tr>
                  </thead>
                  <tbody>
                    {paginated.map(l => (
                      <tr key={l.id}>
                        <td style={{color:'var(--text3)',fontSize:12,whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={{fontWeight:500}}>{l.user_name || '—'}</td>
                        <td>
                          <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,background:'rgba(0,0,0,.3)',color:EVENT_COLORS[l.event]||'var(--text2)'}}>
                            {l.event}
                          </span>
                        </td>
                        <td style={{fontSize:12,color:'var(--text2)',fontFamily:'monospace'}}>{l.ip_address || '—'}</td>
                        <td style={{fontSize:11,color:'var(--text3)',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={l.user_agent||''}>{l.user_agent || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => setPage(p=>p-1)} disabled={page===1}>← Prev</button>
                <span>Page {page} of {totalPages} ({filtered.length} results)</span>
                <button onClick={() => setPage(p=>p+1)} disabled={page===totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function AuditLog() {
  const [tab, setTab] = useState('action');

  const tabStyle = (t) => ({
    padding: '8px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all .2s',
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? 'white' : 'var(--text3)',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p>Complete trail of all system events</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:4,padding:'4px',background:'var(--card)',borderRadius:10,border:'1px solid var(--border)',width:'fit-content',marginBottom:20}}>
        <button style={tabStyle('action')} onClick={() => setTab('action')}>
          📋 Action Log
        </button>
        <button style={tabStyle('access')} onClick={() => setTab('access')}>
          🔐 Access Log
        </button>
      </div>

      <div style={{fontSize:12,color:'var(--text3)',marginBottom:16}}>
        {tab === 'action'
          ? 'Business actions — expense submissions, approvals, rejections, budget changes, user management'
          : 'Authentication events — all login and logout activity with IP addresses'}
      </div>

      {tab === 'action' ? <ActionLog /> : <AccessLog />}
    </div>
  );
}
