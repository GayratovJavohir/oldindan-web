import $api from '../config/api.config';
import {
    mapProfile,
    setStoredUser,
    clearStoredUser,
    setAccountType,
    getAccountType,
} from '../utils/authUser';
import { getApiError } from '../utils/apiHelpers';

const LOGIN_ENDPOINTS = {
    owner: '/accounts/owner/login/',
    staff: '/accounts/staff/login/',
};

function storeTokens(data) {
    const access = data?.access || data?.access_token || data?.token || data?.tokens?.access;
    const refresh = data?.refresh || data?.refresh_token || data?.tokens?.refresh;

    if (access) {
        localStorage.setItem('rp_access', access);
        localStorage.setItem('token', access);
    }
    if (refresh) {
        localStorage.setItem('rp_refresh', refresh);
    }
    return access;
}

const AuthService = {
    async login(email, password, accountType = 'owner') {
        const endpoint = LOGIN_ENDPOINTS[accountType] || LOGIN_ENDPOINTS.owner;

        try {
            const response = await $api.post(endpoint, { email, password });
            const access = storeTokens(response.data);
            if (!access) {
                throw new Error('Login response did not return an access token.');
            }

            setAccountType(accountType);

            let profile = response.data?.user || null;
            if (!profile) {
                try {
                    profile = await AuthService.getProfile();
                } catch {
                    profile = { email, role: accountType === 'owner' ? 'owner' : 'receptionist' };
                }
            }

            setStoredUser(mapProfile(profile, accountType));
            return response.data;
        } catch (err) {
            throw new Error(getApiError(err));
        }
    },

    async getProfile() {
        const response = await $api.get('/accounts/me/');
        const user = mapProfile(response.data, getAccountType());
        setStoredUser(user);
        return response.data;
    },

    async updateProfile(payload) {
        try {
            const response = await $api.patch('/accounts/me/', payload);
            const user = mapProfile(response.data, getAccountType());
            setStoredUser(user);
            return response.data;
        } catch (err) {
            throw new Error(getApiError(err));
        }
    },

    logout() {
        localStorage.removeItem('rp_access');
        localStorage.removeItem('rp_refresh');
        localStorage.removeItem('token');
        clearStoredUser();
    },
};

export default AuthService;
