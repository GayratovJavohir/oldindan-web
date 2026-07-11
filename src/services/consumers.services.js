import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';

export function mapConsumerFromApi(user) {
    const first = user.first_name || user.firstName || '';
    const last = user.last_name || user.lastName || '';
    const name = [first, last].filter(Boolean).join(' ').trim()
        || user.full_name
        || user.username
        || user.phone
        || `Consumer #${user.id}`;

    return {
        id: user.id,
        name,
        phone: user.phone || '',
        email: user.email || '',
        raw: user,
    };
}

export function isConsumerUser(user) {
    if (!user || typeof user !== 'object') return false;
    const type = String(
        user.user_type || user.role || user.account_type || user.type || ''
    ).toLowerCase();
    if (type.includes('consumer') || type.includes('customer') || type.includes('guest')) return true;
    if (user.is_consumer === true) return true;
    if (user.phone && !type.includes('staff') && !type.includes('owner') && !type.includes('partner') && !type.includes('manager')) {
        return true;
    }
    return false;
}

const CONSUMER_LIST_ENDPOINTS = [
    '/accounts/partner/consumers/',
    '/accounts/consumers/',
    '/accounts/consumer/',
    '/accounts/consumer/list/',
    '/accounts/consumer/users/',
    '/bookings/partner/consumers/',
];

function normalizeConsumerList(data) {
    const list = unwrapList(data);
    return list
        .filter((item) => isConsumerUser(item))
        .map(mapConsumerFromApi);
}

export async function getConsumers(params = {}) {
    for (const endpoint of CONSUMER_LIST_ENDPOINTS) {
        try {
            const response = await $api.get(endpoint, { params });
            const list = normalizeConsumerList(response.data);
            if (list.length) return list;
        } catch {
            // try next endpoint
        }
    }
    return getConsumersFromBookings();
}

async function getConsumersFromBookings() {
    try {
        const response = await $api.get('/bookings/partner/');
        const bookings = unwrapList(response.data);
        const map = new Map();

        bookings.forEach((booking) => {
            const consumer = booking.consumer || booking.guest_user || booking.user || null;
            const id = consumer?.id || booking.consumer_id || booking.guest_id || booking.guest;
            if (!id || map.has(String(id))) return;

            if (consumer && typeof consumer === 'object') {
                if (isConsumerUser(consumer) || consumer.phone || consumer.first_name) {
                    map.set(String(id), mapConsumerFromApi(consumer));
                }
                return;
            }

            if (booking.guest_name || booking.first_name || booking.phone) {
                map.set(String(id), {
                    id,
                    name: [booking.first_name, booking.last_name].filter(Boolean).join(' ').trim()
                        || booking.guest_name
                        || booking.consumer_name
                        || `Consumer #${id}`,
                    phone: booking.phone || booking.consumer_phone || '',
                    email: '',
                    raw: booking,
                });
            }
        });

        return Array.from(map.values());
    } catch {
        return [];
    }
}
