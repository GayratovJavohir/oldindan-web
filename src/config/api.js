const rawBase = import.meta.env.VITE_API_BASE_URL;
let base = rawBase && rawBase.trim()
    ? rawBase.trim()
    : '/api';

if (!base.endsWith('/')) base += '/';

export const API_BASE_URL = base;
console.log("API_BASE_URL:", API_BASE_URL);