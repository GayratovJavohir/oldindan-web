import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Bookings.module.css'
import BookingsTable from './components/BookingsTable';

export default function Bookings() {
    const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.bookings')} />
      <div className={styles.bookingsContainer}>
        <BookingsTable />
      </div>
    </>
  )
}
