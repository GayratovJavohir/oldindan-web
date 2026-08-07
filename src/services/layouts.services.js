import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';

export const LAYOUT_ITEM_TYPES = [
    { value: 'table', label: 'Table', defaultShape: 'round', defaultWidth: 90, defaultHeight: 90 },
    { value: 'entrance', label: 'Entrance', defaultShape: 'icon', defaultWidth: 100, defaultHeight: 60 },
    { value: 'exit', label: 'Exit', defaultShape: 'icon', defaultWidth: 100, defaultHeight: 60 },
    { value: 'wc', label: 'WC', defaultShape: 'icon', defaultWidth: 80, defaultHeight: 80 },
    { value: 'cashier', label: 'Cashier', defaultShape: 'icon', defaultWidth: 80, defaultHeight: 80 },
    { value: 'kids_area', label: 'Kids Area', defaultShape: 'icon', defaultWidth: 100, defaultHeight: 80 },
    { value: 'wall', label: 'Wall', defaultShape: 'rect', defaultWidth: 200, defaultHeight: 20 },
    { value: 'divider', label: 'Divider', defaultShape: 'rect', defaultWidth: 160, defaultHeight: 8 },
    { value: 'decor', label: 'Decor', defaultShape: 'icon', defaultWidth: 60, defaultHeight: 60 },
];

export const ZONE_COLORS = [
    '#8c1919', '#c45c26', '#2d6a4f', '#1d4e89', '#6a4c93', '#b08968', '#40916c', '#9a031e',
];

// Item types that carry a real seat count on the backend (see backend
// `LayoutItem.SEAT_TYPES` — table/booth/sofa). Every other type is always
// persisted with `seats = 0` (the backend model enforces this in `clean()`).
export const SEAT_ITEM_TYPES = ['table', 'booth', 'sofa'];

// The backend stores `shape` as a 0-100 "border radius" percentage
// (0 = square/rect corners, 50 = fully round) — it is a
// `PositiveSmallIntegerField`, NOT the 'rect' / 'round' / 'icon' strings the
// UI uses internally. Sending a string here is what caused the 400 error
// ("A valid integer is required" / shape range validation). These two
// helpers are the ONLY place that should translate between the two, so the
// rest of the app (FloorCanvas, LayoutFloor inspector, palette defaults)
// keeps using the readable string values without ever touching numbers.
const SHAPE_API_RECT = 0;
const SHAPE_API_ROUND = 50;

function shapeToApiValue(shape) {
    return shape === 'rect' ? SHAPE_API_RECT : SHAPE_API_ROUND;
}

function shapeFromApiValue(value) {
    const n = Number(value);
    return Number.isFinite(n) && n <= 25 ? 'rect' : 'round';
}

export function mapZoneFromApi(zone) {
    if (!zone) return null;
    return {
        id: zone.id,
        name: zone.name || `Zone #${zone.id}`,
        color: zone.color || '#8c1919',
        sortOrder: zone.sort_order ?? 0,
        isActive: zone.is_active !== false,
        floorId: zone.floor_id ?? zone.floor ?? null,
        raw: zone,
    };
}

export function mapFloorFromApi(floor) {
    const branchId = floor.branch_id ?? floor.branch?.id ?? floor.branch ?? null;
    const zones = unwrapList(floor.zones).map(mapZoneFromApi);
    return {
        id: floor.id,
        name: floor.name || `Floor #${floor.id}`,
        branchId,
        sortOrder: floor.sort_order ?? 0,
        isActive: floor.is_active !== false,
        zones,
        raw: floor,
    };
}

export function mapLayoutItemFromApi(item) {
    const floorId = item.floor_id ?? item.floor?.id ?? item.floor ?? null;
    const zoneId = item.zone_id ?? item.zone?.id ?? item.zone ?? null;
    const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
    const type = item.type || 'decor';
    return {
        id: item.id,
        floorId,
        zoneId,
        zoneName: item.zone_name || item.zone?.name || '',
        type,
        name: item.name || '',
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        width: Number(item.width) || 80,
        height: Number(item.height) || 80,
        rotation: Number(item.rotation) || 0,
        shape: shapeFromApiValue(item.shape),
        zIndex: item.z_index ?? 0,
        // `seats` is a real column on the backend LayoutItem model (used for
        // booking-capacity validation) — it must always come from
        // `item.seats`, never only from the free-form `meta` blob.
        seats: Number(item.seats) || 0,
        hasSeats: item.has_seats !== undefined ? Boolean(item.has_seats) : SEAT_ITEM_TYPES.includes(type),
        meta,
        isActive: item.is_active !== false,
        is_active: item.is_active !== false,
        raw: item,
    };
}

export function getTypeDefaults(type) {
    return LAYOUT_ITEM_TYPES.find((t) => t.value === type) || LAYOUT_ITEM_TYPES[LAYOUT_ITEM_TYPES.length - 1];
}

export async function getPartnerFloors(params = {}) {
    const response = await $api.get('/layouts/partner/floors/', { params });
    return unwrapList(response.data).map(mapFloorFromApi);
}

export async function getBranchFloors(branchId) {
    const response = await $api.get(`/layouts/branches/${branchId}/floors/`);
    return unwrapList(response.data).map(mapFloorFromApi);
}

export async function createPartnerFloor(payload) {
    const response = await $api.post('/layouts/partner/floors/create/', payload);
    return mapFloorFromApi(response.data);
}

export async function patchPartnerFloor(id, payload) {
    const response = await $api.patch(`/layouts/partner/floors/${id}/`, payload);
    return mapFloorFromApi(response.data);
}

export async function deletePartnerFloor(id) {
    await $api.delete(`/layouts/partner/floors/${id}/`);
}

export async function createPartnerZone(payload) {
    const response = await $api.post('/layouts/partner/zones/create/', payload);
    return mapZoneFromApi(response.data);
}

export async function patchPartnerZone(id, payload) {
    const response = await $api.patch(`/layouts/partner/zones/${id}/`, payload);
    return mapZoneFromApi(response.data);
}

export async function deletePartnerZone(id) {
    await $api.delete(`/layouts/partner/zones/${id}/`);
}

export async function getPartnerLayoutItems(params = {}) {
    const response = await $api.get('/layouts/partner/layout-items/', { params });
    return unwrapList(response.data).map(mapLayoutItemFromApi);
}

export async function getBranchLayoutItems(branchId, params = {}) {
    const response = await $api.get(`/layouts/branches/${branchId}/layout-items/`, { params });
    return unwrapList(response.data).map(mapLayoutItemFromApi);
}

export async function createPartnerLayoutItem(payload) {
    const response = await $api.post('/layouts/partner/layout-items/create/', payload);
    return mapLayoutItemFromApi(response.data);
}

export async function patchPartnerLayoutItem(id, payload) {
    const response = await $api.patch(`/layouts/partner/layout-items/${id}/`, payload);
    return mapLayoutItemFromApi(response.data);
}

export async function deletePartnerLayoutItem(id) {
    await $api.delete(`/layouts/partner/layout-items/${id}/`);
}

export function buildLayoutItemPayload(item) {
    const type = item.type;
    const isSeatType = SEAT_ITEM_TYPES.includes(type);
    // Backend requires seats >= 1 for table/booth/sofa and seats === 0 for
    // everything else. Accept the seat count from either the top-level
    // `seats` field (authoritative, comes from the API) or `meta.seats`
    // (used by the floor-editor's local draft state before it is saved).
    const rawSeats = item.seats ?? item.meta?.seats;
    const seats = isSeatType ? Math.max(1, Math.round(Number(rawSeats) || 1)) : 0;

    const payload = {
        floor: Number(item.floorId ?? item.floor),
        type,
        name: item.name || '',
        x: Math.round(Number(item.x) || 0),
        y: Math.round(Number(item.y) || 0),
        width: Math.max(8, Math.round(Number(item.width) || 80)),
        height: Math.max(8, Math.round(Number(item.height) || 80)),
        rotation: Math.round(Number(item.rotation) || 0),
        shape: shapeToApiValue(item.shape),
        z_index: Number(item.zIndex ?? item.z_index ?? 0),
        seats,
        meta: item.meta || {},
        is_active: item.isActive !== false && item.is_active !== false,
    };
    if (item.zoneId || item.zone) {
        payload.zone = Number(item.zoneId ?? item.zone);
    } else {
        payload.zone = null;
    }
    return payload;
}