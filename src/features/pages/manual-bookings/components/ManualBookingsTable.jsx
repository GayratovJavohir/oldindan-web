import React from 'react';
import styles from '../../bookings/Bookings.module.css';
import ManualBookingForm from '../../bookings/components/ManualBookingForm';

export default function ManualBookingsTable() {
  return (
    <div className={styles.mainCard}>
      <div className={styles.header}>
        <h2 className={styles.title}>Create Manual Booking</h2>
      </div>
      <ManualBookingForm submitLabel="Create Booking" pageMode />
    </div>
  );
}