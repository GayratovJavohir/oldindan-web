import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../bookings/Bookings.module.css';
import ManualBookingForm from '../../bookings/components/ManualBookingForm';

// FIX: the heading and the submit label were hard-coded English, and the
// `pageMode` prop did not exist on ManualBookingForm (silently ignored).
export default function ManualBookingsTable() {
  const { t } = useTranslation();

  return (
    <div className={styles.mainCard}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('bookings.createManual')}</h2>
      </div>
      <ManualBookingForm submitLabel={t('bookings.createBooking')} />
    </div>
  );
}