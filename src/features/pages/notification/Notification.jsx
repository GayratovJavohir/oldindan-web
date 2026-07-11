import React from 'react'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Notification.module.css'
import NoticationTable from './components/NotificationTable'

export default function Notification() {
    return (
        <>
            <PageHeader title="Notifications" />
            <div className={styles.notificationContainer}>
                <NoticationTable />
            </div>
        </>
    )
}
