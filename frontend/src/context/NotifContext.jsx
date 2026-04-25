import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '../api';
import { useAuth } from './AuthContext';

const NotifContext = createContext(null);

export function NotifProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.list();
      setNotifications(res.data.notifications);
      setUnread(res.data.unread);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  return (
    <NotifContext.Provider value={{ notifications, unread, markAllRead, refresh: fetchNotifications }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);
