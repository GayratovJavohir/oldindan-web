import $api from '../config/api.config';
import { unwrapList, getApiError } from '../utils/apiHelpers';

const STAFF_CACHE_KEY = 'rp_staff_cache'

function mapStaffFromApi(staff, branchNameFallback = '') {
    const name = [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim()
        || staff.full_name
        || staff.name
        || staff.email
        || 'Staff';
    const roleRaw = staff.role || staff.user_type || staff.position || 'staff';
    const role = String(roleRaw).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const branchId = staff.branch_id ?? staff.branch?.id ?? staff.branch ?? null;

    return {
        id: staff.id || `local-${Date.now()}`,
        name,
        email: staff.email || '',
        role,
        roleKey: String(roleRaw).toLowerCase(),
        branch: staff.branch_name || staff.branch?.name || branchNameFallback || (branchId ? `Branch #${branchId}` : '—'),
        branchId,
        status: staff.is_active === false ? 'inactive' : 'active',
        raw: staff,
    };
}

function readStaffCache() {
    try {
        const raw = localStorage.getItem(STAFF_CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeStaffCache(list) {
    try {
        localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(list));
    } catch {
        // ignore quota/serialization errors — cache is only a fallback
    }
}

function upsertStaffCache(member) {
    const list = readStaffCache();
    const idx = list.findIndex((item) => item.id === member.id || item.email === member.email);
    if (idx >= 0) {
        list[idx] = member;
    } else {
        list.unshift(member);
    }
    writeStaffCache(list);
    return list;
}

/**
 * Backend currently exposes staff register only (no public list endpoint).
 * We keep a local cache of successfully registered staff for the UI.
 */
export async function getStaffList(params = {}) {
    try {
        const response = await $api.get('/accounts/staff/', { params });
        const list = unwrapList(response.data).map((s) => mapStaffFromApi(s));
        writeStaffCache(list); // keep a fallback copy for offline/error cases
        return list;
    } catch (err) {
        console.error('getStaffList failed, falling back to cache:', getApiError(err));
        return readStaffCache();
    }
}

export function buildStaffRegisterPayload(form, branches = []) {
    const branchId = Number(form.branch_id ?? form.branch);
    if (!branchId) {
        throw new Error('Branch is required. Select a branch for this staff member.');
    }

    const selectedBranch = branches.find((b) => Number(b.id) === branchId);
    const password = form.password;

    return {
        email: form.email.trim(),
        password,
        password_repeat: form.password_repeat || password,
        first_name: form.first_name.trim(),
        last_name: (form.last_name || '').trim(),
        role: form.role,
        branch_id: branchId,
        _branchName: selectedBranch?.name || '',
    };
}

export async function registerStaff(form, branches = []) {
    const built = buildStaffRegisterPayload(form, branches);
    const { _branchName, ...payload } = built;

    const response = await $api.post('/accounts/staff/register/', payload);
    const member = mapStaffFromApi(response.data?.user || response.data, _branchName);
    upsertStaffCache(member);
    return member;
}

/**
 * Builds the payload for editing an existing staff member.
 * Intentionally narrow: only role, branch, and active/inactive can change here.
 */
export function buildStaffUpdatePayload(form) {
    const branchId = Number(form.branch_id ?? form.branch);
    if (!branchId) {
        throw new Error('Branch is required. Select a branch for this staff member.');
    }
    return {
        role: form.role,
        branch_id: branchId,
        is_active: form.status !== 'inactive',
    };
}

/**
 * NOTE: adjust the URL below if your backend exposes staff updates under a
 * different path (e.g. `/accounts/staff/${id}/update/`) — this follows the
 * same REST convention used by the other partner resources in this app
 * (PATCH `/<domain>/partner/<resource>/<id>/`).
 */
export async function updateStaff(id, form, branches = []) {
    const payload = buildStaffUpdatePayload(form);
    const response = await $api.patch(`/accounts/staff/${id}/`, payload);
    const selectedBranch = branches.find((b) => Number(b.id) === payload.branch_id);
    const member = mapStaffFromApi(response.data?.user || response.data, selectedBranch?.name || '');
    upsertStaffCache(member);
    return member;
}