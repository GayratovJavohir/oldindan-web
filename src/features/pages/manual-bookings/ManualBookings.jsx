import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './ManualBookings.module.css'
import ManualBookingsTable from './components/ManualBookingsTable'

export default function ManualBookings() {
    return (
        <>
            <PageHeader title="Manual Booking" />
            <div className={styles.manualContainer}>
                <ManualBookingsTable />
            </div>
        </>
    )
}
