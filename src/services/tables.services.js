/**
 * "Tables" are NOT a separate resource on the backend. The Django backend
 * (see `layouts` app) stores every seat/table as a `LayoutItem` row with
 * `type: 'table'` — there is no `/api/tables/...` endpoint at all.
 *
 * This file used to call `/tables/partner/tables/...` directly, which always
 * returned 404 (the endpoint never existed), silently breaking table
 * creation, editing, deletion, the Live View occupancy grid, the manual
 * booking form and the dashboard's "total tables" stat.
 *
 * It now derives everything from `layouts.services.js` (LayoutItem CRUD),
 * filtered to `type === 'table'`, and exposes the same "table" shape the
 * rest of the app already expects so callers don't need to change.
 */
import {
    mapLayoutItemFromApi,
    buildLayoutItemPayload,
    getPartnerLayoutItems,
    getBranchLayoutItems,
    createPartnerLayoutItem,
    patchPartnerLayoutItem,
    deletePartnerLayoutItem,
} from './layouts.services';

function isTableLayoutItem(item) {
    return item?.type === 'table';
}

/**
 * Maps an already-mapped LayoutItem (from layouts.services) into the
 * "table" shape the rest of the app (Dashboard, Live View, floor editor,
 * manual booking form) expects. Because tables ARE layout items now,
 * `table.id` is simply the LayoutItem id — there is no separate table id.
 */
export function mapTableFromLayoutItem(item) {
    if (!item) return null;
    const active = item.isActive !== false && item.is_active !== false;
    return {
        id: item.id,
        // Kept only for backward compatibility with code that used to look
        // up a table by a distinct `layoutItemId` — it is now always equal
        // to `id`, since a table IS its layout item.
        layoutItemId: item.id,
        name: item.name || `Table ${item.id}`,
        seats: Number(item.seats ?? item.meta?.seats) || 0,
        shape: item.shape || 'round',
        branchId: item.branchId ?? null,
        branchName: item.branchName || '',
        floorId: item.floorId ?? null,
        floorName: item.floorName || '',
        zoneId: item.zoneId ?? null,
        zoneName: item.zoneName || '',
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation || 0,
        is_active: active,
        status: active ? 'active' : 'inactive',
        raw: item.raw || item,
    };
}

/** Accepts a raw (unmapped) layout-item payload straight from the API. */
export function mapTableFromApi(raw) {
    return mapTableFromLayoutItem(mapLayoutItemFromApi(raw));
}

export async function getPartnerTables(branchId, params = {}) {
    const items = await getPartnerLayoutItems({ branch_id: branchId, ...params });
    return items.filter(isTableLayoutItem).map(mapTableFromLayoutItem);
}

export async function getBranchTables(branchId, params = {}) {
    const items = await getBranchLayoutItems(branchId, params);
    return items.filter(isTableLayoutItem).map(mapTableFromLayoutItem);
}

/**
 * Loads the tables for a branch (optionally scoped to a floor). Tries the
 * authenticated partner endpoint first (works for owner/manager/
 * receptionist) and falls back to the public branch endpoint so this keeps
 * working even in contexts where the partner endpoint isn't reachable.
 */
export async function loadTablesForBranch(branchId, floorId = null) {
    if (!branchId) return [];
    const params = floorId ? { floor_id: floorId } : {};

    try {
        return await getPartnerTables(branchId, params);
    } catch {
        try {
            return await getBranchTables(branchId, params);
        } catch {
            return [];
        }
    }
}

export async function getPartnerTable(id, branchId = undefined) {
    const items = await getPartnerLayoutItems(branchId ? { branch_id: branchId } : {});
    const found = items.find((item) => isTableLayoutItem(item) && String(item.id) === String(id));
    return found ? mapTableFromLayoutItem(found) : null;
}

/**
 * Creates a table. Under the hood this just creates a LayoutItem with
 * `type: 'table'` — `seats` is a real field on that model (not just meta),
 * so it is sent as a top-level value via `buildLayoutItemPayload`.
 */
export async function createPartnerTable({
    floorId,
    zoneId = null,
    name = '',
    seats = 2,
    shape = 'round',
    x = 120,
    y = 120,
    width = 90,
    height = 90,
    rotation = 0,
    meta = {},
}) {
    const payload = buildLayoutItemPayload({
        floorId,
        zoneId,
        type: 'table',
        name,
        seats,
        x,
        y,
        width,
        height,
        rotation,
        shape,
        zIndex: 10,
        meta,
        isActive: true,
    });
    const created = await createPartnerLayoutItem(payload);
    return mapTableFromLayoutItem(created);
}

export async function patchPartnerTable(id, patch = {}) {
    const payload = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.seats !== undefined) payload.seats = Math.max(1, Math.round(Number(patch.seats) || 1));
    if (patch.shape !== undefined) payload.shape = patch.shape;
    if (patch.zoneId !== undefined) payload.zone = patch.zoneId ? Number(patch.zoneId) : null;
    if (patch.zone !== undefined && patch.zoneId === undefined) payload.zone = patch.zone ? Number(patch.zone) : null;
    if (patch.x !== undefined) payload.x = Math.round(Number(patch.x));
    if (patch.y !== undefined) payload.y = Math.round(Number(patch.y));
    if (patch.width !== undefined) payload.width = Math.round(Number(patch.width));
    if (patch.height !== undefined) payload.height = Math.round(Number(patch.height));
    if (patch.rotation !== undefined) payload.rotation = Math.round(Number(patch.rotation));
    if (patch.isActive !== undefined) payload.is_active = patch.isActive !== false;
    if (patch.is_active !== undefined) payload.is_active = patch.is_active !== false;

    const updated = await patchPartnerLayoutItem(id, payload);
    return mapTableFromLayoutItem(updated);
}

export async function deletePartnerTable(id) {
    await deletePartnerLayoutItem(id);
}

/** Convenience helper: create a table in one call (kept for compatibility). */
export async function createTableWithLayout({
    floorId,
    zoneId = null,
    name,
    seats = 2,
    shape = 'round',
    x = 120,
    y = 120,
    width = 90,
    height = 90,
    rotation = 0,
    meta = {},
}) {
    const table = await createPartnerTable({
        floorId, zoneId, name, seats, shape, x, y, width, height, rotation, meta,
    });
    // `layoutItem` kept for compatibility with old call sites that expected
    // a separate layout-item object back — it is the very same record now.
    return { table, layoutItem: table.raw };
}