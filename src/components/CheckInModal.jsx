import React, { useState } from 'react';
import styles from '../features/pages/bookings/Bookings.module.css';
import BrandBranchSelect from './BrandBranchSelect';
import { checkInByNumber } from '../services/bookings.services';
import { getApiError } from '../utils/apiHelpers';
import { getStoredUser } from '../utils/authUser';

export default function CheckInModal({
    branchId: initialBranchId = null,
    bookingNumber: initialNumber = '',
    guestHint = '',
    onClose,
    onSuccess,
}) {
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';
    const [bookingNumber, setBookingNumber] = useState(String(initialNumber || '').toUpperCase());
    const [branchId, setBranchId] = useState(
        initialBranchId ? String(initialBranchId) : assignedBranchId
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        const code = bookingNumber.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            setError('6 belgilik booking kodini kiriting (masalan A3X9K2).');
            return;
        }
        const bid = branchId || assignedBranchId || initialBranchId;
        if (!bid) {
            setError('Check-in uchun branch tanlang.');
            return;
        }

        setBusy(true);
        setError('');
        setResult(null);
        try {
            const data = await checkInByNumber({
                booking_number: code,
                branch_id: Number(bid),
            });
            setResult(data);
            onSuccess?.(data);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modalContent} style={{ maxWidth: 440 }}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Check In</h2>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {guestHint && (
                            <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>
                                Guest: {guestHint}
                            </p>
                        )}
                        <div className={styles.formGroup}>
                            <label>Booking code (6 belgi) *</label>
                            <input
                                value={bookingNumber}
                                onChange={(e) => setBookingNumber(
                                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                                )}
                                placeholder="A3X9K2"
                                maxLength={6}
                                autoFocus
                                style={{
                                    letterSpacing: '0.25em',
                                    fontWeight: 700,
                                    fontSize: 20,
                                    textAlign: 'center',
                                }}
                                required
                            />
                        </div>
                        {isOwner && !assignedBranchId && (
                            <div className={styles.formGroup}>
                                <label>Brand / Branch *</label>
                                <BrandBranchSelect
                                    branchId={branchId}
                                    onBranchChange={setBranchId}
                                    fieldClassName={styles.formGroup}
                                />
                            </div>
                        )}
                        {error && <div style={{ color: '#cf222e', fontSize: 14 }}>{error}</div>}
                        {result && (
                            <div style={{ color: '#7dcea0', fontSize: 14 }}>
                                ✓ {result.detail || 'Checked in'}
                                {result.guest ? ` — ${result.guest}` : ''}
                                {result.table ? ` · ${result.table}` : ''}
                            </div>
                        )}
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.modalCancelBtn} onClick={onClose}>
                            {result ? 'Close' : 'Cancel'}
                        </button>
                        {!result && (
                            <button type="submit" className={styles.modalSubmitBtn} disabled={busy}>
                                {busy ? 'Checking in...' : 'Check In'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
