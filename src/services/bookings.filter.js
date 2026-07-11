const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const parsedDate = new Date(dateStr);
    return isNaN(parsedDate) ? null : parsedDate.setHours(0, 0, 0, 0);
};

/**
 * @param {Array} bookings 
 * @param {Object} filters 
 */
export const filterBookingsData = (bookings, filters) => {
    if (!bookings || !Array.isArray(bookings)) return [];

    const { search, status, start_date, end_date } = filters;

    return bookings.filter(booking => {
        if (search) {
            const searchLower = search.toLowerCase().trim();
            const guestName = (booking.guest_name || booking.guestName || '').toLowerCase();
            const phone = (booking.phone || '').toLowerCase();

            if (!guestName.includes(searchLower) && !phone.includes(searchLower)) {
                return false;
            }
        }

        if (status && status !== '') {
            if (booking.status !== status) {
                return false;
            }
        }

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