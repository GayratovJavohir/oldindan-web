import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './PageHeader.module.css';
import { useNotifications } from '../../context/NotificationContext';
import { useLayout } from '../../context/LayoutContext';
import { setAppLanguage } from '../../i18n';

const LANGS = [
    { code: 'uz', label: 'UZ' },
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
];

export default function PageHeader({ title, actions = null }) {
    const { t, i18n } = useTranslation();
    const { counts, openDrawer } = useNotifications();
    const { toggleSidebar, isMobile } = useLayout();

    return (
        <header className={styles.header}>
            <div className={styles.headerLeft}>
                {isMobile && (
                    <button
                        type="button"
                        className={styles.menuBtn}
                        onClick={toggleSidebar}
                        aria-label={t('common.menu')}
                    >
                        ☰
                    </button>
                )}
                <h1 className={styles.title}>{title}</h1>
            </div>
            <div className={styles.headerRight}>
                <div className={styles.actionsSlot}>{actions}</div>
                <label className={styles.langWrap} title={t('common.language')}>
                    <select
                        className={styles.langSelect}
                        value={i18n.language?.slice(0, 2) || 'uz'}
                        onChange={(e) => setAppLanguage(e.target.value)}
                        aria-label={t('common.language')}
                    >
                        {LANGS.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    className={styles.bellBtn}
                    onClick={openDrawer}
                    aria-label={t('nav.notifications')}
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
    const { t } = useTranslation();
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
            <button type="button" className={styles.backdrop} onClick={closeDrawer} aria-label={t('common.close')} />
            <aside className={styles.drawer}>
                <div className={styles.drawerHeader}>
                    <div className={styles.drawerTitleRow}>
                        <h2>{t('notifications.title')}</h2>
                        {counts.total > 0 && (
                            <span className={styles.unreadPill}>{counts.total} {t('notifications.unread')}</span>
                        )}
                    </div>
                    <div className={styles.drawerActions}>
                        <button
                            type="button"
                            className={styles.markAllBtn}
                            onClick={handleMarkAll}
                            disabled={markingAll || counts.total === 0}
                        >
                            {markingAll ? t('notifications.marking') : t('notifications.markAllRead')}
                        </button>
                        <button type="button" className={styles.closeBtn} onClick={closeDrawer} aria-label={t('common.close')}>
                            ×
                        </button>
                    </div>
                </div>

                <div className={styles.drawerBody}>
                    {loading && !notifications.length ? (
                        <div className={styles.drawerEmpty}>{t('common.loading')}</div>
                    ) : notifications.length === 0 ? (
                        <div className={styles.drawerEmpty}>{t('notifications.empty')}</div>
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
                        {t('notifications.openPage')}
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
