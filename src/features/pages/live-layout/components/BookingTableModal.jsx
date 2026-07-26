import React, { useState } from 'react';
import styles from './BookingTableModal.module.css';

const STATUS_MAP = {
    pending: { label: 'Pending', color: '#f5a623' },
    confirmed: { label: 'Confirmed', color: '#4c8bf5' },
    checked_in: { label: 'Checked In', color: '#a463f2' },
    completed: { label: 'Completed', color: '#4ade80' },
    canceled: { label: 'Canceled', color: '#f87171' },
    no_show: { label: 'No Show', color: '#9ca3af' },
};

export default function BookingDetailsModal({ booking, table, onClose, onAction, loading = false }) {
    const [note, setNote] = useState('');

    if (!booking && !table) return null;

    const rawStatus = String(booking?.status || 'pending')
        .toLowerCase()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_');
    const statusInfo = STATUS_MAP[rawStatus] || STATUS_MAP.pending;

    const runAction = (type) => {
        if (loading) return;
        onAction(type, note.trim());
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2>Booking Details</h2>
                        <span className={styles.statusBadge} style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}1A` }}>
                            <span className={styles.dot} style={{ backgroundColor: statusInfo.color }}></span>
                            {statusInfo.label}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.grid}>
                    <div className={styles.gridItem}>
                        <label>GUEST</label>
                        <div className={styles.valueLarge}>{booking?.guestName || 'Walk-in Guest'}</div>
                        <div className={styles.valueSub}>{booking?.phone || '—'}</div>
                    </div>

                    <div className={styles.gridItem}>
                        <label>BOOKING WINDOW</label>
                        <div className={styles.valueLarge}>{booking?.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className={styles.valueSub}>{booking?.time || '—'} → {booking?.endTime || '—'}</div>
                    </div>

                    <div className={styles.gridItem}>
                        <label>LOCATION</label>
                        <div className={styles.valueLarge}>{table?.branchName || 'Branch'}</div>
                        <div className={styles.valueSub}>{table?.floorName || 'Floor'} • {table?.zoneName || 'Indoor'} • {table?.name}</div>
                    </div>

                    <div className={styles.gridItem}>
                        <label>PARTY SIZE</label>
                        <div className={styles.valueLarge}>{booking?.guest_count || 0} guests</div>
                        <div className={styles.valueSub}>{booking?.children_count || 0} children</div>
                    </div>
                </div>

                <div className={styles.section}>
                    <label>SPECIAL REQUEST</label>
                    <div className={styles.value}>{booking?.special_request || '—'}</div>
                </div>

                <div className={styles.section}>
                    <label>SOURCE</label>
                    <div className={styles.sourceBadge}>
                        📱 Booked via {booking?.source || 'App'}
                    </div>
                </div>

                <div className={styles.section}>
                    <label>ADD NOTE / STATUS UPDATE</label>
                    <input
                        type="text"
                        className={styles.noteInput}
                        placeholder="Optional note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div className={styles.actions}>
                    <button className={styles.btnDanger} disabled={loading} onClick={() => runAction('cancel')}>Cancel Booking</button>
                    <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('noshow')}>No Show</button>
                    <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('confirm')}>Confirm</button>
                    <button className={styles.btnPrimary} disabled={loading} onClick={() => runAction('checkin')}>{loading ? '...' : 'Check In'}</button>
                    <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('complete')}>Complete</button>
                </div>
            </div>
        </div>
    );
}