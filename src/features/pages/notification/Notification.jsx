import React from 'react'
import styles from './Notification.module.css'
import NoticationTable from './components/NotificationTable'

export default function Notification() {
    return (
        <>
            <header className={styles.notificationHeader}>
                <h1 className={styles.notificationTitle}>Notifications</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.notificationContainer}>
                <NoticationTable />
            </div>
        </>
    )
}
