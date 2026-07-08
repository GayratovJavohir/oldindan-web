import React from 'react'
import styles from './Floor.module.css'
import LayoutFloor from './components/LayoutFloor'

export default function Layout() {
    return (
        <>
            <header className={styles.layoutHeader}>
                <h1 className={styles.layoutTitle}>Live View</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.layoutContainer}>
                <LayoutFloor />
            </div>
        </>
    )
}
