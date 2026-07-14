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
    return {
        id: item.id,
        floorId,
        zoneId,
        zoneName: item.zone_name || item.zone?.name || '',
        type: item.type || 'decor',
        name: item.name || '',
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        width: Number(item.width) || 80,
        height: Number(item.height) || 80,
        rotation: Number(item.rotation) || 0,
        shape: item.shape || 'rect',
        zIndex: item.z_index ?? 0,
        meta,
        isActive: item.is_active !== false,
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
    const payload = {
        floor: Number(item.floorId ?? item.floor),
        type: item.type,
        name: item.name || '',
        x: Math.round(Number(item.x) || 0),
        y: Math.round(Number(item.y) || 0),
        width: Math.max(8, Math.round(Number(item.width) || 80)),
        height: Math.max(8, Math.round(Number(item.height) || 80)),
        rotation: Math.round(Number(item.rotation) || 0),
        shape: item.shape || 'rect',
        z_index: Number(item.zIndex ?? item.z_index ?? 0),
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
