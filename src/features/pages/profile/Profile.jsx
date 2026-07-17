import React from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/header/PageHeader'
import styles from './Profile.module.css'
import ProfileCard from './components/ProfileCard'
import { getStoredUser } from '../../../utils/authUser'

function subtitleForRole(role) {
    if (role === 'owner') return 'Manage your account and organization analytics';
    if (role === 'manager') return 'Your account and branch performance';
    return 'Your account and daily branch stats';
}

export default function Profile() {
    const { t } = useTranslation();
    const user = getStoredUser();

    return (
        <>
            <PageHeader title={t('pages.profile')} />
            <div className={styles.profileContainer}>
                <p className={styles.sectionSub} style={{ marginTop: 0 }}>
                    {subtitleForRole(user?.role)}
                </p>
                <ProfileCard />
            </div>
        </>
    )
}
