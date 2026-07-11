import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';
import { getPartnerBookings } from './bookings.services';

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

const CONSUMER_LIST_ENDPOINTS = [
    '/accounts/consumer/',
    '/accounts/consumers/',
    '/accounts/partner/consumers/',
];

export async function getConsumers(params = {}) {
    for (const endpoint of CONSUMER_LIST_ENDPOINTS) {
        try {
            const response = await $api.get(endpoint, { params });
            const list = unwrapList(response.data).map(mapConsumerFromApi);
            if (list.length || response.status === 200) return list;
        } catch {
            // try next endpoint
        }
    }
    return getConsumersFromBookings();
}

async function getConsumersFromBookings() {
    try {
        const payload = await getPartnerBookings({});
        const bookings = unwrapList(payload);
        const map = new Map();

        bookings.forEach((booking) => {
            const raw = booking.raw || booking;
            const consumer = raw.consumer || raw.guest_user || raw.user || null;
            const id = consumer?.id || raw.consumer_id || raw.guest_id || raw.guest;
            if (!id || map.has(String(id))) return;

            if (consumer && typeof consumer === 'object') {
                map.set(String(id), mapConsumerFromApi(consumer));
                return;
            }

            map.set(String(id), {
                id,
                name: booking.guestName || `Consumer #${id}`,
                phone: booking.phone || '',
                email: '',
                raw,
            });
        });

        return Array.from(map.values());
    } catch {
        return [];
    }
}
