const USER_KEY = 'rp_user';

export function normalizeRole(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('owner') || r.includes('admin') || r.includes('super')) return 'owner';
    if (r.includes('manager')) return 'manager';
    if (r.includes('reception') || r.includes('staff')) return 'receptionist';
    return 'manager';
}

export function mapProfile(profile) {
    if (!profile) return null;
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
        || profile.username
        || profile.email
        || 'Partner';
    const rawRole = profile.role || profile.user_type || profile.user_role || profile.type || 'manager';
    return {
        id: profile.id,
        name,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        role: normalizeRole(rawRole),
        rawRole,
    };
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
}

export function isOwner() {
    return getStoredUser()?.role === 'owner';
}

export function canManageStaff() {
    const role = getStoredUser()?.role;
    return role === 'owner' || role === 'manager';
}
