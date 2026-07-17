import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Bookings.module.css';
import ManualBookingForm from './ManualBookingForm';

export default function ManualBookingModal({ onClose, onSuccess, initialValues = null }) {
    const { t } = useTranslation();
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{t('bookings.newManual')}</h2>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <ManualBookingForm
                    onClose={onClose}
                    onSuccess={onSuccess}
                    submitLabel={t('bookings.createBooking')}
                    initialValues={initialValues}
                />
            </div>
        </div>
    );
}
