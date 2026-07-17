/** Map UI booking/table status labels to i18n keys under `status.*` */
export function statusI18nKey(status) {
    const raw = String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    const map = {
        available: 'available',
        pending: 'pending',
        confirmed: 'confirmed',
        checked_in: 'checkedIn',
        checkedin: 'checkedIn',
        completed: 'completed',
        cancelled: 'canceled',
        canceled: 'canceled',
        no_show: 'noShow',
        noshow: 'noShow',
        occupied: 'occupied',
        active: 'active',
        inactive: 'inactive',
    };
    return map[raw] || null;
}

export function translateStatus(t, status) {
    const key = statusI18nKey(status);
    if (!key) return status || '—';
    return t(`status.${key}`);
}
