import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../Notification.module.css';
import { useNotifications } from '../../../../context/NotificationContext';

const TYPE_FILTERS = [
    { value: 'all', label: 'All types' },
    { value: 'booking', label: 'Bookings' },
    { value: 'other', label: 'Other' },
];

const READ_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
];

export default function NotificationTable() {
    const { notifications, counts, loading, error, markRead, markAllRead } = useNotifications();
    const [typeFilter, setTypeFilter] = useState('all');
    const [readFilter, setReadFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const filtered = useMemo(() => notifications.filter((item) => {
        if (typeFilter !== 'all' && item.category !== typeFilter) return false;
        if (readFilter === 'unread' && item.isRead) return false;
        if (readFilter === 'read' && !item.isRead) return false;
        return true;
    }), [notifications, typeFilter, readFilter]);

    const handleMarkAll = async () => {
        setMarkingAll(true);
        try {
            await markAllRead();
        } finally {
            setMarkingAll(false);
        }
    };

    const handleMarkOne = async (item) => {
        if (item.isRead) return;
        setBusyId(item.id);
        try {
            await markRead(item.id);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className={styles.mainCard}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Notifications</h2>
                    <p className={styles.subtitle}>
                        {counts.total} unread · {counts.booking} booking · {counts.other} other
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.markAllBtn}
                    onClick={handleMarkAll}
                    disabled={markingAll || counts.total === 0}
                >
                    {markingAll ? 'Marking...' : 'Mark all read'}
                </button>
            </div>

            <div className={styles.filters}>
                <select
                    className={styles.selectInput}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    {TYPE_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    className={styles.selectInput}
                    value={readFilter}
                    onChange={(e) => setReadFilter(e.target.value)}
                >
                    {READ_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {loading && !notifications.length ? (
                <div className={styles.emptyState}>Loading notifications...</div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>No notifications found.</div>
            ) : (
                <div className={styles.notificationList}>
                    {filtered.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`${styles.notificationItem} ${!item.isRead ? styles.notificationUnread : ''}`}
                            onClick={() => handleMarkOne(item)}
                            disabled={busyId === item.id}
                        >
                            <div className={styles.itemHeader}>
                                <span className={styles.icon}>{item.icon}</span>
                                <span className={styles.itemTitle}>{item.title}</span>
                                {!item.isRead && <span className={styles.unreadDot} />}
                            </div>
                            <p className={styles.itemDescription}>{item.description}</p>
                            <div className={styles.itemFooter}>
                                <span className={styles.itemTime}>{item.timeAgo || '—'}</span>
                                <span className={styles.itemType}>{item.category}</span>
                                {item.bookingId && (
                                    <Link
                                        to="/bookings"
                                        className={styles.bookingLink}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Booking #{item.bookingId}
                                    </Link>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
