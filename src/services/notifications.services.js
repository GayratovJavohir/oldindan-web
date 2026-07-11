import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';

const BOOKING_KEYWORDS = [
    'booking',
    'reservation',
    'no_show',
    'no-show',
    'check_in',
    'check-in',
    'manual_booking',
];

export function formatTimeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toISOString().slice(0, 10);
}

export function classifyNotificationCategory(type, title = '', message = '', bookingId = null) {
    if (bookingId) return 'booking';
    const combined = `${type} ${title} ${message}`.toLowerCase();
    if (BOOKING_KEYWORDS.some((keyword) => combined.includes(keyword))) return 'booking';
    return 'other';
}

export function pickNotificationIcon(type = '', title = '') {
    const text = `${type} ${title}`.toLowerCase();
    if (text.includes('new') || text.includes('created')) return '🆕';
    if (text.includes('cancel')) return '❌';
    if (text.includes('no_show') || text.includes('no-show') || text.includes('no show')) return '👻';
    if (text.includes('confirm')) return '✅';
    if (text.includes('complete')) return '🎉';
    if (text.includes('check')) return '📥';
    if (text.includes('layout') || text.includes('table') || text.includes('floor')) return '⚙️';
    if (text.includes('staff') || text.includes('user')) return '👤';
    return '🔔';
}

export function mapNotificationFromApi(item) {
    const type = item.notification_type || item.type || item.category || '';
    const title = item.title || item.subject || 'Notification';
    const description = item.message || item.body || item.description || item.content || '';
    const bookingId = item.booking_id ?? item.booking?.id ?? item.related_booking_id ?? null;
    const createdAt = item.created_at || item.created || item.timestamp || null;
    const category = classifyNotificationCategory(type, title, description, bookingId);

    return {
        id: item.id,
        title,
        description,
        type,
        category,
        icon: pickNotificationIcon(type, title),
        isRead: Boolean(item.is_read ?? item.read ?? item.isRead ?? false),
        bookingId,
        createdAt,
        timeAgo: formatTimeAgo(createdAt),
        raw: item,
    };
}

function parseUnreadCount(data) {
    if (typeof data === 'number') return data;
    if (typeof data?.count === 'number') return data.count;
    if (typeof data?.unread_count === 'number') return data.unread_count;
    if (typeof data?.unread === 'number') return data.unread;
    if (typeof data?.total === 'number') return data.total;
    return 0;
}

export async function getNotifications(params = {}) {
    const response = await $api.get('/notifications/notifications/', { params });
    return unwrapList(response.data).map(mapNotificationFromApi);
}

export async function getUnreadCount() {
    const response = await $api.get('/notifications/notifications/unread-count/');
    return parseUnreadCount(response.data);
}

export async function markNotificationRead(id) {
    const response = await $api.patch(`/notifications/notifications/${id}/mark-read/`, {});
    return mapNotificationFromApi(response.data);
}

export async function markAllNotificationsRead() {
    const response = await $api.post('/notifications/notifications/mark-all-read/', {});
    return response.data;
}

export function countUnreadByCategory(notifications) {
    const unread = notifications.filter((item) => !item.isRead);
    return {
        total: unread.length,
        booking: unread.filter((item) => item.category === 'booking').length,
        other: unread.filter((item) => item.category !== 'booking').length,
    };
}
