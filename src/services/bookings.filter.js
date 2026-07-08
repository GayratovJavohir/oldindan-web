// src/utils/bookings.filter.js

/**
 * Matnli sanani (masalan: "09 Jun 2026" yoki "2026-06-09") taqqoslash uchun timestamp ko'rinishiga o'tkazadi
 */
const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const parsedDate = new Date(dateStr);
    return isNaN(parsedDate) ? null : parsedDate.setHours(0, 0, 0, 0);
};

/**
 * Barcha bronlyarni filtrlovchi asosiy funksiya
 * @param {Array} bookings - Backend yoki Statedan kelgan massiv
 * @param {Object} filters - { search, status, start_date, end_date }
 */
export const filterBookingsData = (bookings, filters) => {
    if (!bookings || !Array.isArray(bookings)) return [];

    const { search, status, start_date, end_date } = filters;

    return bookings.filter(booking => {
        // 1. Qidiruv filtri (Ism yoki Telefon raqami bo'yicha)
        if (search) {
            const searchLower = search.toLowerCase().trim();
            const guestName = (booking.guest_name || booking.guestName || '').toLowerCase();
            const phone = (booking.phone || '').toLowerCase();

            if (!guestName.includes(searchLower) && !phone.includes(searchLower)) {
                return false;
            }
        }

        // 2. Status filtri
        if (status && status !== '') {
            if (booking.status !== status) {
                return false;
            }
        }

        // 3. Sana oralig'i filtri (Start Date va End Date)
        const bookingTimestamp = normalizeDate(booking.date);

        if (start_date && bookingTimestamp) {
            const startTimestamp = new Date(start_date).setHours(0, 0, 0, 0);
            if (bookingTimestamp < startTimestamp) {
                return false;
            }
        }

        if (end_date && bookingTimestamp) {
            const endTimestamp = new Date(end_date).setHours(23, 59, 59, 999);
            if (bookingTimestamp > endTimestamp) {
                return false;
            }
        }

        return true;
    });
};