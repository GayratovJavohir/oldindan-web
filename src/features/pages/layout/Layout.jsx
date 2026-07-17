import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Floor.module.css'
import LayoutFloor from './components/LayoutFloor'

export default function Layout() {
    const { t } = useTranslation();
    return (
        <>
            <PageHeader title={t('pages.floorLayout')} />
            <div className={styles.layoutContainer}>
                <LayoutFloor />
            </div>
        </>
    )
}
