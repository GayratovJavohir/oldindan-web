import $api from '../config/api.config';

export const getPartnerTables = async (branchId) => {
    const response = await $api.get('/tables/partner/tables/', {
        params: { branch_id: branchId }
    });
    return response.data;
};