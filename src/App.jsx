import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useAppStore } from './store/appStore';
import { useThemeStore } from './store/themeStore';
import Sidebar from './components/Sidebar';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BranchesPage from './pages/BranchesPage';
import BranchDetailPage from './pages/BranchDetailPage';
import SchemaBuilderPage from './pages/SchemaBuilderPage';
import TablesViewPage from './pages/TablesViewPage';
import BookingsPage from './pages/BookingsPage';
import ManualBookingPage from './pages/ManualBookingPage';
import StaffPage from './pages/StaffPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import './styles.css';

function ProtectedLayout() {
  const { user, authReady } = useAuth();

  useEffect(() => {
    useAppStore.getState().refreshBranchStats();
    useThemeStore.getState().initTheme();
  }, []);

  if (!authReady) {
    return (
      <div className="app-layout" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Loading workspace…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/branches/:id" element={<BranchDetailPage />} />
          <Route path="/schema" element={<SchemaBuilderPage />} />
          <Route path="/tables" element={<TablesViewPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/manual-booking" element={<ManualBookingPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function PublicRoute() {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text2)' }}>Loading…</span>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </AuthProvider>
  );
}
