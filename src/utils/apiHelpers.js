export function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

export function slugify(name) {
    const s = String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return s || `item-${Date.now()}`;
}

export function getApiError(err) {
    const d = err?.response?.data;
    if (!d) return err?.message || 'Request failed';
    if (typeof d === 'string') return d;
    if (d.detail) return Array.isArray(d.detail) ? d.detail.join(', ') : String(d.detail);
    if (d.message) return String(d.message);
    if (d.non_field_errors) {
        return Array.isArray(d.non_field_errors) ? d.non_field_errors.join(', ') : String(d.non_field_errors);
    }
    const first = Object.entries(d).find(([, v]) => v != null);
    if (first) {
        const [k, v] = first;
        const msg = Array.isArray(v) ? v.join(', ') : String(v);
        return `${k}: ${msg}`;
    }
    return err?.message || 'Request failed';
}

export function isSlugConflictError(err) {
    const msg = getApiError(err).toLowerCase();
    return msg.includes('slug') && (msg.includes('exist') || msg.includes('unique') || msg.includes('already'));
}

export function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
}
