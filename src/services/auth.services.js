import $api from '../config/api.config';

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

        return response.data;
    },

    logout() {
        localStorage.removeItem('rp_access');
        localStorage.removeItem('rp_refresh');
        localStorage.removeItem('token');
    }
};

export default AuthService;