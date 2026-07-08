import React from 'react'
import styles from './ManualBookings.module.css'
import ManualBookingsTable from './components/ManualBookingsTable'

export default function ManualBookings() {
    return (
        <>
            <header className={styles.manualHeader}>
                <h1 className={styles.manualTitle}>Manual Booking</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.manualContainer}>
                <ManualBookingsTable />
            </div>
        </>
    )
}
