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

const AVAILABLE_STATUS = { label: 'Available', color: '#4ade80' };

function formatDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * `booking` is null/undefined whenever the selected table has no active
 * booking right now (available table) — this is a normal, expected state,
 * not missing data. `table` always describes the physical table itself
 * (name, seats, zone) and should be shown regardless of booking status.
 */
export default function BookingDetailsModal({
    booking,
    table,
    onClose,
    onAction,
    onCreateBooking,
    loading = false,
}) {
    const [note, setNote] = useState('');

    if (!booking && !table) return null;

    const isEmpty = !booking;

    const rawStatus = String(booking?.status || '')
        .toLowerCase()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_');
    const statusInfo = isEmpty ? AVAILABLE_STATUS : (STATUS_MAP[rawStatus] || STATUS_MAP.pending);

    const runAction = (type) => {
        if (loading || isEmpty) return;
        onAction(type, note.trim());
    };

    const bookingDate = formatDate(booking?.date);

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2>{isEmpty ? 'Stol ma\u02bblumoti' : 'Booking Details'}</h2>
                        <span
                            className={styles.statusBadge}
                            style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}1A` }}
                        >
                            <span className={styles.dot} style={{ backgroundColor: statusInfo.color }} />
                            {statusInfo.label}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.grid}>
                    <div className={styles.gridItem}>
                        <label>STOL</label>
                        <div className={styles.valueLarge}>{table?.name || '—'}</div>
                        <div className={styles.valueSub}>
                            {table?.seats ? `${table.seats} o'rin` : '—'}
                        </div>
                    </div>

                    <div className={styles.gridItem}>
                        <label>JOYLASHUV</label>
                        <div className={styles.valueLarge}>{table?.branchName || 'Branch'}</div>
                        <div className={styles.valueSub}>
                            {table?.floorName || 'Floor'} • {table?.zoneName || 'Indoor'}
                        </div>
                    </div>

                    {isEmpty ? (
                        <div className={styles.gridItem} style={{ gridColumn: '1 / -1' }}>
                            <label>HOLATI</label>
                            <div className={styles.valueLarge} style={{ color: '#4ade80' }}>
                                Bu stol hozircha bo'sh
                            </div>
                            <div className={styles.valueSub}>
                                Ushbu vaqt oralig'ida faol bron mavjud emas.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className={styles.gridItem}>
                                <label>GUEST</label>
                                <div className={styles.valueLarge}>{booking?.guestName || 'Walk-in Guest'}</div>
                                <div className={styles.valueSub}>{booking?.phone || '—'}</div>
                            </div>

                            <div className={styles.gridItem}>
                                <label>BOOKING WINDOW</label>
                                <div className={styles.valueLarge}>{bookingDate || '—'}</div>
                                <div className={styles.valueSub}>
                                    {booking?.time || '—'} → {booking?.endTime || '—'}
                                </div>
                            </div>

                            <div className={styles.gridItem}>
                                <label>PARTY SIZE</label>
                                <div className={styles.valueLarge}>{booking?.guest_count ?? 0} guests</div>
                                <div className={styles.valueSub}>{booking?.children_count ?? 0} children</div>
                            </div>
                        </>
                    )}
                </div>

                {!isEmpty && (
                    <>
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
                    </>
                )}

                {isEmpty ? (
                    <div className={styles.actions}>
                        <button className={styles.btnSecondary} onClick={onClose}>
                            Yopish
                        </button>
                        {onCreateBooking && (
                            <button
                                className={styles.btnPrimary}
                                onClick={() => onCreateBooking(table)}
                            >
                                Bron qilish
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={styles.actions}>
                        <button className={styles.btnDanger} disabled={loading} onClick={() => runAction('cancel')}>Cancel Booking</button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('noshow')}>No Show</button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('confirm')}>Confirm</button>
                        <button className={styles.btnPrimary} disabled={loading} onClick={() => runAction('checkin')}>{loading ? '...' : 'Check In'}</button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('complete')}>Complete</button>
                    </div>
                )}
            </div>
        </div>
    );
}