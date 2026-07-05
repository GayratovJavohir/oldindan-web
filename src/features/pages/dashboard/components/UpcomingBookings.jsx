import React from 'react';
import styles from '../Dashboard.module.css';
export default function UpcomingBookings({ bookings = [] }) {

  const upcomingList = bookings
    .filter(b => b.status?.toLowerCase() !== 'canceled' && b.status?.toLowerCase() !== 'no_show')
    .slice(0, 4);

  return (
    <div className={styles.bookingBlock}>
      <div className={styles.blockHeader}>
        <h3>Upcoming bookings</h3>
        <button className={styles.viewAllBtn}>View all</button>
      </div>

      <div className="bookingRow"></div>
      <div className={styles.bookingList}>
        {upcomingList.length === 0 ? (
          <p className={styles.emptyText}>Bugun uchun kelayotgan buyurtmalar yo'q.</p>
        ) : (
          upcomingList.map((booking) => {
            const startTime = booking.booking_start ? booking.booking_start.split(' ')[1]?.substring(0, 5) : '--:--';
            const endTime = booking.booking_end ? booking.booking_end.split(' ')[1]?.substring(0, 5) : '--:--';

            return (
              <div key={booking.id} className={styles.bookingItem}>
                <div className={styles.bookingTime}>
                  <strong>{startTime}</strong>
                  <span>{endTime}</span>
                </div>

                <div className={styles.bookingDetails}>
                  <strong>{booking.owner_name || booking.user?.full_name || 'Mijoz'}</strong>
                  <span>{booking.guests_count || 0} guests • {booking.is_vip ? 'VIP' : 'Indoor'}</span>
                </div>

                <div className={styles.bookingTableInfo}>
                  <strong>{booking.table_name || `Table ${booking.table}`}</strong>
                  <span>Floor 1</span>
                </div>

                <div className={`${styles.statusBadge} ${styles[booking.status?.toLowerCase()]}`}>
                  • {booking.status}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}