const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function isoMinutesAgo(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoHoursAgo(hours) {
    return isoMinutesAgo(hours * 60);
}

function isoDaysAgo(days, hour = 14, minute = 20) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
}

const seedConversations = [
    {
        id: 'c1',
        guest: {
            id: 'g1',
            name: 'Dilnoza Karimova',
            phone: '+998 90 111 22 33',
        },
        booking: {
            id: 'b1',
            table: 'A4',
            date: '2026-09-12',
            time: '19:00',
            guests: 4,
        },
        lastMessage: 'Stol deraza yonidami?',
        lastAt: isoMinutesAgo(8),
        unreadCount: 2,
    },
    {
        id: 'c2',
        guest: {
            id: 'g2',
            name: 'Jasur Toshmatov',
            phone: '+998 93 445 66 77',
        },
        booking: {
            id: 'b2',
            table: 'B2',
            date: '2026-09-12',
            time: '20:30',
            guests: 2,
        },
        lastMessage: 'Rahmat, 20:30 da kelamiz.',
        lastAt: isoMinutesAgo(42),
        unreadCount: 0,
    },
    {
        id: 'c3',
        guest: {
            id: 'g3',
            name: 'Malika Yusupova',
            phone: '+998 97 220 18 40',
        },
        booking: {
            id: 'b3',
            table: 'C1',
            date: '2026-09-13',
            time: '18:00',
            guests: 6,
        },
        lastMessage: 'Bolalar stuli bormi?',
        lastAt: isoHoursAgo(3),
        unreadCount: 1,
    },
    {
        id: 'c4',
        guest: {
            id: 'g4',
            name: 'Akmal Rakhimov',
            phone: '+998 88 701 09 12',
        },
        booking: {
            id: 'b4',
            table: 'A1',
            date: '2026-09-14',
            time: '13:00',
            guests: 3,
        },
        lastMessage: 'Bronni 13:00 ga ko‘chirdik.',
        lastAt: isoDaysAgo(1, 16, 5),
        unreadCount: 0,
    },
    {
        id: 'c5',
        guest: {
            id: 'g5',
            name: 'Sevara Nazarova',
            phone: '+998 91 333 44 55',
        },
        booking: {
            id: 'b5',
            table: 'VIP 1',
            date: '2026-09-15',
            time: '21:00',
            guests: 8,
        },
        lastMessage: 'Tug‘ilgan kun uchun bezak qo‘shish mumkinmi?',
        lastAt: isoDaysAgo(2, 11, 40),
        unreadCount: 3,
    },
    {
        id: 'c6',
        guest: {
            id: 'g6',
            name: 'Otabek Saidov',
            phone: '+998 94 512 67 80',
        },
        booking: {
            id: 'b6',
            table: 'D3',
            date: '2026-09-12',
            time: '12:30',
            guests: 2,
        },
        lastMessage: 'Tushundim, rahmat.',
        lastAt: isoDaysAgo(3, 10, 12),
        unreadCount: 0,
    },
];

const seedMessages = {
    c1: [
        { id: 'm1-1', conversationId: 'c1', sender: 'guest', text: 'Assalomu alaykum, bugungi bron haqida.', createdAt: isoMinutesAgo(55) },
        { id: 'm1-2', conversationId: 'c1', sender: 'receptionist', text: 'Vaalaykum assalom. 19:00, 4 kishi, stol A4.', createdAt: isoMinutesAgo(50) },
        { id: 'm1-3', conversationId: 'c1', sender: 'guest', text: 'Kechikishimiz mumkin, 15 daqiqa.', createdAt: isoMinutesAgo(12) },
        { id: 'm1-4', conversationId: 'c1', sender: 'guest', text: 'Stol deraza yonidami?', createdAt: isoMinutesAgo(8) },
    ],
    c2: [
        { id: 'm2-1', conversationId: 'c2', sender: 'guest', text: 'Salom, bronni tasdiqlaysizmi?', createdAt: isoHoursAgo(2) },
        { id: 'm2-2', conversationId: 'c2', sender: 'receptionist', text: 'Ha, B2 stoli 20:30 ga tasdiqlangan.', createdAt: isoMinutesAgo(70) },
        { id: 'm2-3', conversationId: 'c2', sender: 'guest', text: 'Rahmat, 20:30 da kelamiz.', createdAt: isoMinutesAgo(42) },
    ],
    c3: [
        { id: 'm3-1', conversationId: 'c3', sender: 'guest', text: 'Ertaga 6 kishilik bronimiz bor.', createdAt: isoHoursAgo(5) },
        { id: 'm3-2', conversationId: 'c3', sender: 'receptionist', text: 'Ha, C1, 18:00. Yana savol bormi?', createdAt: isoHoursAgo(4) },
        { id: 'm3-3', conversationId: 'c3', sender: 'guest', text: 'Bolalar stuli bormi?', createdAt: isoHoursAgo(3) },
    ],
    c4: [
        { id: 'm4-1', conversationId: 'c4', sender: 'guest', text: '14:00 dagi bronni ertalabki vaqtga o‘tkazish mumkinmi?', createdAt: isoDaysAgo(1, 15, 10) },
        { id: 'm4-2', conversationId: 'c4', sender: 'receptionist', text: '13:00 bo‘sh. Shu vaqtga yozamizmi?', createdAt: isoDaysAgo(1, 15, 40) },
        { id: 'm4-3', conversationId: 'c4', sender: 'guest', text: 'Ha, iltimos.', createdAt: isoDaysAgo(1, 15, 55) },
        { id: 'm4-4', conversationId: 'c4', sender: 'receptionist', text: 'Bronni 13:00 ga ko‘chirdik.', createdAt: isoDaysAgo(1, 16, 5) },
    ],
    c5: [
        { id: 'm5-1', conversationId: 'c5', sender: 'guest', text: 'VIP zalni bron qilmoqchimiz.', createdAt: isoDaysAgo(2, 10, 5) },
        { id: 'm5-2', conversationId: 'c5', sender: 'receptionist', text: '15-sentabr, 21:00, 8 kishi — VIP 1 bo‘sh.', createdAt: isoDaysAgo(2, 10, 30) },
        { id: 'm5-3', conversationId: 'c5', sender: 'guest', text: 'Ajoyib.', createdAt: isoDaysAgo(2, 10, 45) },
        { id: 'm5-4', conversationId: 'c5', sender: 'guest', text: 'Tort olib kelamiz, muammo yo‘qmi?', createdAt: isoDaysAgo(2, 11, 10) },
        { id: 'm5-5', conversationId: 'c5', sender: 'guest', text: 'Tug‘ilgan kun uchun bezak qo‘shish mumkinmi?', createdAt: isoDaysAgo(2, 11, 40) },
    ],
    c6: [
        { id: 'm6-1', conversationId: 'c6', sender: 'guest', text: 'Parking bormi?', createdAt: isoDaysAgo(3, 9, 50) },
        { id: 'm6-2', conversationId: 'c6', sender: 'receptionist', text: 'Ha, restoran oldida bepul parking bor.', createdAt: isoDaysAgo(3, 10, 5) },
        { id: 'm6-3', conversationId: 'c6', sender: 'guest', text: 'Tushundim, rahmat.', createdAt: isoDaysAgo(3, 10, 12) },
    ],
};

let conversations = clone(seedConversations);
let messagesByConversation = clone(seedMessages);
let nextMessageId = 100;

function sortConversations(list) {
    return [...list].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

function summarizeConversation(conversation) {
    const messages = messagesByConversation[conversation.id] || [];
    const last = messages[messages.length - 1];
    return {
        ...conversation,
        lastMessage: last?.text || conversation.lastMessage || '',
        lastAt: last?.createdAt || conversation.lastAt,
    };
}

export async function getConversations() {
    await delay();
    return sortConversations(conversations.map(summarizeConversation)).map(clone);
}

export async function getMessages(conversationId) {
    await delay();
    return clone(messagesByConversation[conversationId] || []);
}

export async function sendMessage(conversationId, text) {
    await delay(120);
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('Empty message');

    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) throw new Error('Conversation not found');

    nextMessageId += 1;
    const message = {
        id: `m-local-${nextMessageId}`,
        conversationId,
        sender: 'receptionist',
        text: trimmed,
        createdAt: new Date().toISOString(),
    };

    if (!messagesByConversation[conversationId]) {
        messagesByConversation[conversationId] = [];
    }
    messagesByConversation[conversationId].push(message);

    conversation.lastMessage = trimmed;
    conversation.lastAt = message.createdAt;
    conversation.unreadCount = 0;

    return clone(message);
}

export async function markConversationRead(conversationId) {
    await delay(40);
    const conversation = conversations.find((item) => item.id === conversationId);
    if (conversation) conversation.unreadCount = 0;
    return clone(conversation || null);
}

export async function getUnreadChatCount() {
    await delay(20);
    return conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
}
