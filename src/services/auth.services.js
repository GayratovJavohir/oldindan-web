import $api from '../config/api.config';

const AuthService = {
    async login(email, password) {
        const response = await $api.post('/accounts/owner/login/', { email, password });


        const token = response.data.token || response.data.access || response.data.key;

        if (token) {
            localStorage.setItem('token', token);
            console.log("Token successfully saved to local storage.", token);
        } else {
            console.error("There is no found token in the response.");
        }

        return response.data;
    },

    logout() {
        localStorage.removeItem('token');
    }
};

export default AuthService;