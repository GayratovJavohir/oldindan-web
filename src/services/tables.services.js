import $api from '../config/api.config';
import { unwrapList } from '../utils/apiHelpers';

export function mapTableFromApi(table) {
    const branchId = table.branch_id ?? table.branch?.id ?? table.branch ?? null;
    const floorId = table.floor_id ?? table.floor?.id ?? table.floor ?? null;
    const zoneId = table.zone_id ?? table.zone?.id ?? table.zone ?? null;

    return {
        id: table.id,
        name: table.name || table.label || `Table ${table.id}`,
        seats: table.seats ?? table.capacity ?? table.seat_count ?? 0,
        shape: table.shape || 'rect',
        branchId,
        branchName: table.branch_name || table.branch?.name || '',
        floorId,
        floorName: table.floor_name || table.floor?.name || '',
        zoneId,
        zoneName: table.zone_name || table.zone?.name || '',
        is_active: table.is_active !== false,
        status: table.is_active === false ? 'inactive' : 'active',
        raw: table,
    };
}

export async function getPartnerTables(branchId, params = {}) {
    const response = await $api.get('/tables/partner/tables/', {
        params: { branch_id: branchId, ...params },
    });
    return unwrapList(response.data).map(mapTableFromApi);
}

export async function getBranchTables(branchId, params = {}) {
    const response = await $api.get(`/tables/branches/${branchId}/tables/`, { params });
    return unwrapList(response.data).map(mapTableFromApi);
}

export async function loadTablesForBranch(branchId, floorId = null) {
    const params = floorId ? { floor_id: floorId } : {};
    try {
        const partnerList = await getPartnerTables(branchId, params);
        if (partnerList.length) return partnerList;
    } catch {
        // fallback below
    }
    return getBranchTables(branchId, params);
}

export async function getPartnerTable(id) {
    const response = await $api.get(`/tables/partner/tables/${id}/`);
    return mapTableFromApi(response.data);
}

export async function createPartnerTable(payload) {
    const response = await $api.post('/tables/partner/tables/create/', payload);
    return mapTableFromApi(response.data);
}

export async function patchPartnerTable(id, payload) {
    const response = await $api.patch(`/tables/partner/tables/${id}/`, payload);
    return mapTableFromApi(response.data);
}

export async function deletePartnerTable(id) {
    await $api.delete(`/tables/partner/tables/${id}/`);
}
