import $api from '../config/api.config';

const STAFF_CACHE_KEY = 'rp_staff_cache';

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
    localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(list));
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
export async function getStaffList() {
    return readStaffCache();
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
