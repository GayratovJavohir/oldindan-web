import axios from 'axios';

const rawBase = import.meta.env.VITE_API_BASE_URL;
let API_URL = rawBase && rawBase.trim() ? rawBase.trim() : '/api';
if (!API_URL.endsWith('/')) API_URL += '/';

const ACCESS_KEY = 'rp_access';
const REFRESH_KEY = 'rp_refresh';
const LEGACY_TOKEN_KEY = 'token';

const REFRESH_ENDPOINTS = [
    'accounts/token/refresh/',
    'accounts/owner/token/refresh/',
    'accounts/staff/token/refresh/',
    'accounts/partner/token/refresh/',
    'token/refresh/',
];

let refreshPromise = null;

function getStoredAccessToken() {
    return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || null;
}

function getStoredRefreshToken() {
    return localStorage.getItem(REFRESH_KEY) || null;
}

function storeAccessToken(token) {
    if (!token) return;
    localStorage.setItem(ACCESS_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_KEY, token);
}

function storeRefreshToken(token) {
    if (!token) return;
    localStorage.setItem(REFRESH_KEY, token);
}

function clearStoredTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function extractAccessToken(data) {
    return data?.access || data?.access_token || data?.token || data?.tokens?.access || null;
}

function extractRefreshToken(data) {
    return data?.refresh || data?.refresh_token || data?.tokens?.refresh || null;
}

const $api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

async function tryRefreshToken() {
    // FIX: the old version cleared `refreshPromise` in a `finally` attached to
    // the *first* caller only, so a second request that arrived while the
    // refresh was still in flight could kick off a duplicate refresh round.
    // The reset now lives on the shared promise itself.
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refresh = getStoredRefreshToken();
        if (!refresh) {
            throw new Error('Refresh token missing');
        }

        const payloadVariants = [
            { refresh },
            { refresh_token: refresh },
            { token: refresh },
        ];

        let lastError = null;
        for (const endpoint of REFRESH_ENDPOINTS) {
            for (const payload of payloadVariants) {
                try {
                    const response = await axios.post(`${API_URL}${endpoint}`, payload, {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    const nextAccess = extractAccessToken(response.data);
                    if (!nextAccess) {
                        throw new Error(`No access token returned by ${endpoint}`);
                    }
                    storeAccessToken(nextAccess);
                    const nextRefresh = extractRefreshToken(response.data);
                    if (nextRefresh) storeRefreshToken(nextRefresh);
                    return nextAccess;
                } catch (err) {
                    lastError = err;
                }
            }
        }
        throw lastError || new Error('Token refresh failed');
    })();

    refreshPromise.catch(() => { }).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

function forceLogout() {
    clearStoredTokens();
    localStorage.removeItem('rp_user');
    localStorage.removeItem('rp_account_type');
    if (window.location.pathname !== '/login') {
        window.location.replace('/login');
    }
}

$api.interceptors.request.use((config) => {
    const token = getStoredAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

$api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error?.config;
        const status = error?.response?.status;

        if (status !== 401 || !originalRequest || originalRequest._retry || originalRequest._skipAuthRefresh) {
            return Promise.reject(error);
        }

        try {
            originalRequest._retry = true;
            const newAccess = await tryRefreshToken();
            originalRequest.headers = {
                ...(originalRequest.headers || {}),
                Authorization: `Bearer ${newAccess}`,
            };
            return $api(originalRequest);
        } catch (refreshError) {
            // FIX: previously only 400/401/403 triggered a logout. When the
            // refresh token was simply missing (a local `Error`, no HTTP
            // response) the tokens stayed in localStorage, so the app kept
            // looking "logged in" while every request 401'd forever.
            // Any failed refresh now ends the session.
            forceLogout();
            return Promise.reject(refreshError);
        }
    }
);

export default $api;