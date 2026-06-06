import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useAppStore } from '../store/appStore';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * NAV items — roles must match exactly: 'owner' | 'manager' | 'receptionist'
 * These are normalized in AuthContext.mapProfile → normalizeRole()
 */
const NAV = [
    { section: true, labelKey: 'nav.overview' },
    { path: '/dashboard', icon: '⬡', labelKey: 'nav.dashboard', roles: ['owner', 'manager'] },

    { section: true, labelKey: 'nav.management' },
    { path: '/branches', icon: '🏢', labelKey: 'nav.branches', roles: ['owner'] },
    { path: '/schema', icon: '⊞', labelKey: 'nav.schemaBuilder', roles: ['owner', 'manager'] },
    { path: '/tables', icon: '◫', labelKey: 'nav.tableView', roles: ['owner', 'manager', 'receptionist'] },

    { section: true, labelKey: 'nav.operations' },
    { path: '/bookings', icon: '📋', labelKey: 'nav.bookings', roles: ['owner', 'manager', 'receptionist'] },
    { path: '/manual-booking', icon: '✚', labelKey: 'nav.manualBooking', roles: ['owner', 'manager', 'receptionist'] },

    { section: true, labelKey: 'nav.admin' },
    { path: '/staff', icon: '👥', labelKey: 'nav.staff', roles: ['owner'] },
    { path: '/analytics', icon: '📊', labelKey: 'nav.analytics', roles: ['owner', 'manager'] },
    { path: '/settings', icon: '⚙', labelKey: 'nav.settings', roles: ['owner'] },
    { path: '/notifications', icon: '🔔', labelKey: 'nav.notifications', roles: ['owner', 'manager', 'receptionist'], badge: true },
];

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { notifications } = useAppStore();
    const { t } = useTranslation();

    // user.role is ALWAYS one of: 'owner' | 'manager' | 'receptionist'
    // (normalized in AuthContext.mapProfile)
    // Fallback to 'manager' in case user object hasn't loaded yet
    const role = user?.role ?? 'manager';
    const unread = (notifications || []).filter(n => !n.read).length;

    const initials = (user?.first_name || user?.name || 'P')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
        || user?.name
        || user?.email
        || 'Partner';

    const displayRole = {
        owner: t('roles.owner'),
        manager: t('roles.manager'),
        receptionist: t('roles.receptionist'),
    }[role] ?? t('roles.partner');

    return (
        <aside className="sidebar animate-slide">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">R</div>
                <span className="sidebar-logo-text">ReserveX</span>
            </div>

            <nav className="sidebar-nav">
                {NAV.map((item, i) => {
                    if (item.section) {
                        return <div key={`s-${i}`} className="nav-section-label">{t(item.labelKey)}</div>;
                    }

                    // Hide items the current role cannot access
                    if (!item.roles.includes(role)) return null;

                    const active = location.pathname === item.path
                        || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));

                    return (
                        <button
                            key={item.path}
                            className={`nav-item ${active ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {t(item.labelKey)}
                            {item.badge && unread > 0 && (
                                <span style={{
                                    marginLeft: 'auto',
                                    background: 'var(--red)',
                                    color: '#fff',
                                    borderRadius: 10,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '1px 7px',
                                    minWidth: 18,
                                    textAlign: 'center',
                                }}>
                                    {unread > 9 ? '9+' : unread}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <LanguageSwitcher />
                <ThemeToggle />
                <div className="sidebar-user" style={{ marginTop: '8px' }}>
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <div className="user-name">{displayName}</div>
                        <div className="user-role">{displayRole}</div>
                    </div>
                    <button
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, marginLeft: 4 }}
                        onClick={logout}
                        title="Logout"
                    >⏻</button>
                </div>
            </div>
        </aside>
    );
}