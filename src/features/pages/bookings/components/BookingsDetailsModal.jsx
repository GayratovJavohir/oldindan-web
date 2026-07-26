import styles from '../Bookings.module.css';

export default function BookingDetailsModal({ booking, onClose }) {
    if (!booking) return null;

    return (
        <div className={styles.viewModalOverlay} onClick={onClose}>
            <div className={styles.viewModalBox} onClick={(e) => e.stopPropagation()}>
                <div className={styles.viewModalHeader}>
                    <div className={styles.viewModalTitleGroup}>
                        <h2>Booking Details</h2>
                        {booking.status && (
                            <span className={`${styles.viewModalStatusBadge} ${styles['status_' + booking.status.toLowerCase()] || ''}`}>
                                • {booking.status}
                            </span>
                        )}
                    </div>
                    <button className={styles.viewModalCloseBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.viewModalBody}>
                    <div className={styles.viewModalGridRow}>
                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>GUEST</span>
                            <div className={styles.viewModalPrimaryText}>{booking.guestName}</div>
                            <div className={styles.viewModalSecondaryText}>{booking.phone}</div>
                        </div>

                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>BOOKING WINDOW</span>
                            <div className={styles.viewModalPrimaryText}>{booking.date}</div>
                            <div className={styles.viewModalSecondaryText}>
                                {booking.time} {booking.endTime ? `→ ${booking.endTime}` : ''}
                            </div>
                        </div>
                    </div>

                    <div className={styles.viewModalGridRow}>
                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>LOCATION</span>
                            <div className={styles.viewModalPrimaryText}>{booking.branch}</div>
                            <div className={styles.viewModalSecondaryText}>
                                {booking.floor || 'Floor 1'} • {booking.zone || 'Indoor'} • {booking.table}
                            </div>
                        </div>

                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>PARTY SIZE</span>
                            <div className={styles.viewModalPrimaryText}>{booking.guest_count} guests</div>
                            {booking.children && (
                                <div className={styles.viewModalSecondaryText}>{booking.children} children</div>
                            )}
                        </div>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>SPECIAL REQUEST</span>
                        <div className={styles.viewModalRequestText}>
                            {booking.special_request || 'No special request'}
                        </div>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>SOURCE</span>
                        <div>
                            <span className={styles.viewModalSourceBadge}>
                                📱 {booking.source || 'Booked via App'}
                            </span>
                        </div>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>ADD NOTE / STATUS UPDATE</span>
                        <input
                            type="text"
                            placeholder="Optional note..."
                            className={styles.viewModalNoteInput}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}