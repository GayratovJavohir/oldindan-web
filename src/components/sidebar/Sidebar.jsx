import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Sidebar.module.css';
import AuthService from '../../services/auth.services';
import { getStoredUser } from '../../utils/authUser';
import { useNotifications } from '../../context/NotificationContext';
import { useLayout } from '../../context/LayoutContext';
import {
  IoGridOutline,
  IoListOutline,
  IoPulseOutline,
  IoAddCircleOutline,
  IoMapOutline,
  IoRestaurantOutline,
  IoBusinessOutline,
  IoDiamondOutline,
  IoPeopleOutline,
  IoNotificationsOutline,
  IoPersonCircleOutline,
  IoLogOutOutline,
} from "react-icons/io5";

const navItems = {
  overview: [
    { labelKey: 'nav.dashboard', icon: <IoGridOutline />, path: '/dashboard', roles: ['owner', 'manager'] },
  ],
  bookings: [
    { labelKey: 'nav.allBookings', icon: <IoListOutline />, badgeKey: 'booking', path: '/bookings', roles: ['owner', 'manager', 'receptionist'] },
    { labelKey: 'nav.liveView', icon: <IoPulseOutline />, path: '/live-view', roles: ['owner', 'manager', 'receptionist'] },
    { labelKey: 'nav.manualBooking', icon: <IoAddCircleOutline />, path: '/manual-bookings', roles: ['receptionist'] },
  ],
  venue: [
    { labelKey: 'nav.floorLayout', icon: <IoMapOutline />, path: '/floor-layout', roles: ['owner', 'manager'] },
    { labelKey: 'nav.branches', icon: <IoBusinessOutline />, path: '/branches', roles: ['owner'] },
  ],
  management: [
    { labelKey: 'nav.brands', icon: <IoDiamondOutline />, path: '/brands', roles: ['owner'] },
    { labelKey: 'nav.staff', icon: <IoPeopleOutline />, path: '/staff', roles: ['owner'] },
  ],
  account: [
    { labelKey: 'nav.notifications', icon: <IoNotificationsOutline />, badgeKey: 'total', path: '/notifications', roles: ['owner', 'manager', 'receptionist'] },
    { labelKey: 'nav.profile', icon: <IoPersonCircleOutline />, path: '/profile', roles: ['owner', 'manager', 'receptionist'] },
  ],
};

function formatBadge(count) {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : count;
}

export default function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const role = user?.role || 'manager';
  const { counts } = useNotifications();
  const { sidebarOpen, closeSidebar, isMobile } = useLayout();

  const handleSignOut = () => {
    AuthService.logout();
    navigate('/login');
  };

  const getBadgeCount = (badgeKey) => {
    if (!badgeKey) return null;
    return formatBadge(counts[badgeKey]);
  };

  return (
    <>
      {isMobile && sidebarOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t('common.close')}
          onClick={closeSidebar}
        />
      )}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.avatar}>OL</div>
          <span className={styles.brandName}>OLDINDAN</span>
          {isMobile && (
            <button type="button" className={styles.closeMobile} onClick={closeSidebar} aria-label={t('common.close')}>
              ×
            </button>
          )}
        </div>

        <div className={styles.activeBranch}>
          <span className={styles.activeBranchLabel}>{t('nav.activeBranch')}</span>
          <span className={styles.activeBranchName}>
            {user?.branchId ? `${t('common.branch')} #${user.branchId}` : t('nav.partnerWorkspace')}
          </span>
        </div>

        <nav className={styles.nav}>
          {Object.entries(navItems).map(([section, items]) => {
            const visibleItems = items.filter((item) => item.roles.includes(role));
            if (!visibleItems.length) return null;
            return (
              <div key={section} className={styles.navSection}>
                <span className={styles.sectionLabel}>{t(`nav.${section}`)}</span>
                {visibleItems.map((item) => {
                  const badge = getBadgeCount(item.badgeKey);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebar}
                      className={({ isActive }) =>
                        `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                      }
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navLabel}>{t(item.labelKey)}</span>
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
            <span className={styles.userRole}>{t(`roles.${role}`, { defaultValue: role })}</span>
          </div>
        </div>
        <button type="button" className={styles.signOut} onClick={handleSignOut}>
          {t('nav.signOut')}
        </button>
      </aside>
    </>
  );
}
