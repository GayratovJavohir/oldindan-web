import React from 'react'
import styles from './Bookings.module.css'
import BookingsTable from './components/BookingsTable';

export default function Bookings() {
  return (
    <>
      <header className={styles.bookingsHeader}>
        <h1 className={styles.bookingsTitle}>All Bookings</h1>
        <div className={styles.bellIcon}>🔔</div>
      </header>
      <div className={styles.bookingsContainer}>
        <BookingsTable />
      </div>
    </>
  )
}
