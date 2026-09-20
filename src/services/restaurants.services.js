import $api from '../config/api.config';
import { formatDate, slugify, unwrapList } from '../utils/apiHelpers';

export function mapBrandFromApi(brand, branchCount = 0) {
    const owner = brand.owner_name
        || brand.owner?.full_name
        || [brand.owner?.first_name, brand.owner?.last_name].filter(Boolean).join(' ')
        || brand.owner_email
        || '—';

    return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug || '',
        description: brand.description || '',
        owner,
        branches: brand.branches_count ?? brand.branch_count ?? branchCount,
        created: formatDate(brand.created_at || brand.created),
        raw: brand,
    };


}

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABELS = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
};

export function emptyHoursSchedule() {
    return WEEKDAY_KEYS.reduce((acc, day) => {
        acc[day] = { enabled: false, open: '10:00', close: '22:00' };
        return acc;
    }, {});
}

/** API JSON `{ mon: ["10:00","22:00"] }` → UI schedule */
export function hoursFromApi(hours) {
    const schedule = emptyHoursSchedule();
    if (!hours || typeof hours !== 'object') return schedule;
    WEEKDAY_KEYS.forEach((day) => {
        const slot = hours[day];
        if (Array.isArray(slot) && slot.length >= 2 && slot[0] && slot[1]) {
            schedule[day] = {
                enabled: true,
                open: String(slot[0]).slice(0, 5),
                close: String(slot[1]).slice(0, 5),
            };
        }
    });
    return schedule;
}

/** UI schedule → API JSON (faqat enabled kunlar) */
export function hoursToApi(schedule) {
    const result = {};
    WEEKDAY_KEYS.forEach((day) => {
        const row = schedule?.[day];
        if (!row?.enabled || !row.open || !row.close) return;
        result[day] = [row.open, row.close];
    });
    return result;
}

export function defaultWorkingHoursSchedule() {
    const schedule = emptyHoursSchedule();
    WEEKDAY_KEYS.forEach((day) => {
        schedule[day] = { enabled: true, open: '10:00', close: '22:00' };
    });
    return schedule;
}

export function mapBranchFromApi(branch) {
    const brandId = branch.brand_id ?? branch.brand?.id ?? branch.brand ?? null;
    return {
        id: branch.id,
        name: branch.name,
        slug: branch.slug || '',
        status: branch.is_active === false ? 'Inactive' : 'Active',
        location: branch.address || '',
        phone: branch.phone || '',
        floors: branch.floors_count ?? branch.floor_count ?? 0,
        tables: branch.tables_count ?? branch.table_count ?? 0,
        fee: branch.service_fee ?? 0,
        hasDeposit: Boolean(branch.deposit_enabled),
        depositAmount: branch.deposit_amount ?? 0,
        brandId,
        latitude: branch.latitude,
        longitude: branch.longitude,
        is_active: branch.is_active !== false,
        workingHours: hoursFromApi(branch.working_hours),
        bookingHours: hoursFromApi(branch.booking_hours),
        raw: branch,
    };
}

export async function getPartnerBrands() {
    const response = await $api.get('/restaurants/partner/brands/');
    return unwrapList(response.data).map((brand) => mapBrandFromApi(brand));
}

export async function createPartnerBrand(payload) {
    const response = await $api.post('/restaurants/partner/brands/create/', payload);
    return mapBrandFromApi(response.data);
}

export async function createPartnerBrandWithUniqueSlug(name, description = '') {
    const baseSlug = slugify(name);
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
        const candidateName = attempt === 0 ? name : `${name} ${attempt + 1}`;
        try {
            return await createPartnerBrand({
                name: candidateName.trim(),
                slug,
                description: description || `${candidateName.trim()} brand`,
            });
        } catch (err) {
            lastErr = err;
            const msg = String(err?.response?.data?.slug || err?.response?.data?.name || '').toLowerCase();
            if (!msg.includes('exist') && !msg.includes('unique') && !msg.includes('already')) {
                throw err;
            }
        }
    }
    throw lastErr || new Error('Brand slug conflict');
}

export async function getPartnerBranches() {
    const response = await $api.get('/restaurants/partner/branches/');
    return unwrapList(response.data).map(mapBranchFromApi);
}

export async function getPartnerBranch(id) {
    const response = await $api.get(`/restaurants/partner/branches/${id}/`);
    return mapBranchFromApi(response.data);
}

export async function createPartnerBranch(payload) {
    const response = await $api.post('/restaurants/partner/branches/create/', payload);
    return mapBranchFromApi(response.data);
}

export async function createPartnerBranchWithUniqueSlug(payload) {
    const baseSlug = slugify(payload.name);
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
        try {
            return await createPartnerBranch({ ...payload, slug });
        } catch (err) {
            lastErr = err;
            const msg = String(err?.response?.data?.slug || '').toLowerCase();
            if (!msg.includes('exist') && !msg.includes('unique') && !msg.includes('already')) {
                throw err;
            }
        }
    }
    throw lastErr || new Error('Branch slug conflict');
}

export async function patchPartnerBranch(id, payload) {
    const response = await $api.patch(`/restaurants/partner/branches/${id}/`, payload);
    return mapBranchFromApi(response.data);
}
