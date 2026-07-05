import $api from '../config/api.config';

export const getOccupiedTables = async (params) => { 
    const response = await $api.get('/bookings/partner/occupied-tables/', { params }); 
    return response.data;
};

export const getPartnerBookings = async (params) => {
    const response = await $api.get('/bookings/partner/', { params });
    return response.data;
};