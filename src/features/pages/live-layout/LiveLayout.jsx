import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './LiveLayout.module.css'
import LiveFloor from './components/LiveFloor'

export default function LiveLayout() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.liveView')} />
            <div className={styles.liveLayoutContainer}>
                <LiveFloor />
            </div>
        </>
    )
}
