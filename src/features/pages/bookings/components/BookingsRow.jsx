import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Bookings.module.css';
import { translateStatus } from '../../../../utils/statusI18n';

export default function BookingRow({ booking, onStatusChange }) {
    const { t } = useTranslation();
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

    const guestName = booking.guestName || booking.user_name || t('bookings.guest');
    const branchName = booking.branch || booking.branch_name || t('common.branch');
    const tableName = booking.table || booking.table_name || t('common.table');
    const guestsCount = booking.guest_count || booking.guestsCount || 0;
    const sourceLabel = String(booking.source || '').toLowerCase().includes('manual')
        ? t('bookings.sourceManual')
        : t('bookings.sourceApp');
    const note = booking.special_request || booking.raw?.special_request || '';

    return (
        <tr>
            <td className={styles.idCol}>
                <div className={styles.guestName}>#{booking.bookingNumber || booking.id}</div>
                {!booking.bookingNumber && <div className={styles.guestPhone}>id {booking.id}</div>}
            </td>
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
                    {translateStatus(t, booking.status)}
                </span>
            </td>
            <td>
                <span className={styles.sourceBadge}>{sourceLabel}</span>
            </td>
            <td>
                <div className={styles.actions}>
                    <button className={styles.viewBtn} type="button" title={note || '—'}>
                        {t('bookings.view')}
                    </button>
                    {booking.status === 'Pending' && (
                        <>
                            <button type="button" className={styles.confirmBtn} onClick={() => onStatusChange(booking, 'confirm')}>
                                {t('bookings.confirm')}
                            </button>
                            <button type="button" className={styles.cancelBtn} onClick={() => onStatusChange(booking, 'cancel')}>
                                {t('bookings.cancel')}
                            </button>
                        </>
                    )}
                    {booking.status === 'Confirmed' && (
                        <>
                            <button type="button" className={styles.confirmBtn} onClick={() => onStatusChange(booking, 'checkin')}>
                                {t('bookings.checkIn')}
                            </button>
                            <button type="button" className={styles.cancelBtn} onClick={() => onStatusChange(booking, 'cancel')}>
                                {t('bookings.cancel')}
                            </button>
                            <button type="button" className={styles.cancelBtn} onClick={() => onStatusChange(booking, 'no_show')}>
                                {t('bookings.noShow')}
                            </button>
                        </>
                    )}
                    {booking.status === 'Checked In' && (
                        <button type="button" className={styles.confirmBtn} onClick={() => onStatusChange(booking, 'complete')}>
                            {t('bookings.complete')}
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
