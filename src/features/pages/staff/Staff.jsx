import React from 'react';
import styles from './Staff.module.css';
import STableCard from './components/STableCard';

export default function Staff() {
    return (
        <>
            <header className={styles.staffHeader}>
                <h1 className={styles.staffTitle}>Staff</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.staffContainer}>
                <STableCard />
            </div>
        </>
    );
}
