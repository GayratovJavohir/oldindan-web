import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Notification.module.css';
import { useNotifications } from '../../../../context/NotificationContext';

export default function NotificationTable() {
    const { t } = useTranslation();
    const { notifications, counts, loading, error, markRead, markAllRead } = useNotifications();
    const [typeFilter, setTypeFilter] = useState('all');
    const [readFilter, setReadFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const typeFilters = [
        { value: 'all', label: t('notifications.allTypes') },
        { value: 'booking', label: t('notifications.bookingsType') },
        { value: 'other', label: t('notifications.otherType') },
    ];
    const readFilters = [
        { value: 'all', label: t('notifications.filterAll') },
        { value: 'unread', label: t('notifications.filterUnread') },
        { value: 'read', label: t('notifications.filterRead') },
    ];

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
                    <h2 className={styles.title}>{t('notifications.title')}</h2>
                    <p className={styles.subtitle}>
                        {t('notifications.subtitle', {
                            unread: counts.total,
                            booking: counts.booking,
                            other: counts.other,
                        })}
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.markAllBtn}
                    onClick={handleMarkAll}
                    disabled={markingAll || counts.total === 0}
                >
                    {markingAll ? t('notifications.marking') : t('notifications.markAllRead')}
                </button>
            </div>

            <div className={styles.filters}>
                <select
                    className={styles.selectInput}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    {typeFilters.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    className={styles.selectInput}
                    value={readFilter}
                    onChange={(e) => setReadFilter(e.target.value)}
                >
                    {readFilters.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {error && <div className={styles.errorText}>{error}</div>}

            <div className={styles.list}>
                {loading && !filtered.length ? (
                    <div className={styles.empty}>{t('notifications.loading')}</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>{t('notifications.notFound')}</div>
                ) : (
                    filtered.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`${styles.item} ${!item.isRead ? styles.itemUnread : ''}`}
                            onClick={() => handleMarkOne(item)}
                            disabled={busyId === item.id}
                        >
                            <span className={styles.itemIcon}>{item.icon}</span>
                            <div className={styles.itemBody}>
                                <strong>{item.title}</strong>
                                <span>{item.description}</span>
                                <span className={styles.itemTime}>{item.timeAgo || '—'}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
