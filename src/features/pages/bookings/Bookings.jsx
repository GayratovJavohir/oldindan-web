import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Bookings.module.css'
import BookingsTable from './components/BookingsTable';

export default function Bookings() {
  return (
    <>
      <PageHeader title="All Bookings" />
      <div className={styles.bookingsContainer}>
        <BookingsTable />
      </div>
    </>
  )
}
