import React from 'react'
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
    const user = getStoredUser();

    return (
        <>
            <PageHeader title="Profile" />
            <div className={styles.profileContainer}>
                <p className={styles.sectionSub} style={{ marginTop: 0 }}>
                    {subtitleForRole(user?.role)}
                </p>
                <ProfileCard />
            </div>
        </>
    )
}
