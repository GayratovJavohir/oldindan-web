import React, { useState } from 'react'
import styles from '../Notification.module.css'

const initialNotifications = [
  { id: 1, icon: '🆕', title: 'New booking #7', description: 'Doniyor Kalandarov booked T1 for Jun 10 at 12:00', time: '5m ago' },
  { id: 2, icon: '🆕', title: 'New booking #8', description: 'Feruza Soliyeva booked T2 for Jun 10 at 13:00', time: '12m ago' },
  { id: 3, icon: '❌', title: 'Booking #5 canceled', description: 'Jasur Mirzayev canceled: Plans changed', time: '1h ago' },
  { id: 4, icon: '👻', title: 'No-show on booking #6', description: 'Shahlo Ergasheva did not arrive at 21:00', time: '2h ago' },
  { id: 5, icon: '✅', title: 'Booking #1 confirmed', description: 'T3 booking for Alisher Nazarov confirmed', time: '3h ago' },
  { id: 6, icon: '🎉', title: 'Booking #4 completed', description: 'Nilufar Rahimova — table cleared at 19:00', time: '4h ago' },
  { id: 7, icon: '⚙️', title: 'Layout updated', description: 'Floor 2 layout was updated by Alisher (manager)', time: '6h ago' }
]

export default function NotificationTable() {
  const [notifications, setNotifications] = useState(initialNotifications)

  return (
    <div className={styles.mainCard}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notifications</h2>
        <button className={styles.markAllBtn}>Mark all read</button>
      </div>

      <div className={styles.filters}>
        <select className={styles.selectInput}>
          <option>All types</option>
        </select>
        <select className={styles.selectInput}>
          <option>All</option>
        </select>
      </div>

      <div className={styles.notificationList}>
        {notifications.map((item) => (
          <div key={item.id} className={styles.notificationItem}>
            <div className={styles.itemHeader}>
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.itemTitle}>{item.title}</span>
            </div>
            <p className={styles.itemDescription}>{item.description}</p>
            <span className={styles.itemTime}>{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}