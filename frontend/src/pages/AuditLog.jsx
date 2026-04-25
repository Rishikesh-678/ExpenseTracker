import { useState, useEffect } from 'react';
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
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi.listAccess({ page, limit: LIMIT })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="table-card">
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <>
          {logs.length === 0
            ? <div className="table-empty">No access events recorded yet</div>
            : (
              <table>
                <thead>
                  <tr><th>Time</th><th>User</th><th>Event</th><th>IP Address</th><th>User Agent</th></tr>
                </thead>
                <tbody>
                  {logs.map(l => (
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
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p=>p+1)} disabled={page===totalPages}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
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
