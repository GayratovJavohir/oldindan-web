import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getApiError as formatApiError } from '../../services/api';
import { loadPartnerWorkspace } from '../../services/partnerSync';
import { normalizeRole } from '../../services/mappers';

const ACCESS_KEY = 'rp_access';
const REFRESH_KEY = 'rp_refresh';
const USER_KEY = 'rp_user';

function mapProfile(p) {
    if (!p) return null;
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
        || p.username || p.email || 'Partner';
    const rawRole = p.role || p.user_type || p.user_role || p.type || 'manager';
    return {
        id:         p.id,
        name,
        first_name: p.first_name || '',
        last_name:  p.last_name  || '',
        email:      p.email      || '',
        phone:      p.phone      || '',
        role:       normalizeRole(rawRole),
        rawRole,
        bio:        p.bio,
    };
}

function getAccessToken(data) {
    return data?.access || data?.access_token || data?.token || data?.tokens?.access || null;
}

function getRefreshToken(data) {
    return data?.refresh || data?.refresh_token || data?.tokens?.refresh || null;
}

function isAuthError(err) {
    const s = err?.response?.status;
    return s === 401 || s === 403;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });
    const [authReady, setAuthReady] = useState(false);

    // Wire up the global auth-failure handler (called by api.js interceptor)
    useEffect(() => {
        api.setAuthFailureHandler(() => setUser(null));
        return () => api.setAuthFailureHandler(null);
    }, []);

    // ── On mount: validate / refresh stored token ─────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const storedAccess = localStorage.getItem(ACCESS_KEY);

            if (!storedAccess) {
                // No token at all → go to login
                api.clearToken();
                if (!cancelled) setAuthReady(true);
                return;
            }

            // Ensure axios has the token before the first request
            api.setToken(storedAccess);

            try {
                // ── Step 1: try current access token ──────────────────────────
                const profile = await api.getProfile();
                if (cancelled) return;
                const u = mapProfile(profile);
                setUser(u);
                localStorage.setItem(USER_KEY, JSON.stringify(u));
                loadPartnerWorkspace().catch(() => {});

            } catch (firstErr) {
                if (cancelled) return;

                if (!isAuthError(firstErr)) {
                    // 5xx / network error → keep cached user, don't force logout
                    console.warn('[Auth] /me/ failed (non-auth), keeping session:', firstErr?.message);
                    return; // setAuthReady in finally
                }

                // ── Step 2: access token expired → try refresh ────────────────
                try {
                    await api.tryRefreshToken();
                    // api.js already updated localStorage + axios header internally
                    const profile2 = await api.getProfile();
                    if (cancelled) return;
                    const u = mapProfile(profile2);
                    setUser(u);
                    localStorage.setItem(USER_KEY, JSON.stringify(u));
                    loadPartnerWorkspace().catch(() => {});

                } catch (refreshErr) {
                    if (cancelled) return;

                    if (!isAuthError(refreshErr)) {
                        // Refresh endpoint 5xx → keep session alive
                        console.warn('[Auth] refresh failed (non-auth), keeping session:', refreshErr?.message);
                        return;
                    }

                    // Definitive auth failure → clear everything
                    localStorage.removeItem(ACCESS_KEY);
                    localStorage.removeItem(REFRESH_KEY);
                    localStorage.removeItem(USER_KEY);
                    api.clearToken();
                    setUser(null);
                }
            } finally {
                if (!cancelled) setAuthReady(true);
            }
        })();

        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = useCallback(async (email, password) => {
        const data    = await api.partnerLogin(email, password);
        const access  = getAccessToken(data);
        const refresh = getRefreshToken(data);

        if (!access) throw new Error('Login response did not return an access token.');

        localStorage.setItem(ACCESS_KEY, access);
        if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
        api.setToken(access);

        // Use profile from login response if present, otherwise fetch
        const profile = data.user ? data.user : await api.getProfile();
        const u = mapProfile(profile);
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        loadPartnerWorkspace().catch(() => {});
        return u;
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('rp_token');
        api.clearToken();
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, authReady, getApiError: formatApiError }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);