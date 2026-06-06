import http, { setAuthToken } from './http';
import { unwrapList } from './mappers';

const ACCESS_KEY  = 'rp_access';
const REFRESH_KEY = 'rp_refresh';
const USER_KEY    = 'rp_user';

const REFRESH_ENDPOINT = 'token/refresh/';   

let refreshPromise     = null;
let authFailureHandler = null;

function isUnauthorized(err) {
    return err?.response?.status === 401;
}

function isHardAuthFailure(status) {
    return status === 401 || status === 403;
}

function extractAccessToken(payload) {
    return payload?.access || payload?.access_token || payload?.token || null;
}

function extractRefreshToken(payload) {
    return payload?.refresh || payload?.refresh_token || null;
}

export function clearStoredAuth() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('rp_token');
    setAuthToken(null);
}

async function requestTokenRefresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refresh = localStorage.getItem(REFRESH_KEY);
        if (!refresh) throw new Error('No refresh token stored');

        const { data } = await http.post(
            REFRESH_ENDPOINT,
            { refresh },
            { _skipAuthRefresh: true }
        );

        const nextAccess = extractAccessToken(data);
        if (!nextAccess) throw new Error('Refresh response missing access token');

        const nextRefresh = extractRefreshToken(data) || refresh;
        localStorage.setItem(ACCESS_KEY,  nextAccess);
        localStorage.setItem(REFRESH_KEY, nextRefresh);
        setAuthToken(nextAccess);
        return nextAccess;
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

http.interceptors.response.use(
    res => res,
    async (error) => {
        const original = error?.config;
        if (!original || !isUnauthorized(error)) return Promise.reject(error);
        if (original._retry || original._skipAuthRefresh) return Promise.reject(error);

        original._retry = true;
        try {
            const newAccess = await requestTokenRefresh();
            original.headers = {
                ...(original.headers || {}),
                Authorization: `Bearer ${newAccess}`,
            };
            return http(original);
        } catch (refreshErr) {
            const status = refreshErr?.response?.status ?? 0;
            if (isHardAuthFailure(status)) {
                clearStoredAuth();
                authFailureHandler?.(refreshErr);
            }
            return Promise.reject(refreshErr);
        }
    }
);

// ── Restore token on page load ────────────────────────────────────────────────
const _stored = localStorage.getItem(ACCESS_KEY);
if (_stored) setAuthToken(_stored);

// ── Error formatter ───────────────────────────────────────────────────────────
export function getApiError(err) {
    const d = err?.response?.data;
    if (!d) return err?.message || 'Request failed';
    if (typeof d === 'string') return d;
    if (d.detail) return Array.isArray(d.detail) ? d.detail.join(', ') : String(d.detail);
    if (d.message) return String(d.message);
    if (d.non_field_errors)
        return Array.isArray(d.non_field_errors)
            ? d.non_field_errors.join(', ')
            : String(d.non_field_errors);
    if (typeof d === 'object') {
        const entries = Object.entries(d).filter(([, v]) => v != null);
        if (entries.length)
            return entries
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                .join(' | ');
    }
    return err?.message || 'Request failed';
}

export const api = {
    setAuthFailureHandler(handler) {
        authFailureHandler = typeof handler === 'function' ? handler : null;
    },
    async tryRefreshToken() { return requestTokenRefresh(); },
    setToken(token)  { setAuthToken(token || null); },
    clearToken()     { setAuthToken(null); },

    async partnerLogin(email, password) {
        const { data } = await http.post('accounts/partner/login/', { email, password });
        return data;
    },
    async getProfile() {
        const { data } = await http.get('accounts/me/');
        return data;
    },
    async updateProfile(payload) {
        const { data } = await http.patch('accounts/me/', payload);
        return data;
    },

    async getPartnerBranches() {
        const { data } = await http.get('restaurants/partner/branches/');
        return unwrapList(data);
    },
    async getPartnerBranch(id) {
        const { data } = await http.get(`restaurants/partner/branches/${id}/`);
        return data;
    },
    async createPartnerBranch(payload) {
        const { data } = await http.post('restaurants/partner/branches/create/', payload);
        return data;
    },
    async patchPartnerBranch(id, payload) {
        const { data } = await http.patch(`restaurants/partner/branches/${id}/`, payload);
        return data;
    },
    async getPartnerBrands() {
        const { data } = await http.get('restaurants/partner/brands/');
        return unwrapList(data);
    },
    async createPartnerBrand(payload) {
        const { data } = await http.post('restaurants/partner/brands/create/', payload);
        return data;
    },

    async getPublicFloors(branchId) {
        const { data } = await http.get(`layouts/branches/${branchId}/floors/`);
        return unwrapList(data);
    },
    async getPartnerFloors() {
        const { data } = await http.get('layouts/partner/floors/');
        return unwrapList(data);
    },
    async createFloor(payload) {
        const { data } = await http.post('layouts/partner/floors/create/', payload);
        return data;
    },
    async patchFloor(id, payload) {
        const { data } = await http.patch(`layouts/partner/floors/${id}/`, payload);
        return data;
    },

    async createZone(payload) {
        const { data } = await http.post('layouts/partner/zones/create/', payload);
        return data;
    },
    async deleteZone(id) {
        await http.delete(`layouts/partner/zones/${id}/`);
    },

    async getPartnerLayoutItems(params) {
        const { data } = await http.get('layouts/partner/layout-items/', { params });
        return unwrapList(data);
    },
    async createLayoutItem(payload) {
        const { data } = await http.post('layouts/partner/layout-items/create/', payload);
        return data;
    },
    async patchLayoutItem(id, payload) {
        const { data } = await http.patch(`layouts/partner/layout-items/${id}/`, payload);
        return data;
    },
    async deleteLayoutItem(id) {
        await http.delete(`layouts/partner/layout-items/${id}/`);
    },

    // Tables
    async getPartnerTables(params) {
        const { data } = await http.get('tables/partner/tables/', { params });
        return unwrapList(data);
    },
    async getPartnerTable(id) {
        const { data } = await http.get(`tables/partner/tables/${id}/`);
        return data;
    },
    async createTable(payload) {
        const { data } = await http.post('tables/partner/tables/create/', payload);
        return data;
    },
    async patchTable(id, payload) {
        const { data } = await http.patch(`tables/partner/tables/${id}/`, payload);
        return data;
    },
    async deleteTable(id) {
        await http.delete(`tables/partner/tables/${id}/`);
    },

    // Bookings
    async getPartnerBookings(params = {}) {
        const { data } = await http.get('bookings/partner/', { params });
        return unwrapList(data);
    },
    async getPartnerBooking(id) {
        const { data } = await http.get(`bookings/partner/${id}/`);
        return data;
    },
    async partnerManualBooking(payload) {
        const { data } = await http.post('bookings/partner/manual-create/', payload);
        return data;
    },
    async partnerBookingStatus(id, status, note = '') {
        const { data } = await http.post(`bookings/partner/${id}/status/`, { status, note });
        return data;
    },
    async getOccupiedTables(params) {
        const { data } = await http.get('bookings/partner/occupied-tables/', { params });
        return unwrapList(data);
    },
};