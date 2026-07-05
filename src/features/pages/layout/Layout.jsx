import React from 'react'
import styles from './Floor.module.css'
import LiveFloor from './components/LiveFloor'

export default function Layout() {
    return (
        <>
            <header className={styles.layoutHeader}>
                <h1 className={styles.layoutTitle}>Live View</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.layoutContainer}>
                <LiveFloor />
            </div>
        </>
    )
}
