import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Notification.module.css'
import NotificationTable from './components/NotificationTable'

export default function Notification() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.notifications')} />
            <div className={styles.notificationContainer}>
                <NotificationTable />
            </div>
        </>
    )
}
