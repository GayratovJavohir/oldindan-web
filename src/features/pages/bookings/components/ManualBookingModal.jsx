import React from 'react';
import styles from '../Bookings.module.css';
import ManualBookingForm from './ManualBookingForm';

export default function ManualBookingModal({ onClose, onSuccess }) {
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>New Manual Booking</h2>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <ManualBookingForm onClose={onClose} onSuccess={onSuccess} submitLabel="Create Booking" />
            </div>
        </div>
    );
}