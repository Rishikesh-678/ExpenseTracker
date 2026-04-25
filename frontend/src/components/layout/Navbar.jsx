import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotif } from '../../context/NotifContext';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/expenses': 'My Expenses',
  '/approvals': 'Pending Approvals',
  '/users': 'User Management',
  '/audit': 'Audit Log',
  '/reports': 'Reports & Export',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Navbar() {
  const location = useLocation();
  const { notifications, unread, markAllRead } = useNotif();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const title = pageTitles[location.pathname] || 'NetOps';

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && unread > 0) markAllRead();
  };

  return (
    <header className="navbar">
      <div className="navbar-title">{title}</div>
      <div className="navbar-right" ref={ref}>
        <div style={{ position: 'relative' }}>
          <button className="notif-btn" onClick={handleOpen} title="Notifications">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {open && (
            <div className="notif-panel">
              <div className="notif-header">
                <h3>Notifications</h3>
                <button onClick={markAllRead}>Mark all read</button>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications yet</div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`notif-item${!n.is_read ? ' unread' : ''}`}>
                    <div className={`notif-dot ${n.type}`}/>
                    <div>
                      <div className="notif-text">{n.message}</div>
                      <div className="notif-time">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
