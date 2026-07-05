import React from 'react';
import styles from '../Dashboard.module.css';

export default function StatCard({ title, value, subtext, isPositive, icon, status }) {
    const valueClass = [
        styles.statValue,
        status === 'pending' ? styles.pendingText : '',
        isPositive === true ? styles.positive : '',
        isPositive === false ? styles.negative : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
                <span className={styles.statTitle}>{title}</span>
                {icon && <span className={styles.statIcon}>{icon}</span>}
            </div>
            <div className={valueClass}>{value}</div>
            <div className={`${styles.statSubtext} ${isPositive ? styles.positive : ''}`}>
                {subtext}
            </div>
        </div>
    );
}