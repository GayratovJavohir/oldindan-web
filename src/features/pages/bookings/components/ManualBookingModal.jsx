import React from 'react'
import styles from '../Bookings.module.css'

export default function ManualBookingModal({ onClose }) {
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>New Manual Booking</h2>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Guest user ID (optional)</label>
                            <input type="text" placeholder="Leave blank to use staff" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Branch *</label>
                            <select>
                                <option>KFC Almazor</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Floor *</label>
                            <select>
                                <option>Floor 1 — Main Hall</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Zone</label>
                            <select>
                                <option>None</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Table *</label>
                            <select>
                                <option>T1 — 4 seats</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Guest count *</label>
                            <input type="number" defaultValue={2} />
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Children</label>
                            <input type="number" defaultValue={0} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Start *</label>
                            <input type="text" placeholder="dd/mm/yyyy, --:--" />
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>End *</label>
                            <input type="text" placeholder="dd/mm/yyyy, --:--" />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Special request</label>
                        <textarea placeholder="Walk-in guest, birthday, allergy..." rows="4"></textarea>
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <button className={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
                    <button className={styles.modalSubmitBtn}>Create Booking</button>
                </div>
            </div>
        </div>
    )
}