import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Notification.module.css'
import NoticationTable from './components/NotificationTable'
import {
    IoNotificationsOutline,
    IoCalendarOutline,
    IoInformationCircleOutline,
    IoTimeOutline,
    IoCheckmarkCircleOutline,
} from "react-icons/io5";

export default function Notification() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.notifications')} />
            <div className={styles.notificationContainer}>
                <NoticationTable />
            </div>
        </>
    )
}
