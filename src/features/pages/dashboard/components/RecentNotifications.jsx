import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../Dashboard.module.css';
import { useNotifications } from '../../../../context/NotificationContext';

export default function RecentNotifications() {
  const { t } = useTranslation();
  const { notifications, loading } = useNotifications();
  const [active, setActive] = useState('all');

  const filters = [
    { value: 'all', label: t('common.all') },
    { value: 'booking', label: t('notifications.bookingsType') },
    { value: 'other', label: t('notifications.otherType') },
  ];

  const recent = useMemo(() => {
    const list = active === 'all'
      ? notifications
      : notifications.filter((item) => item.category === active);
    return list.slice(0, 5);
  }, [notifications, active]);

  return (
    <div className={styles.notificationsBlock}>
      <div className={styles.notificationsHeader}>
        <h2 className={styles.blockTitle}>{t('dashboard.recentNotifications')}</h2>
        <div className={styles.filterGroup}>
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filterBtn} ${active === f.value ? styles.filterBtnActive : ''}`}
              onClick={() => setActive(f.value)}
            >
              {f.label}
            </button>
          ))}
          <Link to="/notifications" className={styles.viewAllLink}>{t('common.viewAll')}</Link>
        </div>
      </div>
      <div className={styles.notificationList}>
        {loading && !recent.length ? (
          <div className={styles.notifEmpty}>{t('common.loading')}</div>
        ) : recent.length === 0 ? (
          <div className={styles.notifEmpty}>{t('notifications.empty')}</div>
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
