import React from 'react'
import styles from './LiveLayout.module.css'
import LiveFloor from './components/LiveFloor'

export default function LiveLayout() {
    return (
        <>
            <header className={styles.liveLayoutHeader}>
                <h1 className={styles.liveLayoutTitle}>Live View</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.liveLayoutContainer}>
                <LiveFloor />
            </div>
        </>
    )
}
