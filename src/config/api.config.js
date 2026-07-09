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

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
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
            const refreshStatus = refreshError?.response?.status ?? 0;
            if ([400, 401, 403].includes(refreshStatus)) {
                clearStoredTokens();
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
            return Promise.reject(refreshError);
        }
    }
);

export default $api;