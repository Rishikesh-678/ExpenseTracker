import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotifProvider } from './context/NotifContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Approvals from './pages/Approvals';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Reports from './pages/Reports';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader"><div className="spinner"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/expenses" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/dashboard' : '/expenses'} /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to={user?.role === 'admin' ? '/dashboard' : '/expenses'} />} />
        <Route path="dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="approvals" element={<ProtectedRoute adminOnly><Approvals /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute adminOnly><AuditLog /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotifProvider>
          <AppRoutes />
        </NotifProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
