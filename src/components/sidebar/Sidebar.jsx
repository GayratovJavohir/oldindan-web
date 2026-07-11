import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import AuthService from '../../services/auth.services';
import { getStoredUser } from '../../utils/authUser';
import { useNotifications } from '../../context/NotificationContext';

const navItems = {
  OVERVIEW: [
    { label: 'Dashboard', icon: '⊞', path: '/dashboard', roles: ['owner', 'manager'] },
  ],
  BOOKINGS: [
    { label: 'All Bookings', icon: '☰', badgeKey: 'booking', path: '/bookings', roles: ['owner', 'manager', 'receptionist'] },
    { label: 'Live View', icon: '◷', path: '/live-view', roles: ['owner', 'manager'] },
    { label: 'Manual Booking', icon: '+', path: '/manual-bookings', roles: ['receptionist'] },
  ],
  VENUE: [
    { label: 'Floor Layout', icon: '⊡', path: '/floor-layout', roles: ['owner', 'manager'] },
    { label: 'Tables', icon: '⊟', path: '/tables', roles: ['owner', 'manager'] },
    { label: 'Branches', icon: '⌂', path: '/branches', roles: ['owner'] },
  ],
  MANAGEMENT: [
    { label: 'Brands', icon: '◈', path: '/brands', roles: ['owner'] },
    { label: 'Staff', icon: '👤', path: '/staff', roles: ['owner'] },
  ],
  ACCOUNT: [
    { label: 'Notifications', icon: '🔔', badgeKey: 'total', path: '/notifications', roles: ['owner', 'manager', 'receptionist'] },
    { label: 'Profile', icon: '👤', path: '/profile', roles: ['owner', 'manager', 'receptionist'] },
  ],
};

function formatBadge(count) {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : count;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const role = user?.role || 'manager';
  const { counts } = useNotifications();

  const handleSignOut = () => {
    AuthService.logout();
    navigate('/login');
  };

  const getBadgeCount = (badgeKey) => {
    if (!badgeKey) return null;
    return formatBadge(counts[badgeKey]);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.avatar}>OL</div>
        <span className={styles.brandName}>OLDINDAN</span>
      </div>

      <div className={styles.activeBranch}>
        <span className={styles.activeBranchLabel}>ACTIVE BRANCH</span>
        <span className={styles.activeBranchName}>
          {user?.branchId ? `Branch #${user.branchId}` : 'Partner workspace'}
        </span>
      </div>

      <nav className={styles.nav}>
        {Object.entries(navItems).map(([section, items]) => {
          const visibleItems = items.filter((item) => item.roles.includes(role));
          if (!visibleItems.length) return null;
          return (
            <div key={section} className={styles.navSection}>
              <span className={styles.sectionLabel}>{section}</span>
              {visibleItems.map((item) => {
                const badge = getBadgeCount(item.badgeKey);
                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                    }
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {badge && (
                      <span className={styles.badge}>{badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={styles.userFooter}>
        <div className={styles.userAvatar}>
          {(user?.name || 'P').slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user?.name || 'Partner'}</span>
          <span className={styles.userRole}>{role}</span>
        </div>
      </div>
      <button type="button" className={styles.signOut} onClick={handleSignOut}>Sign out</button>
    </aside>
  );
}
