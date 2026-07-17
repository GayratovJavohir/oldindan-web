import $api from '../config/api.config';

function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

function normalizeBookingStatus(status) {
    const raw = String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    const map = {
        pending: 'Pending',
        confirmed: 'Confirmed',
        checked_in: 'Checked In',
        checkedin: 'Checked In',
        completed: 'Completed',
        cancelled: 'Canceled',
        canceled: 'Canceled',
        no_show: 'No Show',
        noshow: 'No Show',
    };
    return map[raw] || 'Pending';
}

export function mapBookingFromApi(booking) {
    const start = booking.booking_start || booking.start || booking.starts_at || '';
    const end = booking.booking_end || booking.end || booking.ends_at || '';
    const startDate = start ? String(start).split('T')[0].split(' ')[0] : '';
    const startTime = start ? String(start).split('T')[1]?.slice(0, 5) || String(start).split(' ')[1]?.slice(0, 5) || '' : '';
    const endTime = end ? String(end).split('T')[1]?.slice(0, 5) || String(end).split(' ')[1]?.slice(0, 5) || '' : '';
    const first = booking.first_name || booking.consumer?.first_name || booking.user?.first_name || '';
    const last = booking.last_name || booking.consumer?.last_name || booking.user?.last_name || '';
    const guestName = [first, last].filter(Boolean).join(' ').trim()
        || booking.guest_name
        || booking.contact_name
        || booking.consumer_name
        || booking.user_name
        || 'Guest';

    return {
        id: booking.id,
        bookingNumber: booking.booking_number || booking.number || '',
        guestName,
        phone: booking.phone || booking.consumer_phone || booking.consumer?.phone || booking.user?.phone || '',
        branch: booking.branch_name || booking.branch?.name || booking.branch,
        branchId: booking.branch_id ?? booking.branch?.id ?? booking.branch ?? null,
        floor: booking.floor_name || booking.floor?.name || booking.floor,
        floorId: booking.floor_id ?? booking.floor?.id ?? booking.floor ?? null,
        zone: booking.zone_name || booking.zone?.name || booking.zone,
        zoneId: booking.zone_id ?? booking.zone?.id ?? booking.zone ?? null,
        table: booking.table_name || booking.table?.name || booking.table,
        tableId: booking.table_id ?? booking.table?.id ?? booking.table ?? null,
        guest_count: booking.guest_count ?? booking.guests ?? 0,
        children_count: booking.children_count ?? 0,
        date: startDate,
        time: startTime,
        endTime,
        status: normalizeBookingStatus(booking.status),
        source: booking.source || (booking.created_by_partner ? 'Manual' : 'App'),
        special_request: booking.special_request || booking.note || '',
        booking_start: start,
        booking_end: end,
        raw: booking,
    };
}

export function buildBookingFilters(filters = {}) {
    const params = {};
    if (filters.page) params.page = filters.page;
    if (filters.status) {
        const statusMap = {
            Confirmed: 'confirmed',
            Pending: 'pending',
            'Checked In': 'checked_in',
            Completed: 'completed',
            Canceled: 'cancelled',
            'No Show': 'no_show',
        };
        params.status = statusMap[filters.status] || filters.status;
    }
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.branch_id) params.branch_id = filters.branch_id;
    if (filters.date) params.date = filters.date;
    return params;
}

export const getOccupiedTables = async (params) => {
    const response = await $api.get('/bookings/partner/occupied-tables/', { params });
    return response.data;
};


export const getPartnerBookings = async (params) => {
    const response = await $api.get('/bookings/partner/', { params: buildBookingFilters(params) });
    const payload = response.data;
    const list = unwrapList(payload).map(mapBookingFromApi);
    return {
        ...payload,
        results: list,
        count: payload?.count ?? list.length,
    };
};

export const getPartnerBooking = async (id) => {
    const response = await $api.get(`/bookings/partner/${id}/`);
    return mapBookingFromApi(response.data);
};

export const updateBookingStatus = async (id, status, note = '') => {
    const response = await $api.post(`/bookings/partner/${id}/status/`, { status, note });
    return response.data;
};

export const noShowBooking = async (id, note = '') => {
    const response = await $api.post(`/bookings/partner/${id}/no-show/`, { note });
    return response.data;
};

export const checkInBooking = async (id, data = {}) => {
    const response = await $api.post(`/bookings/partner/${id}/checkin/`, data);
    return response.data;
};

/** POST /bookings/partner/checkin/ — body: { booking_number, branch_id? } */
export const checkInByNumber = async ({ booking_number, branch_id }) => {
    const body = { booking_number: String(booking_number).trim().toUpperCase() };
    if (branch_id) body.branch_id = Number(branch_id);
    const response = await $api.post('/bookings/partner/checkin/', body);
    return response.data;
};

export const createManualBooking = async (payload) => {
    const branchId = payload.branch_id ?? payload.branch;
    const floorId = payload.floor_id ?? payload.floor;
    const tableId = payload.table_id ?? payload.table;
    const zoneId = payload.zone_id ?? payload.zone;

    const body = {
        branch: branchId,
        branch_id: branchId,
        floor: floorId,
        floor_id: floorId,
        table: tableId,
        table_id: tableId,
        first_name: payload.first_name?.trim(),
        last_name: payload.last_name?.trim(),
        phone: payload.phone?.trim(),
        guest_count: payload.guest_count,
        children_count: payload.children_count ?? 0,
        booking_start: payload.booking_start,
        booking_end: payload.booking_end,
        special_request: payload.special_request || '',
    };

    if (zoneId) {
        body.zone = zoneId;
        body.zone_id = zoneId;
    }

    const response = await $api.post('/bookings/partner/manual-create/', body);
    return response.data;
};