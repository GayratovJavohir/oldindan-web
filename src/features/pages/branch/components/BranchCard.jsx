import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../Branch.module.css';

export default function BranchCard({ branch, onEdit }) {
    const { id, name, status, location, phone, floors, tables, fee, hasDeposit, brandId } = branch;

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{name}</h3>
                <span className={`${styles.statusBadge} ${status === 'Active' ? styles.active : styles.inactive}`}>
                    <span className={styles.statusDot}>●</span> {status}
                </span>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                    <span className={styles.infoIcon}>📍</span>
                    <span className={styles.infoText}>{location}</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.infoIcon}>📞</span>
                    <span className={styles.infoText}>{phone}</span>
                </div>

                <div className={styles.badgeContainer}>
                    <div className={styles.miniBadge}>
                        <span className={styles.miniIcon}>🏢</span> {floors} {floors > 1 ? 'floors' : 'floor'}
                    </div>
                    <div className={styles.miniBadge}>
                        <span className={styles.miniIcon}>🪑</span> {tables} tables
                    </div>
                    <div className={styles.miniBadge}>
                        <span className={styles.miniIcon}>💰</span> {fee.toLocaleString()} UZS fee
                    </div>
                    {hasDeposit && (
                        <div className={`${styles.miniBadge} ${styles.depositBadge}`}>
                            <span className={styles.miniIcon}>🔒</span> Deposit
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.cardActions}>
                {onEdit && (
                    <button type="button" className={styles.actionBtn} onClick={onEdit}>Edit</button>
                )}
                <Link
                    to={`/floor-layout?branchId=${id}${brandId ? `&brandId=${brandId}` : ''}`}
                    className={styles.actionBtn}
                >
                    Layout
                </Link>
            </div>
        </div>
    );
}
