import React, { useState } from 'react';
import styles from '../Dashboard.module.css';

const notifications = [
  { id: 1, emoji: '📋', title: 'New booking #7', desc: 'Doniyor Kalandarov booked T1 for Jun 10 at 12:00', time: '5m ago', type: 'new' },
  { id: 2, emoji: '📋', title: 'New booking #8', desc: 'Feruza Soliyeva booked T2 for Jun 10 at 13:00', time: '12m ago', type: 'new' },
  { id: 3, emoji: '❌', title: 'Booking #5 canceled', desc: 'Jasur Mirzayev canceled: Plans changed', time: '1h ago', type: 'canceled' },
];

const filters = ['All', 'New', 'Canceled'];

export default function RecentNotifications() {
  const [active, setActive] = useState('All');

  const filtered = active === 'All'
    ? notifications
    : notifications.filter((n) => n.type === active.toLowerCase());

  return (
    <div className={styles.notificationsBlock}>
      <div className={styles.notificationsHeader}>
        <h2 className={styles.blockTitle}>Recent notifications</h2>
        <div className={styles.filterGroup}>
          {filters.map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${active === f ? styles.filterBtnActive : ''}`}
              onClick={() => setActive(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.notificationList}>
        {filtered.map((n) => (
          <div key={n.id} className={styles.notificationRow}>
            <span className={styles.notifEmoji}>{n.emoji}</span>
            <div className={styles.notifContent}>
              <span className={styles.notifTitle}>{n.title}</span>
              <span className={styles.notifDesc}>{n.desc}</span>
            </div>
            <span className={styles.notifTime}>{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}