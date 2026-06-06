function isoToday() {
    return new Date().toISOString().slice(0, 10);
}

export function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data?.data?.results && Array.isArray(data.data.results)) return data.data.results;
    if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
    return [];
}

/** API booking status → UI (BookingsPage badges) */
export function mapApiStatusToUi(status) {
    const s = String(status || '').toLowerCase().replace(/-/g, '_');
    const map = {
        pending: 'pending',
        confirmed: 'confirmed',
        checked_in: 'confirmed',
        checkedin: 'confirmed',
        completed: 'completed',
        cancelled: 'cancelled',
        canceled: 'cancelled',
        no_show: 'no-show',
        noshow: 'no-show',
    };
    return map[s] || 'pending';
}

/** UI → API for POST .../status/ */
export function mapUiStatusToApi(status) {
    const map = {
        pending: 'pending',
        confirmed: 'confirmed',
        completed: 'completed',
        cancelled: 'canceled',
        'no-show': 'no_show',
    };
    return map[status] || 'pending';
}

/** Partner check-in uses checked_in per API examples */
export function mapUiActionToApiStatus(action) {
    if (action === 'check_in') return 'checked_in';
    if (action === 'confirm') return 'confirmed';
    if (action === 'cancel') return 'canceled';
    if (action === 'no_show') return 'no_show';
    if (action === 'complete') return 'completed';
    return action;
}

export function formatTimeFromIso(iso) {
    if (!iso) return '12:00';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '12:00';
    return d.toTimeString().slice(0, 5);
}

export function formatDateFromIso(iso) {
    if (!iso) return isoToday();
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return isoToday();
    return d.toISOString().slice(0, 10);
}

export function mapBookingFromApi(b) {
    const start = b.booking_start || b.start || b.starts_at;
    const date = formatDateFromIso(start);
    const time = formatTimeFromIso(start);
    const first = b.first_name || b.consumer?.first_name || '';
    const last = b.last_name || b.consumer?.last_name || '';
    const nameFromParts = [first, last].filter(Boolean).join(' ').trim();
    return {
        id: b.id,
        guestName: nameFromParts || b.guest_name || b.consumer_name || b.contact_name || 'Guest',
        phone: b.phone || b.consumer_phone || b.consumer?.phone || '',
        guests: b.guest_count ?? b.guests ?? 1,
        children: b.children_count ?? 0,
        date,
        time,
        table: b.table_name ?? b.table?.name ?? (b.table != null ? String(b.table) : ''),
        floor: b.floor_name ?? b.floor?.name ?? '',
        floorId: b.floor_id ?? b.floor,
        zoneId: b.zone_id ?? b.zone,
        tableId: b.table_id ?? b.table,
        status: mapApiStatusToUi(b.status),
        branchId: b.branch_id ?? b.branch,
        note: b.special_request ?? b.note ?? '',
        _raw: b,
    };
}

export function normalizeRole(role) {
    const r = String(role || '').toLowerCase();

    // Backend "admin" yoki "superuser" deb qaytarishi mumkin, 
    // biz uni "owner" deb hisoblaymiz
    if (r.includes('owner') || r.includes('admin') || r.includes('super')) {
        return 'owner';
    }
    if (r.includes('manager')) {
        return 'manager';
    }
    if (r.includes('reception') || r.includes('staff')) {
        return 'receptionist';
    }

    return 'manager'; // default fallback
}

export function mapBranchFromApi(b) {
    const brandValue = b.brand_id ?? b.brand;
    const brandId = typeof brandValue === 'object' && brandValue !== null ? brandValue.id : brandValue;
    return {
        id: b.id,
        name: b.name,
        address: b.address || '',
        status: b.is_active === false ? 'inactive' : 'active',
        tables: 0,
        capacity: 0,
        todayBookings: 0,
        rating: typeof b.rating === 'number' ? b.rating : 4.5,
        image: b.image || null,
        brandId: brandId ?? null,
        brand: b.brand ?? null,
        is_active: b.is_active !== false,
        slug: b.slug || '',
        _raw: b,
    };
}

export function mapFloorFromApi(f, branchId) {
    return {
        id: f.id,
        name: f.name,
        branchId: f.branch ?? f.branch_id ?? branchId,
        sortOrder: f.sort_order ?? 0,
        _raw: f,
    };
}

export function mapTableFromApi(t, branchId, floorNameFallback) {
    const floorId = t.floor ?? t.floor_id;
    const zoneId = t.zone ?? t.zone_id;
    const floorName = t.floor_name ?? t.floor?.name ?? floorNameFallback ?? '';
    const zoneName = t.zone_name ?? t.zone?.name ?? 'Area';
    let status = 'available';
    if (t.is_active === false) status = 'disabled';
    else if (t.status) status = String(t.status).toLowerCase();
    return {
        id: t.id,
        name: t.name || `T-${t.id}`,
        seats: t.seats ?? 4,
        floor: floorName,
        floorId,
        zoneId,
        zone: zoneName,
        status,
        x: t.x ?? 80,
        y: t.y ?? 80,
        shape: t.shape || 'round',
        branchId: t.branch ?? t.branch_id ?? branchId,
        layoutItemId: t.layout_item ?? t.layout_item_id,
        _raw: t,
    };
}