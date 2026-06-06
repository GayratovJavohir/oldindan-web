import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    mockBranches,
    mockBookings,
    mockTables,
    mockFloors,
    mockStaff,
    mockNotifications,
} from '../config/mockData';

/** Estimated revenue per guest (deposit / spend) for analytics dashboards */
export const EST_REVENUE_PER_GUEST = 42;

const STORAGE_KEY = 'rp-app-v1';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function timeLabel() {
    return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

let notificationId = mockNotifications.reduce((m, n) => Math.max(m, n.id), 0);

function nextNotifId() {
    notificationId += 1;
    return notificationId;
}

function nextId(list) {
    return list.length ? Math.max(...list.map(x => x.id)) + 1 : 1;
}

const seedTables = mockTables.map(t => ({ ...t, branchId: t.branchId ?? 1 }));

const seedStaff = mockStaff.map(s => ({
    ...s,
    branchId: s.branchId ?? mockBranches.find(b => b.name === s.branch)?.id ?? 1,
}));

function recomputeBranches(state) {
    const today = todayISO();
    state.branches.forEach(b => {
        const bid = b.id;
        const branchTables = state.tables.filter(t => t.branchId === bid);
        b.tables = branchTables.length;
        b.capacity = branchTables.reduce((sum, t) => sum + (t.seats || 0), 0);
        b.todayBookings = state.bookings.filter(
            x => x.branchId === bid && x.date === today && !['cancelled', 'no-show'].includes(x.status)
        ).length;
        // Branch staffs ro'yxatini ham yangilaymiz
        b.staffIds = state.staff
            .filter(st => {
                const stBranchId = st.branch?.id ?? st.branchId;
                return stBranchId === bid;
            })
            .map(st => st.id);
    });
}

function applyTableForBooking(state, booking, oldTableName) {
    if (oldTableName && oldTableName !== booking?.table) {
        const still = state.bookings.some(
            b => b.table === oldTableName && b.id !== booking?.id && ['pending', 'confirmed'].includes(b.status)
        );
        if (!still) {
            const prev = state.tables.find(tbl => tbl.name === oldTableName);
            if (prev && prev.status === 'reserved') prev.status = 'available';
        }
    }
    if (!booking?.table) return;
    const t = state.tables.find(tbl => tbl.name === booking.table);
    if (!t) return;
    if (['pending', 'confirmed'].includes(booking.status)) {
        t.status = 'reserved';
    } else if (['cancelled', 'no-show', 'completed'].includes(booking.status)) {
        const still = state.bookings.some(
            b => b.table === booking.table && b.id !== booking.id && ['pending', 'confirmed'].includes(b.status)
        );
        if (!still && t.status === 'reserved') t.status = 'available';
    }
}

function pushNotificationDraft(state, payload) {
    state.notifications.unshift({
        id: nextNotifId(),
        type: payload.type || 'system',
        title: payload.title,
        message: payload.message,
        time: timeLabel(),
        read: false,
    });
}

const defaultSettings = {
    restaurantName: 'ReserveX Restaurant Group',
    contactPhone: '+998 71 234 5678',
    contactEmail: 'info@restaurant.uz',
    currency: 'USD',
    timezone: 'Asia/Tashkent',
    workingHours: DAYS.map((day, i) => ({
        day,
        start: '10:00',
        end: i >= 5 ? '00:00' : '23:00',
        open: true,
    })),
    deposit: {
        requireDeposit: true,
        amountPerPerson: 20,
        depositType: 'fixed',
        serviceFee: false,
        serviceFeePercent: 10,
        cancellationPolicy: true,
        freeCancelHours: 24,
    },
    notificationPrefs: {
        newBooking: true,
        cancellation: true,
        noShow: true,
        email: false,
        sms: false,
        dailySummary: true,
    },
    integrations: {
        telegram: true,
        whatsapp: false,
        gcal: false,
        payment: true,
    },
};

function buildWeeklyData(bookings) {
    const result = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en', { weekday: 'short' });
        const dayBookings = bookings.filter(b => b.date === iso && !['cancelled', 'no-show'].includes(b.status));
        const count = dayBookings.length;
        const revenue = Math.round(dayBookings.reduce((s, b) => s + (b.guests || 0) * EST_REVENUE_PER_GUEST, 0));
        result.push({ day: label, date: iso, bookings: count, revenue });
    }
    return result;
}

/** Last N calendar days (inclusive of today): active bookings, guests, est. revenue — for charts */
export function bookingsSeriesByDay(bookings, numDays = 14) {
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const short = d.toLocaleDateString('en', { weekday: 'short' });
        const dayBookings = bookings.filter(b => b.date === iso && !['cancelled', 'no-show'].includes(b.status));
        const count = dayBookings.length;
        const guests = dayBookings.reduce((s, b) => s + (b.guests || 0), 0);
        const revenue = Math.round(dayBookings.reduce((s, b) => s + (b.guests || 0) * EST_REVENUE_PER_GUEST, 0));
        result.push({ date: iso, label, short, bookings: count, guests, revenue });
    }
    return result;
}

const STATUS_PIE = [
    { key: 'confirmed', name: 'Confirmed', color: '#22c55e' },
    { key: 'pending', name: 'Pending', color: '#eab308' },
    { key: 'completed', name: 'Completed', color: '#3b82f6' },
    { key: 'cancelled', name: 'Cancelled', color: '#e8192c' },
    { key: 'no-show', name: 'No-show', color: '#94a3b8' },
];

export function bookingStatusPieData(bookings) {
    return STATUS_PIE
        .map(({ key, name, color }) => ({
            name,
            value: bookings.filter(b => b.status === key).length,
            color,
        }))
        .filter(x => x.value > 0);
}

export function branchBookingPieData(bookings, branches) {
    return branches
        .map(b => ({
            name: b.name.length > 20 ? `${b.name.slice(0, 18)}…` : b.name,
            value: bookings.filter(x => x.branchId === b.id).length,
            color: `hsl(${((b.id || 1) * 67) % 360}, 52%, 48%)`,
        }))
        .filter(x => x.value > 0);
}

/** Pure helper — safe to use in useMemo. */
export function computeDashboardStats(bookings, tables) {
    const today = todayISO();
    const todayList = bookings.filter(b => b.date === today);
    const activeToday = todayList.filter(b => !['cancelled', 'no-show'].includes(b.status));
    const guests = activeToday.reduce((sum, b) => sum + (b.guests || 0), 0);
    const tablesTaken = tables.filter(t => t.status === 'occupied' || t.status === 'reserved').length;
    const availableTables = tables.filter(t => t.status === 'available').length;
    const noShows = bookings.filter(b => b.date === today && b.status === 'no-show').length;
    const revenue = Math.round(activeToday.reduce((s, b) => s + (b.guests || 0) * EST_REVENUE_PER_GUEST, 0));
    return {
        todayBookings: activeToday.length,
        tablesTaken,
        availableTables,
        revenue,
        totalGuests: guests,
        noShows,
        weeklyData: buildWeeklyData(bookings),
    };
}

export const useAppStore = create(
    persist(
        immer((set, get) => ({
            branches: mockBranches.map(b => ({ ...b })),
            bookings: mockBookings.map(b => ({ ...b })),
            tables: seedTables.map(t => ({ ...t })),
            floors: mockFloors.map(f => ({ ...f })),
            staff: seedStaff.map(s => ({ ...s })),
            notifications: mockNotifications.map(n => ({ ...n })),
            settings: {
                ...defaultSettings,
                workingHours: defaultSettings.workingHours.map(w => ({ ...w })),
                deposit: { ...defaultSettings.deposit },
                notificationPrefs: { ...defaultSettings.notificationPrefs },
                integrations: { ...defaultSettings.integrations },
            },

            refreshBranchStats: () =>
                set(state => {
                    recomputeBranches(state);
                }),

            /** Replace server-backed entities after partner API sync */
            replacePartnerDataset: ({ branches, floors, tables, bookings }) =>
                set(state => {
                    state.branches = branches;
                    state.floors = floors;
                    state.tables = tables;
                    state.bookings = bookings;
                    recomputeBranches(state);
                }),

            setBookingsFromApi: list =>
                set(state => {
                    state.bookings = list;
                    recomputeBranches(state);
                }),

            setBranchesFromApi: list =>
                set(state => {
                    state.branches = list;
                    recomputeBranches(state);
                }),

            addBranch: data =>
                set(state => {
                    const id = nextId(state.branches);
                    state.branches.push({
                        id,
                        name: data.name,
                        address: data.address,
                        status: data.status || 'active',
                        tables: 0,
                        capacity: 0,
                        todayBookings: 0,
                        staffIds: [],
                        rating: 4.5,
                        image: null,
                    });
                    recomputeBranches(state);
                    pushNotificationDraft(state, { type: 'system', title: 'Branch added', message: `${data.name} was created.` });
                }),

            updateBranch: (id, data) =>
                set(state => {
                    const b = state.branches.find(x => x.id === id);
                    if (!b) return;
                    Object.assign(b, data);
                    recomputeBranches(state);
                }),

            deleteBranch: id =>
                set(state => {
                    if (state.branches.length <= 1) return;
                    state.branches = state.branches.filter(b => b.id !== id);
                    state.bookings = state.bookings.filter(bk => bk.branchId !== id);
                    state.floors = state.floors.filter(f => f.branchId !== id);
                    state.staff = state.staff.filter(st => {
                        const stBranchId = st.branch?.id ?? st.branchId;
                        return stBranchId !== id;
                    });
                    state.tables = state.tables.filter(t => t.branchId !== id);
                    recomputeBranches(state);
                }),

            addFloor: (branchId, name) =>
                set(state => {
                    const id = nextId(state.floors);
                    state.floors.push({ id, name, branchId });
                }),

            updateFloor: (id, name) =>
                set(state => {
                    const f = state.floors.find(x => x.id === id);
                    if (f) f.name = name;
                }),

            deleteFloor: id =>
                set(state => {
                    state.floors = state.floors.filter(f => f.id !== id);
                }),

            addBooking: payload =>
                set(state => {
                    const id = nextId(state.bookings);
                    const booking = {
                        id,
                        guestName: payload.guestName,
                        phone: payload.phone,
                        guests: payload.guests,
                        date: payload.date,
                        time: payload.time,
                        table: payload.table,
                        floor: payload.floor,
                        status: payload.status || 'confirmed',
                        branchId: payload.branchId ?? 1,
                        note: payload.note || '',
                    };
                    state.bookings.push(booking);
                    applyTableForBooking(state, booking, null);
                    recomputeBranches(state);
                    pushNotificationDraft(state, {
                        type: 'booking',
                        title: 'New booking',
                        message: `${booking.guestName} booked ${booking.table} for ${booking.guests} guests at ${booking.time}`,
                    });
                }),

            updateBooking: (id, data) =>
                set(state => {
                    const booking = state.bookings.find(b => b.id === id);
                    if (!booking) return;
                    const oldTable = booking.table;
                    Object.assign(booking, data);
                    applyTableForBooking(state, booking, oldTable);
                    recomputeBranches(state);
                }),

            deleteBooking: id =>
                set(state => {
                    const booking = state.bookings.find(b => b.id === id);
                    if (!booking) return;
                    state.bookings = state.bookings.filter(b => b.id !== id);
                    applyTableForBooking(state, null, booking.table);
                    recomputeBranches(state);
                }),

            setBookingStatus: (id, status) =>
                set(state => {
                    const booking = state.bookings.find(b => b.id === id);
                    if (!booking) return;
                    const oldTable = booking.table;
                    booking.status = status;
                    applyTableForBooking(state, booking, oldTable);
                    recomputeBranches(state);
                    if (status === 'cancelled') {
                        pushNotificationDraft(state, { type: 'booking', title: 'Booking cancelled', message: `${booking.guestName} — ${booking.table}` });
                    }
                    if (status === 'no-show') {
                        pushNotificationDraft(state, { type: 'noshow', title: 'No-show', message: `${booking.guestName} did not show for ${booking.table}` });
                    }
                }),

            confirmBooking: id => get().setBookingStatus(id, 'confirmed'),
            cancelBooking: id => get().setBookingStatus(id, 'cancelled'),
            checkInBooking: id => get().setBookingStatus(id, 'completed'),
            markNoShow: id => get().setBookingStatus(id, 'no-show'),

            addStaff: data =>
                set(state => {
                    const branch = state.branches.find(b => b.id === data.branchId) || state.branches[0];
                    const id = nextId(state.staff);
                    state.staff.push({
                        id,
                        name: data.name,
                        email: data.email,
                        role: data.role,
                        branchId: branch.id,
                        branch: branch.name,
                        status: 'active',
                        joined: todayISO(),
                    });
                }),

            /**
             * Backend API'dan qaytgan to'liq staff record'ni store'ga qo'shadi.
             * Shape: { id, user:{id,first_name,last_name,email,phone,is_staff,...}, role, branch:{id,name}, is_active, is_staff, created_at }
             * Shu bilan birga branch.staffIds ga ham qo'shadi.
             */
            addStaffRecord: (record) =>
                set(state => {
                    // Duplicate tekshirish
                    const exists = state.staff.some(
                        s => s.id === record.id || (s.user?.id && s.user.id === record.user?.id)
                    );
                    if (!exists) {
                        state.staff.push(record);

                        // Branch staffIds ga qo'shish
                        if (record.branch?.id) {
                            const branch = state.branches.find(b => b.id === record.branch.id);
                            if (branch) {
                                if (!Array.isArray(branch.staffIds)) branch.staffIds = [];
                                if (!branch.staffIds.includes(record.id)) {
                                    branch.staffIds.push(record.id);
                                }
                            }
                        }
                    }
                }),

            /**
             * Staff'ni yangilaydi: is_active, is_staff, role, user info, branch.
             * Flat (mock) va nested (API) format ikkalasini ham qo'llab-quvvatlaydi.
             */
            updateStaff: (id, data) =>
                set(state => {
                    const st = state.staff.find(x => x.id === id);
                    if (!st) return;

                    // ── Nested API format (st.user mavjud) ──
                    if (st.user) {
                        if (data.first_name != null) st.user.first_name = data.first_name;
                        if (data.last_name != null) st.user.last_name = data.last_name;
                        if (data.phone != null) st.user.phone = data.phone;
                        if (data.email != null) st.user.email = data.email;
                        if (data.is_active != null) st.is_active = data.is_active;
                        if (data.is_staff != null) st.is_staff = data.is_staff;
                        if (data.role != null) st.role = data.role;

                        // Branch o'zgartirish
                        if (data.branch_id != null) {
                            const oldBranchId = st.branch?.id;
                            const newBranch = state.branches.find(b => b.id === data.branch_id);
                            if (newBranch) {
                                // Eski branchdan chiqarish
                                if (oldBranchId) {
                                    const oldBranch = state.branches.find(b => b.id === oldBranchId);
                                    if (oldBranch?.staffIds) {
                                        oldBranch.staffIds = oldBranch.staffIds.filter(sid => sid !== id);
                                    }
                                }
                                // Yangi branchga qo'shish
                                st.branch = { id: newBranch.id, name: newBranch.name };
                                if (!Array.isArray(newBranch.staffIds)) newBranch.staffIds = [];
                                if (!newBranch.staffIds.includes(id)) newBranch.staffIds.push(id);
                            }
                        }
                    } else {
                        // ── Flat mock format ──
                        if (data.name != null) st.name = data.name;
                        if (data.email != null) st.email = data.email;
                        if (data.role != null) st.role = data.role;
                        if (data.is_active != null) {
                            st.is_active = data.is_active;
                            st.status = data.is_active ? 'active' : 'inactive';
                        }
                        if (data.is_staff != null) st.is_staff = data.is_staff;
                        if (data.status != null) st.status = data.status;
                        if (data.branchId != null) {
                            const br = state.branches.find(b => b.id === data.branchId);
                            if (br) {
                                st.branchId = br.id;
                                st.branch = br.name;
                            }
                        }
                    }
                }),

            deleteStaff: id =>
                set(state => {
                    // Branch staffIds dan ham o'chirish
                    state.branches.forEach(b => {
                        if (Array.isArray(b.staffIds)) {
                            b.staffIds = b.staffIds.filter(sid => sid !== id);
                        }
                    });
                    state.staff = state.staff.filter(x => x.id !== id);
                }),

            setTableStatus: (tableId, status) =>
                set(state => {
                    const t = state.tables.find(x => x.id === tableId);
                    if (t) t.status = status;
                }),

            updateTable: (id, data) =>
                set(state => {
                    const t = state.tables.find(x => x.id === id);
                    if (t) Object.assign(t, data);
                    recomputeBranches(state);
                }),

            addTable: data =>
                set(state => {
                    const id = nextId(state.tables);
                    state.tables.push({
                        id,
                        name: data.name,
                        seats: data.seats ?? 4,
                        floor: data.floor,
                        zone: data.zone || 'Center',
                        status: data.status || 'available',
                        x: data.x ?? 100,
                        y: data.y ?? 100,
                        shape: data.shape || 'round',
                        branchId: data.branchId ?? 1,
                    });
                    recomputeBranches(state);
                }),

            deleteTable: id =>
                set(state => {
                    state.tables = state.tables.filter(t => t.id !== id);
                    recomputeBranches(state);
                }),

            updateSettings: partial =>
                set(state => {
                    if (partial.general) {
                        Object.assign(state.settings, partial.general);
                    }
                    if (partial.workingHours) {
                        state.settings.workingHours = partial.workingHours;
                    }
                    if (partial.deposit) {
                        Object.assign(state.settings.deposit, partial.deposit);
                    }
                    if (partial.notificationPrefs) {
                        Object.assign(state.settings.notificationPrefs, partial.notificationPrefs);
                    }
                    if (partial.integrations) {
                        Object.assign(state.settings.integrations, partial.integrations);
                    }
                }),

            markNotificationRead: id =>
                set(state => {
                    const n = state.notifications.find(x => x.id === id);
                    if (n) n.read = true;
                }),

            markAllNotificationsRead: () =>
                set(state => {
                    state.notifications.forEach(n => { n.read = true; });
                }),

            clearNotifications: () =>
                set(state => {
                    state.notifications = [];
                }),

            getBranchName: branchId => get().branches.find(b => b.id === branchId)?.name ?? `Branch #${branchId}`,

            getComputedStats: () => computeDashboardStats(get().bookings, get().tables),
        })),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            partialize: state => ({
                branches: state.branches,
                bookings: state.bookings,
                tables: state.tables,
                floors: state.floors,
                staff: state.staff,
                notifications: state.notifications,
                settings: state.settings,
            }),
            merge: (persisted, current) => {
                const p = persisted || {};
                return {
                    ...current,
                    ...p,
                    settings: {
                        ...current.settings,
                        ...(p.settings || {}),
                        deposit: { ...current.settings.deposit, ...(p.settings?.deposit || {}) },
                        notificationPrefs: { ...current.settings.notificationPrefs, ...(p.settings?.notificationPrefs || {}) },
                        integrations: { ...current.settings.integrations, ...(p.settings?.integrations || {}) },
                        workingHours: p.settings?.workingHours?.length ? p.settings.workingHours : current.settings.workingHours,
                    },
                };
            },
        }
    )
);