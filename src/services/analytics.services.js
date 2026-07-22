import { getOccupiedTables, getPartnerBookings } from './bookings.services';
import { getPartnerTables } from './tables.services';

function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function countByStatus(bookings, status) {
    const needle = String(status).toLowerCase().replace(/\s+/g, '_');
    return bookings.filter((b) => {
        const raw = String(b.status || '').toLowerCase().replace(/\s+/g, '_');
        return raw === needle || raw.includes(needle);
    }).length;
}

export async function fetchBranchDayStats(branchId, date = todayStr()) {
    const tableParams = {
        branch_id: branchId,
        booking_start: `${date} 00:00:00`,
        booking_end: `${date} 23:59:59`,
    };

    const [occupiedData, bookingsPayload, tablesData] = await Promise.all([
        getOccupiedTables(tableParams).catch(() => []),
        getPartnerBookings({ date, branch_id: branchId }).catch(() => ({ results: [] })),
        getPartnerTables(branchId).catch(() => []),
    ]);

    const bookings = unwrapList(bookingsPayload);
    const occupied = unwrapList(occupiedData).filter((row) => row.is_occupied).length;
    const totalTables = unwrapList(tablesData).length;
    const utilization = totalTables > 0 ? Math.round((occupied / totalTables) * 100) : 0;

    return {
        branchId,
        date,
        bookingsTotal: bookings.length,
        pending: countByStatus(bookings, 'pending'),
        confirmed: countByStatus(bookings, 'confirmed'),
        completed: countByStatus(bookings, 'completed'),
        canceled: countByStatus(bookings, 'canceled'),
        noShows: countByStatus(bookings, 'no_show'),
        occupied,
        totalTables,
        utilization,
        bookings,
    };
}

export async function fetchBranchesDayStats(branches, date = todayStr()) {
    const results = await Promise.all(
        branches.map((branch) =>
            fetchBranchDayStats(branch.id, date).catch(() => ({
                branchId: branch.id,
                branchName: branch.name,
                date,
                bookingsTotal: 0,
                pending: 0,
                confirmed: 0,
                completed: 0,
                canceled: 0,
                noShows: 0,
                occupied: 0,
                totalTables: 0,
                utilization: 0,
                bookings: [],
            }))
        )
    );

    return results.map((stat, index) => ({
        ...stat,
        branchName: branches[index]?.name || `Branch #${stat.branchId}`,
        brandId: branches[index]?.brandId ?? null,
    }));
}

export function aggregateStats(branchStats) {
    const totals = branchStats.reduce(
        (acc, stat) => ({
            bookingsTotal: acc.bookingsTotal + stat.bookingsTotal,
            pending: acc.pending + stat.pending,
            confirmed: acc.confirmed + stat.confirmed,
            completed: acc.completed + stat.completed,
            canceled: acc.canceled + stat.canceled,
            noShows: acc.noShows + stat.noShows,
            occupied: acc.occupied + stat.occupied,
            totalTables: acc.totalTables + stat.totalTables,
        }),
        {
            bookingsTotal: 0,
            pending: 0,
            confirmed: 0,
            completed: 0,
            canceled: 0,
            noShows: 0,
            occupied: 0,
            totalTables: 0,
        }
    );

    totals.utilization = totals.totalTables > 0
        ? Math.round((totals.occupied / totals.totalTables) * 100)
        : 0;

    return totals;
}

export function groupStatsByBrand(branchStats, brands) {
    return brands.map((brand) => {
        const brandBranches = branchStats.filter((s) => String(s.brandId) === String(brand.id));
        return {
            brand,
            branches: brandBranches,
            totals: aggregateStats(brandBranches),
        };
    });
}
