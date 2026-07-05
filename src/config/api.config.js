import axios from 'axios'

const API_URL = 'http://localhost:8000/api';

const $api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

$api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        console.warn("There is no found token in local storage.");
    }

    console.log(`Sending headers.`, config.headers);
    return config;
});

$api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("error:", error.response?.data);

        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default $api;