import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './ManualBookings.module.css'
import ManualBookingsTable from './components/ManualBookingsTable'

export default function ManualBookings() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.manualBookings')} />
            <div className={styles.manualContainer}>
                <ManualBookingsTable />
            </div>
        </>
    )
}
