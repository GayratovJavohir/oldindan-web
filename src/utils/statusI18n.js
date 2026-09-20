/** Map UI booking/table status labels to i18n keys under `status.*` */
export function statusI18nKey(status) {
    const raw = String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    // FIX: the object previously declared `canceled` twice. The second
    // declaration ("cancelled") silently overwrote the first one and pointed at
    // `status.cancelled`, an i18n key that does not exist in uz/en/ru — so every
    // canceled booking rendered the raw key instead of a translation.
    const map = {
        available: 'available',
        pending: 'pending',
        confirmed: 'confirmed',
        checked_in: 'checkedIn',
        checkedin: 'checkedIn',
        completed: 'completed',
        canceled: 'canceled',
        cancelled: 'canceled',
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

/** CSS-module-safe suffix for a status ("Checked In" -> "checked_in"). */
export function statusSlug(status) {
    return String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}
