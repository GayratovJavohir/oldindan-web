import React from 'react';
import styles from '../Bookings.module.css';

export default function BookingRow({ booking, onStatusChange }) {
    const getStatusStyle = (status) => {
        switch (status) {
            case 'Confirmed': return styles.statusConfirmed;
            case 'Pending': return styles.statusPending;
            case 'Checked In': return styles.statusCheckedIn;
            case 'Completed': return styles.statusCompleted;
            case 'Canceled': return styles.statusCanceled;
            case 'No Show': return styles.statusNoShow;
            default: return '';
        }
    };

    const guestName = booking.guestName || booking.user_name || 'Guest';
    const branchName = booking.branch || booking.branch_name || 'Branch';
    const tableName = booking.table || booking.table_name || 'Table';
    const guestsCount = booking.guest_count || booking.guestsCount || 0;
    const sourceLabel = String(booking.source || '').toLowerCase() === 'manual' ? '💻 Manual' : '📱 App';
    const note = booking.special_request || booking.raw?.special_request || '';

    return (
        <tr>
            <td className={styles.idCol}>#{booking.id}</td>
            <td>
                <div className={styles.guestName}>{guestName}</div>
                <div className={styles.guestPhone}>{booking.phone}</div>
            </td>
            <td>
                <div className={styles.branchName}>{branchName}</div>
                <div className={styles.tableName}>{tableName}</div>
            </td>
            <td>
                <div className={styles.dateText}>{booking.date}</div>
                <div className={styles.timeText}>
                    {booking.time}{booking.endTime ? ` - ${booking.endTime}` : ''}
                </div>
            </td>
            <td className={styles.guestsCount}>{guestsCount}</td>
            <td>
                <span className={`${styles.statusBadge} ${getStatusStyle(booking.status)}`}>
                    {booking.status}
                </span>
            </td>
            <td>
                <span className={styles.sourceBadge}>{sourceLabel}</span>
            </td>
            <td>
                <div className={styles.actions}>
                    <button className={styles.viewBtn} type="button" title={note || 'No special request'}>
                        View
                    </button>
                    {booking.status === 'Pending' && (
                        <>
                            <button
                                type="button"
                                className={styles.confirmBtn}
                                onClick={() => onStatusChange(booking, 'confirm')}
                            >
                                Confirm
                            </button>
                            <button
                                type="button"
                                className={styles.cancelBtn}
                                onClick={() => onStatusChange(booking, 'cancel')}
                            >
                                Cancel
                            </button>
                        </>
                    )}
                    {booking.status === 'Confirmed' && (
                        <>
                            <button type="button" className={styles.confirmBtn} onClick={() => onStatusChange(booking, 'checkin')}>
                                Check In
                            </button>
                            <button type="button" className={styles.cancelBtn} onClick={() => onStatusChange(booking, 'cancel')}>
                                Cancel
                            </button>
                            <button type="button" className={styles.cancelBtn} onClick={() => onStatusChange(booking, 'no_show')}>
                                No Show
                            </button>
                        </>
                    )}
                    {booking.status === 'Checked In' && (
                        <button type="button" className={styles.confirmBtn} onClick={() => onStatusChange(booking, 'complete')}>
                            Complete
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}