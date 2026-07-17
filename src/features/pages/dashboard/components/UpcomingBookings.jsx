import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from '../Dashboard.module.css';

function parseStart(booking) {
    const raw = booking.booking_start || '';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function statusClass(status) {
    const key = String(status || '').toLowerCase().replace(/\s+/g, '');
    if (key.includes('pending')) return styles.statusPending;
    if (key.includes('confirm')) return styles.statusConfirmed;
    if (key.includes('check')) return styles.statusCheckedIn;
    return styles.statusDefault;
}

export default function UpcomingBookings({ bookings = [] }) {
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
                <h3 className={styles.blockTitle}>Upcoming bookings</h3>
                <Link to="/bookings" className={styles.viewAllBtn}>View all</Link>
            </div>

            <div className={styles.bookingList}>
                {upcomingList.length === 0 ? (
                    <p className={styles.emptyText}>Yaqin orada booking yo‘q.</p>
                ) : (
                    upcomingList.map((booking) => (
                        <div key={booking.id} className={styles.bookingItem}>
                            <div className={styles.bookingTime}>
                                <strong>{booking.time || '--:--'}</strong>
                                <span>{booking.endTime || '—'}</span>
                            </div>

                            <div className={styles.bookingDetails}>
                                <strong>{booking.guestName || 'Guest'}</strong>
                                <span>
                                    {booking.guest_count || 0} guests
                                    {booking.bookingNumber ? ` · #${booking.bookingNumber}` : ''}
                                </span>
                            </div>

                            <div className={styles.bookingTableInfo}>
                                <strong>{booking.table || 'Table'}</strong>
                                <span>
                                    {[booking.branch, booking.floor].filter(Boolean).join(' · ') || '—'}
                                </span>
                            </div>

                            <div className={`${styles.statusBadge} ${statusClass(booking.status)}`}>
                                {booking.status}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
