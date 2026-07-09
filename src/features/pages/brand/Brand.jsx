import React from 'react';
import styles from './Brand.module.css';
import BTableCard from './components/TableCard';

export default function Brand() {
    return (
        <>
            <header className={styles.brandHeader}>
                <h1 className={styles.brandTitle}>Brands</h1>
                <div className={styles.bellIcon}>🔔</div>
            </header>
            <div className={styles.brandContainer}>
                <BTableCard />
            </div>
        </>
    );
}
