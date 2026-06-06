import { api } from './api';
import { useAppStore } from '../store/appStore';
import {
    mapBookingFromApi,
    mapBranchFromApi,
    mapFloorFromApi,
    mapTableFromApi,
} from './mappers';

/**
 * Loads real data from the partner API and replaces seed/localStorage data.
 * Called after login and on boot (token validation).
 * Handles both owner (full access) and manager (branch-scoped) roles.
 * Always fails silently — if API is unreachable we keep current state.
 */
export async function loadPartnerWorkspace() {
    try {
        // ── Branches ─────────────────────────────────────────────────────────
        let branchesRaw = [];
        try {
            branchesRaw = await api.getPartnerBranches();
        } catch (branchErr) {
            const status = branchErr?.response?.status;
            if (status === 403 || status === 401) {
                // Manager role — does not have access to list all branches.
                // Try fetching branch info from the user profile instead.
                try {
                    const profile = await api.getProfile();
                    // Profile may carry branch info in various shapes:
                    // { branch: {id, name, ...} }  OR  { branch_id: N, branch_name: "..." }
                    const pb = profile?.branch ?? profile?.branch_details ?? null;
                    if (pb && pb.id) {
                        branchesRaw = [pb];
                    } else if (profile?.branch_id) {
                        branchesRaw = [{ id: profile.branch_id, name: profile.branch_name || `Branch ${profile.branch_id}` }];
                    }
                } catch (_) {
                    // Can't determine branch — keep current store state
                    console.warn('[partnerSync] Could not determine manager branch from profile');
                    return;
                }
            } else {
                throw branchErr; // re-throw non-auth errors
            }
        }

        if (!branchesRaw.length) {
            console.warn('[partnerSync] No branches found for this account');
            return;
        }

        const branches = branchesRaw.map(mapBranchFromApi);

        const floors = [];
        const tables = [];

        for (const br of branches) {
            // ── Floors ────────────────────────────────────────────────────────
            let floorsList = [];

            // Helper: extract branch ID from partner floor response
            const getFloorBranchId = f => {
                const b = f.branch ?? f.branch_id;
                if (b == null) return '';
                if (typeof b === 'object') return String(b.id ?? '');
                return String(b);
            };

            try {
                // Try partner floors first
                const all = await api.getPartnerFloors();
                const filtered = all.filter(f => getFloorBranchId(f) === String(br.id));
                if (filtered.length > 0) {
                    floorsList = filtered;
                } else {
                    throw new Error('empty'); // fall through to public
                }
            } catch {
                try {
                    // Public endpoint is scoped to branchId — no filtering needed
                    floorsList = await api.getPublicFloors(br.id);
                } catch {
                    floorsList = [];
                }
            }

            const floorById = new Map();
            for (const f of floorsList) {
                const fl = mapFloorFromApi(f, br.id);
                floors.push(fl);
                floorById.set(fl.id, fl.name);
            }

            // ── Tables ────────────────────────────────────────────────────────
            let tablesList = [];
            try {
                tablesList = await api.getPartnerTables({ branch_id: br.id });
            } catch {
                tablesList = [];
            }

            // Fallback: try per-floor if branch-level returned nothing
            if (!tablesList.length && floorsList.length) {
                for (const fl of floorsList) {
                    try {
                        const sub = await api.getPartnerTables({ branch_id: br.id, floor_id: fl.id });
                        tablesList.push(...sub);
                    } catch { /* ignore */ }
                }
            }

            const seen = new Set();
            for (const t of tablesList) {
                if (seen.has(t.id)) continue;
                seen.add(t.id);
                const fid = t.floor ?? t.floor_id;
                const floorName = floorById.get(fid) || '';
                tables.push(mapTableFromApi(t, br.id, floorName));
            }
        }

        // ── Bookings ──────────────────────────────────────────────────────────
        let bookingsRaw = [];
        try {
            bookingsRaw = await api.getPartnerBookings();
        } catch {
            bookingsRaw = [];
        }
        const bookings = bookingsRaw.map(mapBookingFromApi);

        // ── Push to store ─────────────────────────────────────────────────────
        useAppStore.getState().replacePartnerDataset({ branches, floors, tables, bookings });
        console.info('[partnerSync] Loaded:', { branches: branches.length, tables: tables.length, bookings: bookings.length });

    } catch (err) {
        // Fail silently — current store snapshot remains
        console.warn('[partnerSync] Workspace load failed:', err?.message);
    }
}