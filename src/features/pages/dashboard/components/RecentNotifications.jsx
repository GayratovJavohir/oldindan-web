import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../Dashboard.module.css';
import { useNotifications } from '../../../../context/NotificationContext';

const filters = ['All', 'Booking', 'Other'];

export default function RecentNotifications() {
  const { notifications, loading } = useNotifications();
  const [active, setActive] = useState('All');

  const recent = useMemo(() => {
    const list = active === 'All'
      ? notifications
      : notifications.filter((item) => item.category === active.toLowerCase());
    return list.slice(0, 5);
  }, [notifications, active]);

  return (
    <div className={styles.notificationsBlock}>
      <div className={styles.notificationsHeader}>
        <h2 className={styles.blockTitle}>Recent notifications</h2>
        <div className={styles.filterGroup}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.filterBtn} ${active === f ? styles.filterBtnActive : ''}`}
              onClick={() => setActive(f)}
            >
              {f}
            </button>
          ))}
          <Link to="/notifications" className={styles.viewAllLink}>View all</Link>
        </div>
      </div>
      <div className={styles.notificationList}>
        {loading && !recent.length ? (
          <div className={styles.notifEmpty}>Loading...</div>
        ) : recent.length === 0 ? (
          <div className={styles.notifEmpty}>No notifications yet.</div>
        ) : (
          recent.map((n) => (
            <div key={n.id} className={`${styles.notificationRow} ${!n.isRead ? styles.notificationRowUnread : ''}`}>
              <span className={styles.notifEmoji}>{n.icon}</span>
              <div className={styles.notifContent}>
                <span className={styles.notifTitle}>{n.title}</span>
                <span className={styles.notifDesc}>{n.description}</span>
              </div>
              <span className={styles.notifTime}>{n.timeAgo}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
