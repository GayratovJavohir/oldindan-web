const USER_KEY = 'rp_user';
const ACCOUNT_TYPE_KEY = 'rp_account_type';

export function normalizeRole(role, accountType = null) {
    const r = String(role || '').toLowerCase();
    if (r.includes('owner') || r.includes('admin') || r.includes('super')) return 'owner';
    if (r.includes('manager')) return 'manager';
    if (r.includes('reception')) return 'receptionist';
    if (accountType === 'owner') return 'owner';
    if (accountType === 'staff') return 'receptionist';
    return 'manager';
}

export function mapProfile(profile, accountType = null) {
    if (!profile) return null;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
        || profile.username
        || profile.email
        || 'Partner';
    const rawRole = profile.role || profile.user_type || profile.user_role || profile.type || '';
    const branchId = profile.branch_id ?? profile.branch?.id ?? profile.branch ?? null;

    return {
        id: profile.id,
        name,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        role: normalizeRole(rawRole, accountType),
        rawRole,
        branchId,
        accountType: accountType || getAccountType(),
    };
}

export function getAccountType() {
    return localStorage.getItem(ACCOUNT_TYPE_KEY) || 'owner';
}

export function setAccountType(type) {
    if (type) localStorage.setItem(ACCOUNT_TYPE_KEY, type);
    else localStorage.removeItem(ACCOUNT_TYPE_KEY);
}

export function getStoredUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setStoredUser(user) {
    if (!user) {
        localStorage.removeItem(USER_KEY);
        return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACCOUNT_TYPE_KEY);
}

export function isOwner() {
    return getStoredUser()?.role === 'owner';
}

export function canManageStaff() {
    return isOwner();
}

export function canCreateManualBooking() {
    return getStoredUser()?.role === 'receptionist';
}

export const ROUTE_ACCESS = {
    '/dashboard': ['owner', 'manager'],
    '/bookings': ['owner', 'manager', 'receptionist'],
    '/manual-bookings': ['receptionist'],
    '/live-view': ['owner', 'manager'],
    '/floor-layout': ['owner', 'manager'],
    '/tables': ['owner', 'manager'],
    '/branches': ['owner'],
    '/brands': ['owner'],
    '/staff': ['owner'],
    '/notifications': ['owner', 'manager', 'receptionist'],
    '/profile': ['owner', 'manager', 'receptionist'],
};

export function canAccessRoute(path, role) {
    const base = Object.keys(ROUTE_ACCESS).find((route) => path === route || path.startsWith(`${route}/`));
    if (!base) return true;
    return ROUTE_ACCESS[base].includes(role);
}

export function getDefaultRouteForRole(role) {
    if (role === 'receptionist') return '/bookings';
    return '/dashboard';
}
