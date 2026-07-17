import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    countUnreadByCategory,
    getNotifications,
    getUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
} from '../services/notifications.services';
import i18n from '../i18n';

const NotificationContext = createContext(null);

function hasAuthToken() {
    return Boolean(localStorage.getItem('rp_access') || localStorage.getItem('token'));
}

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    const refresh = useCallback(async () => {
        if (!hasAuthToken()) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const [list, count] = await Promise.all([
                getNotifications(),
                getUnreadCount(),
            ]);
            setNotifications(list);
            setUnreadCount(count);
        } catch (err) {
            console.error('Notifications refresh error:', err);
            setError(err?.message || i18n.t('notifications.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 60000);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [refresh]);

    const counts = useMemo(() => {
        const fromList = countUnreadByCategory(notifications);
        const total = Math.max(unreadCount, fromList.total);
        return {
            total,
            booking: fromList.booking,
            other: fromList.other,
        };
    }, [notifications, unreadCount]);

    const markRead = useCallback(async (id) => {
        await markNotificationRead(id);
        setNotifications((prev) => prev.map((item) => (
            item.id === id ? { ...item, isRead: true } : item
        )));
        setUnreadCount((prev) => Math.max(0, prev - 1));
    }, []);

    const markAllRead = useCallback(async () => {
        await markAllNotificationsRead();
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
        setSuccessMessage(i18n.t('notifications.allRead'));
        window.setTimeout(() => setSuccessMessage(''), 3000);
    }, []);

    const value = useMemo(() => ({
        notifications,
        counts,
        loading,
        error,
        refresh,
        markRead,
        markAllRead,
        drawerOpen,
        openDrawer,
        closeDrawer,
        successMessage,
    }), [notifications, counts, loading, error, refresh, markRead, markAllRead, drawerOpen, openDrawer, closeDrawer, successMessage]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}
