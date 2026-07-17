import React, { useState, useEffect, useMemo } from 'react';
import styles from './Dashboard.module.css';
import PageHeader from '../../../components/header/PageHeader';
import StatCard from './components/StatCard';
import UpcomingBookings from './components/UpcomingBookings';
import StatusBreakdown from './components/StatusBreakdown';
import RecentNotifications from './components/RecentNotifications';
import BrandBranchSelect from '../../../components/BrandBranchSelect';

import { getOccupiedTables, getPartnerBookings } from '../../../services/bookings.services';
import { loadTablesForBranch } from '../../../services/tables.services';
import { getStoredUser } from '../../../utils/authUser';
import { unwrapList } from '../../../utils/apiHelpers';

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';

    const [brandId, setBrandId] = useState('');
    const [branchId, setBranchId] = useState(assignedBranchId);
    const [bookingsList, setBookingsList] = useState([]);
    const [occupiedTables, setOccupiedTables] = useState({ occupied: 0, total: 0 });
    const [pendingBookings, setPendingBookings] = useState(0);
    const [noShowsCount, setNoShowsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchDashboardStats = async (nextBranchId = branchId) => {
        if (!nextBranchId) {
            setBookingsList([]);
            setOccupiedTables({ occupied: 0, total: 0 });
            setPendingBookings(0);
            setNoShowsCount(0);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');
            const todayStr = todayISO();
            const dayStart = `${todayStr}T00:00:00`;
            const dayEnd = `${todayStr}T23:59:59`;

            const [occupiedData, bookingsData, tables] = await Promise.all([
                getOccupiedTables({
                    branch_id: nextBranchId,
                    booking_start: new Date(dayStart).toISOString(),
                    booking_end: new Date(dayEnd).toISOString(),
                }).catch(() => []),
                getPartnerBookings({
                    date: todayStr,
                    branch_id: nextBranchId,
                }),
                loadTablesForBranch(nextBranchId).catch(() => []),
            ]);

            const occupiedList = unwrapList(occupiedData);
            const occupiedCount = occupiedList.filter((row) => row.is_occupied).length;

            const list = bookingsData.results || [];
            setBookingsList(list);
            setOccupiedTables({
                occupied: occupiedCount,
                total: tables.filter((t) => t.is_active).length || tables.length,
            });
            setPendingBookings(list.filter((b) => b.status === 'Pending').length);
            setNoShowsCount(list.filter((b) => b.status === 'No Show').length);
        } catch (err) {
            console.error("Ma'lumotlarni yuklashda xatolik:", err);
            setError(err?.message || 'Dashboard yuklanmadi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOwner && assignedBranchId) {
            fetchDashboardStats(assignedBranchId);
        } else if (!isOwner) {
            setLoading(false);
            setError('Branch biriktirilmagan.');
        }
        // owner waits for BrandBranchSelect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isOwner && branchId) fetchDashboardStats(branchId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const utilizationPercentage = useMemo(() => (
        occupiedTables.total > 0
            ? Math.round((occupiedTables.occupied / occupiedTables.total) * 100)
            : 0
    ), [occupiedTables]);

    return (
        <>
            <PageHeader
                title="Dashboard"
                actions={isOwner ? (
                    <BrandBranchSelect
                        brandId={brandId}
                        branchId={branchId}
                        onBrandChange={setBrandId}
                        onBranchChange={(id) => setBranchId(id)}
                    />
                ) : null}
            />

            {error && <p className={styles.loadingText} style={{ color: '#ff6b6b' }}>{error}</p>}
            {loading ? (
                <p className={styles.loadingText}>Loading stats...</p>
            ) : (
                <div className={styles.dashboardContainer}>
                    <section className={styles.statsGrid}>
                        <StatCard
                            title="TODAY'S BOOKINGS"
                            value={String(bookingsList.length)}
                            subtext="Today for selected branch"
                            isPositive
                            icon="📅"
                        />
                        <StatCard
                            title="PENDING"
                            value={String(pendingBookings)}
                            subtext={pendingBookings > 0 ? 'Needs attention' : 'All cleared'}
                            status={pendingBookings > 0 ? 'pending' : 'normal'}
                            icon="👤"
                        />
                        <StatCard
                            title="OCCUPIED TABLES"
                            value={`${occupiedTables.occupied}/${occupiedTables.total}`}
                            subtext={`${utilizationPercentage}% utilization`}
                            isPositive={utilizationPercentage > 50}
                            icon="🪑"
                        />
                        <StatCard
                            title="NO SHOWS TODAY"
                            value={String(noShowsCount)}
                            subtext="from today's visits"
                            isPositive={noShowsCount === 0}
                            icon="🚫"
                        />
                    </section>

                    <div className={styles.mainContentGrid}>
                        <UpcomingBookings bookings={bookingsList} />
                        <StatusBreakdown bookings={bookingsList} />
                    </div>

                    <section className={styles.notificationsSection}>
                        <RecentNotifications />
                    </section>
                </div>
            )}
        </>
    );
}
