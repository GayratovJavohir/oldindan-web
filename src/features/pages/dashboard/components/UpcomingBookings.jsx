import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../Dashboard.module.css';

function parseStart(booking) {
    const raw = booking.booking_start || '';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function statusClass(status, stylesMap) {
    const key = String(status || '').toLowerCase().replace(/\s+/g, '');
    if (key.includes('pending')) return stylesMap.statusPending;
    if (key.includes('confirm')) return stylesMap.statusConfirmed;
    if (key.includes('check')) return stylesMap.statusCheckedIn;
    return stylesMap.statusDefault;
}

export default function UpcomingBookings({ bookings = [] }) {
    const { t } = useTranslation();

    const upcomingList = useMemo(() => {
        const now = Date.now();
        const active = new Set(['Pending', 'Confirmed', 'Checked In']);

        return [...bookings]
            .filter((b) => active.has(b.status))
            .map((b) => ({ booking: b, start: parseStart(b) }))
            .filter(({ start }) => start && start.getTime() >= now - 60 * 60 * 1000)
            .sort((a, b) => a.start - b.start)
            .slice(0, 6)
            .map(({ booking }) => booking);
    }, [bookings]);

    return (
        <div className={styles.bookingBlock}>
            <div className={styles.blockHeader}>
                <h3 className={styles.blockTitle}>{t('dashboard.upcoming')}</h3>
                <Link to="/bookings" className={styles.viewAllBtn}>{t('common.viewAll')}</Link>
            </div>

            <div className={styles.bookingList}>
                {upcomingList.length === 0 ? (
                    <p className={styles.emptyText}>{t('dashboard.noUpcoming')}</p>
                ) : (
                    upcomingList.map((booking) => (
                        <div key={booking.id} className={styles.bookingItem}>
                            <div className={styles.bookingTime}>
                                <strong>{booking.time || '--:--'}</strong>
                                <span>{booking.endTime || '—'}</span>
                            </div>

                            <div className={styles.bookingDetails}>
                                <strong>{booking.guestName || t('bookings.guest')}</strong>
                                <span>
                                    {booking.guest_count || 0} {t('common.guests')}
                                    {booking.bookingNumber ? ` · #${booking.bookingNumber}` : ''}
                                </span>
                            </div>

                            <div className={styles.bookingTableInfo}>
                                <strong>{booking.table || t('common.table')}</strong>
                                <span>
                                    {[booking.branch, booking.floor].filter(Boolean).join(' · ') || '—'}
                                </span>
                            </div>

                            <div className={`${styles.statusBadge} ${statusClass(booking.status, styles)}`}>
                                {booking.status}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
