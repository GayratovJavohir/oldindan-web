import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const navItems = {
  OVERVIEW: [
    { label: 'Dashboard', icon: '⊞', path: '/dashboard' },
  ],
  BOOKINGS: [
    { label: 'All Bookings', icon: '☰', badge: 12, path: '/bookings' },
    { label: 'Live View', icon: '◷', path: '/live-view' },
    { label: 'Manual Booking', icon: '+', path: '/manual-booking' },
  ],
  VENUE: [
    { label: 'Floor Layout', icon: '⊡', path: '/floor-layout' },
    { label: 'Tables', icon: '⊟', path: '/tables' },
    { label: 'Branches', icon: '⌂', path: '/branches' },
  ],
  MANAGEMENT: [
    { label: 'Brands', icon: '◈', path: '/brands' },
    { label: 'Staff', icon: '👤', path: '/staff' },
  ],
  ACCOUNT: [
    { label: 'Notifications', icon: '🔔', path: '/notifications' },
    { label: 'Profile', icon: '👤', path: '/profile' },
  ],
};

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.avatar}>OL</div>
        <span className={styles.brandName}>OLDINDAN</span>
      </div>

      <div className={styles.activeBranch}>
        <span className={styles.activeBranchLabel}>ACTIVE BRANCH</span>
        <span className={styles.activeBranchName}>KFC Almazor</span>
      </div>

      <nav className={styles.nav}>
        {Object.entries(navItems).map(([section, items]) => (
          <div key={section} className={styles.navSection}>
            <span className={styles.sectionLabel}>{section}</span>
            {items.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && (
                  <span className={styles.badge}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.userFooter}>
        <div className={styles.userAvatar}>FK</div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>Firdavs Karimov</span>
          <span className={styles.userRole}>Owner</span>
        </div>
      </div>
      <button className={styles.signOut}>Sign out</button>
    </aside>
  );
}