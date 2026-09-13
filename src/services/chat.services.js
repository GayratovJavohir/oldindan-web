import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';
import { getStoredUser } from '../utils/authUser';

function personName(person, fallback = '') {
    if (!person) return fallback;
    if (typeof person === 'string') return person;
    const first = person.first_name || person.firstName || '';
    const last = person.last_name || person.lastName || '';
    return [first, last].filter(Boolean).join(' ').trim()
        || person.full_name
        || person.name
        || person.username
        || person.phone
        || fallback;
}

function splitDateTime(value) {
    if (!value) return { date: '', time: '' };
    const raw = String(value);
    const date = raw.split('T')[0].split(' ')[0] || '';
    const time = raw.split('T')[1]?.slice(0, 5) || raw.split(' ')[1]?.slice(0, 5) || '';
    return { date, time };
}

function mapGuestFromRoom(room) {
    const guest = room.consumer
        || room.guest
        || room.user
        || room.participant
        || room.other_user
        || room.guest_user
        || {};
    const id = guest.id
        ?? room.consumer_id
        ?? room.guest_id
        ?? room.user_id
        ?? null;
    return {
        id,
        name: personName(guest, room.guest_name || room.consumer_name || room.user_name || 'Guest'),
        phone: guest.phone || room.guest_phone || room.consumer_phone || room.phone || '',
    };
}

function mapBookingFromRoom(room) {
    const booking = room.booking && typeof room.booking === 'object' ? room.booking : null;
    const bookingId = booking?.id ?? room.booking_id ?? room.booking ?? null;
    if (!booking && !bookingId) return null;

    const start = booking?.booking_start || booking?.start || booking?.starts_at || '';
    const fromStart = splitDateTime(start);
    const table = booking?.table_name
        || booking?.table?.name
        || booking?.table
        || room.table_name
        || room.table
        || '—';

    return {
        id: bookingId,
        table: table || '—',
        date: booking?.date || fromStart.date || '',
        time: booking?.time || fromStart.time || '',
        guests: booking?.guest_count ?? booking?.guests ?? room.guest_count ?? 0,
    };
}

function lastMessageText(room) {
    const last = room.last_message || room.latest_message;
    if (typeof last === 'string') return last;
    if (last && typeof last === 'object') {
        return last.text || last.message || last.content || last.body || '';
    }
    return room.last_message_text || room.last_message_content || '';
}

function lastMessageAt(room) {
    const last = room.last_message || room.latest_message;
    return last?.created_at
        || last?.created
        || last?.timestamp
        || room.last_message_at
        || room.updated_at
        || room.created_at
        || null;
}

export function mapRoomFromApi(room) {
    if (!room) return null;
    return {
        id: room.id,
        guest: mapGuestFromRoom(room),
        booking: mapBookingFromRoom(room),
        lastMessage: lastMessageText(room),
        lastAt: lastMessageAt(room),
        unreadCount: Number(room.unread_count ?? room.unread ?? room.unread_messages ?? 0) || 0,
        raw: room,
    };
}

function currentUserId() {
    return getStoredUser()?.id ?? null;
}

function mapSender(item) {
    const role = String(
        item.sender_role
        || item.sender_type
        || item.role
        || item.user_type
        || item.author_type
        || item.sender?.role
        || item.sender?.user_type
        || '',
    ).toLowerCase();

    if (
        role.includes('reception')
        || role.includes('staff')
        || role.includes('partner')
        || role.includes('manager')
        || role.includes('owner')
        || role.includes('admin')
    ) {
        return 'receptionist';
    }
    if (role.includes('consumer') || role.includes('guest') || role.includes('customer')) {
        return 'guest';
    }
    if (item.is_staff || item.is_partner || item.is_receptionist || item.sent_by_staff || item.is_mine || item.mine) {
        return 'receptionist';
    }
    if (item.is_consumer || item.is_guest) return 'guest';

    const senderId = item.sender_id
        ?? item.sender?.id
        ?? item.user?.id
        ?? item.author?.id
        ?? item.created_by
        ?? item.created_by_id;
    const me = currentUserId();
    if (me != null && senderId != null && String(senderId) === String(me)) {
        return 'receptionist';
    }
    return 'guest';
}

export function mapMessageFromApi(item, roomId) {
    return {
        id: item.id,
        conversationId: item.room_id ?? item.room ?? roomId,
        sender: mapSender(item),
        text: item.text || item.message || item.content || item.body || '',
        createdAt: item.created_at || item.created || item.timestamp || item.sent_at || null,
        raw: item,
    };
}

function sortByLastAt(list) {
    return [...list].sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
}

function sortMessages(list) {
    if (list.length < 2) return list;
    return [...list].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function unwrapRoom(data) {
    if (!data) return null;
    if (data.room && typeof data.room === 'object') return data.room;
    if (data.id) return data;
    return data;
}

function parseUnreadCount(data) {
    if (typeof data === 'number') return data;
    if (typeof data?.count === 'number') return data.count;
    if (typeof data?.unread_count === 'number') return data.unread_count;
    if (typeof data?.unread === 'number') return data.unread;
    if (typeof data?.total === 'number') return data.total;
    return 0;
}

function toRelativeApiUrl(next) {
    if (!next || typeof next !== 'string') return next;
    try {
        const url = new URL(next, window.location.origin);
        let path = `${url.pathname}${url.search}`;
        if (path.startsWith('/api/')) path = path.slice(4);
        return path || next;
    } catch {
        return next;
    }
}

async function fetchAllPages(path) {
    const collected = [];
    let url = path;
    let config = { params: { page_size: 100 } };

    for (let i = 0; i < 8; i += 1) {
        const response = await $api.get(url, config);
        const data = response.data;
        collected.push(...unwrapList(data));
        const next = data?.next;
        if (!next) break;
        url = toRelativeApiUrl(next);
        config = undefined;
    }

    return collected;
}

export async function getConversations() {
    const rooms = await fetchAllPages('/chat/rooms/');
    return sortByLastAt(rooms.map(mapRoomFromApi).filter(Boolean));
}

export async function getRoom(roomId) {
    const response = await $api.get(`/chat/rooms/${roomId}/`);
    return mapRoomFromApi(unwrapRoom(response.data));
}

export async function getBookingRoom(bookingId) {
    const response = await $api.get(`/chat/booking/${bookingId}/room/`);
    return mapRoomFromApi(unwrapRoom(response.data));
}

export async function createRoom(bookingId) {
    const response = await $api.post('/chat/rooms/create/', { booking_id: bookingId });
    return mapRoomFromApi(unwrapRoom(response.data));
}

export async function getOrCreateBookingRoom(bookingId) {
    try {
        const room = await getBookingRoom(bookingId);
        if (room?.id) return room;
    } catch {
        // create fallback
    }
    try {
        return await createRoom(bookingId);
    } catch (err) {
        const room = await getBookingRoom(bookingId);
        if (room?.id) return room;
        throw err;
    }
}

export async function getMessages(roomId) {
    const items = await fetchAllPages(`/chat/rooms/${roomId}/messages/`);
    return sortMessages(items.map((item) => mapMessageFromApi(item, roomId)));
}

export async function sendMessage(roomId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('Empty message');

    const payloads = [
        { text: trimmed },
        { message: trimmed },
        { content: trimmed },
        { body: trimmed },
    ];

    let lastError = null;
    for (const payload of payloads) {
        try {
            const response = await $api.post(`/chat/rooms/${roomId}/messages/send/`, payload);
            const data = unwrapRoom(response.data) || response.data;
            const messagePayload = data?.message && typeof data.message === 'object' && !data.text
                ? data.message
                : data;
            return mapMessageFromApi({
                ...messagePayload,
                text: messagePayload.text || messagePayload.message || messagePayload.content || trimmed,
                sender_role: messagePayload.sender_role || 'receptionist',
                is_mine: true,
            }, roomId);
        } catch (err) {
            lastError = err;
            if (err?.response?.status !== 400) throw err;
        }
    }

    throw lastError || new Error('Send failed');
}

export async function markConversationRead(roomId) {
    const response = await $api.post(`/chat/rooms/${roomId}/mark-read/`, {});
    return response.data;
}

export async function getUnreadChatCount() {
    const response = await $api.get('/chat/unread-count/');
    return parseUnreadCount(response.data);
}
