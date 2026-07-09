import $api from '../config/api.config';
import { mapProfile, setStoredUser, clearStoredUser } from '../utils/authUser';

const AuthService = {
    async login(email, password) {
        const response = await $api.post('/accounts/partner/login/', { email, password });
        const access = response.data?.access || response.data?.access_token || response.data?.token || response.data?.tokens?.access;
        const refresh = response.data?.refresh || response.data?.refresh_token || response.data?.tokens?.refresh;

        if (access) {
            localStorage.setItem('rp_access', access);
            localStorage.setItem('token', access);
        }
        if (refresh) {
            localStorage.setItem('rp_refresh', refresh);
        }

        const profile = response.data?.user || (await AuthService.getProfile());
        if (profile) {
            setStoredUser(mapProfile(profile));
        }

        return response.data;
    },

    async getProfile() {
        const response = await $api.get('/accounts/me/');
        return response.data;
    },

    logout() {
        localStorage.removeItem('rp_access');
        localStorage.removeItem('rp_refresh');
        localStorage.removeItem('token');
        clearStoredUser();
    }
};

export default AuthService;