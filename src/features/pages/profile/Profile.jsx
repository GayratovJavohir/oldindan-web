import React from 'react'
import styles from './Profile.module.css'
import ProfileCard from './components/ProfileCard'

export default function Profile() {
    return (
        <>
            <header className={styles.profileHeader}>
                <h1 className={styles.profileTitle}>Profile</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.profileContainer}>
                <ProfileCard />
            </div>
        </>
    )
}
