import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Profile.module.css'
import ProfileCard from './components/ProfileCard'

// FIX: `subtitleForRole()` and the `user` constant were dead code (the
// subtitle was never rendered), and both tripped no-unused-vars. The role
// hints they duplicated already live in i18n as profile.ownerHint /
// profile.managerHint / profile.staffHint and are used by ProfileAnalytics.
export default function Profile() {
    const { t } = useTranslation();

    return (
        <>
            <PageHeader title={t('pages.profile')} />
            <div className={styles.profileContainer}>
                <ProfileCard />
            </div>
        </>
    )
}
