import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './PageHeader.module.css';
import { useNotifications } from '../../context/NotificationContext';

export default function PageHeader({ title, actions = null }) {
    const { counts, openDrawer } = useNotifications();

    return (
        <header className={styles.header}>
            <div className={styles.headerLeft}>
                <h1 className={styles.title}>{title}</h1>
            </div>
            <div className={styles.headerRight}>
                {actions}
                <button
                    type="button"
                    className={styles.bellBtn}
                    onClick={openDrawer}
                    aria-label="Open notifications"
                >
                    <span className={styles.bellIcon}>🔔</span>
                    {counts.total > 0 && (
                        <span className={styles.bellBadge}>
                            {counts.total > 99 ? '99+' : counts.total}
                        </span>
                    )}
                </button>
            </div>
        </header>
    );
}

export function NotificationDrawer() {
    const {
        notifications,
        counts,
        loading,
        drawerOpen,
        closeDrawer,
        markRead,
        markAllRead,
        successMessage,
    } = useNotifications();
    const [markingAll, setMarkingAll] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        if (!drawerOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeDrawer();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [drawerOpen, closeDrawer]);

    if (!drawerOpen) return null;

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
        <>
            <button type="button" className={styles.backdrop} onClick={closeDrawer} aria-label="Close notifications" />
            <aside className={styles.drawer}>
                <div className={styles.drawerHeader}>
                    <div className={styles.drawerTitleRow}>
                        <h2>Notifications</h2>
                        {counts.total > 0 && (
                            <span className={styles.unreadPill}>{counts.total} unread</span>
                        )}
                    </div>
                    <div className={styles.drawerActions}>
                        <button
                            type="button"
                            className={styles.markAllBtn}
                            onClick={handleMarkAll}
                            disabled={markingAll || counts.total === 0}
                        >
                            {markingAll ? 'Marking...' : 'Mark all read'}
                        </button>
                        <button type="button" className={styles.closeBtn} onClick={closeDrawer} aria-label="Close">
                            ×
                        </button>
                    </div>
                </div>

                <div className={styles.drawerBody}>
                    {loading && !notifications.length ? (
                        <div className={styles.drawerEmpty}>Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                        <div className={styles.drawerEmpty}>No notifications yet.</div>
                    ) : (
                        notifications.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`${styles.drawerItem} ${!item.isRead ? styles.drawerItemUnread : ''}`}
                                onClick={() => handleMarkOne(item)}
                                disabled={busyId === item.id}
                            >
                                <div className={styles.drawerItemTop}>
                                    <span className={styles.drawerItemIcon}>{item.icon}</span>
                                    <span className={styles.drawerItemTitle}>{item.title}</span>
                                </div>
                                <p className={styles.drawerItemDesc}>{item.description}</p>
                                <span className={styles.drawerItemTime}>{item.timeAgo || '—'}</span>
                            </button>
                        ))
                    )}
                </div>

                <div className={styles.drawerFooter}>
                    <Link to="/notifications" className={styles.viewAllLink} onClick={closeDrawer}>
                        Open notifications page
                    </Link>
                </div>

                {successMessage && (
                    <div className={styles.successToast}>
                        <span>✓</span> {successMessage}
                    </div>
                )}
            </aside>
        </>
    );
}
