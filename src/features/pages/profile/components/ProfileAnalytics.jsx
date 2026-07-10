import React, { useEffect, useState } from 'react';
import styles from '../Profile.module.css';
import StatCard from '../../dashboard/components/StatCard';
import StatusBreakdown from '../../dashboard/components/StatusBreakdown';
import {
    aggregateStats,
    fetchBranchDayStats,
    fetchBranchesDayStats,
    groupStatsByBrand,
} from '../../../../services/analytics.services';
import { getPartnerBrands, getPartnerBranches, getPartnerBranch } from '../../../../services/restaurants.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { getStoredUser } from '../../../../utils/authUser';

function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'manager') return 'Manager';
    if (role === 'receptionist') return 'Receptionist';
    return 'Staff';
}

function StaffAnalytics() {
    const user = getStoredUser();
    const [branchName, setBranchName] = useState('');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const branchId = user?.branchId;
                if (!branchId) {
                    if (active) setError('No branch assigned to this staff account.');
                    return;
                }

                const [branch, dayStats] = await Promise.all([
                    getPartnerBranch(branchId).catch(() => null),
                    fetchBranchDayStats(branchId),
                ]);

                if (!active) return;
                setBranchName(branch?.name || `Branch #${branchId}`);
                setStats(dayStats);
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [user?.branchId]);

    if (loading) return <div className={styles.analyticsLoading}>Loading your branch analytics...</div>;
    if (error) return <div className={styles.analyticsError}>{error}</div>;
    if (!stats) return null;

    return (
        <section className={styles.analyticsSection}>
            <div className={styles.analyticsHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>My Branch Analytics</h2>
                    <p className={styles.sectionSub}>
                        {roleLabel(user?.role)} · {branchName} · Today
                    </p>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <StatCard title="TODAY'S BOOKINGS" value={String(stats.bookingsTotal)} subtext="Your branch today" icon="📅" isPositive />
                <StatCard title="PENDING" value={String(stats.pending)} subtext={stats.pending ? 'Needs attention' : 'All cleared'} status={stats.pending ? 'pending' : 'normal'} icon="⏳" />
                <StatCard title="OCCUPIED TABLES" value={`${stats.occupied}/${stats.totalTables}`} subtext={`${stats.utilization}% utilization`} isPositive={stats.utilization > 40} icon="🪑" />
                <StatCard title="NO SHOWS" value={String(stats.noShows)} subtext="Today" isPositive={stats.noShows === 0} icon="🚫" />
            </div>

            <div className={styles.analyticsGrid}>
                <StatusBreakdown bookings={stats.bookings} />
                <div className={styles.miniStatsCard}>
                    <h3>Quick summary</h3>
                    <div className={styles.miniStatRow}><span>Confirmed</span><strong>{stats.confirmed}</strong></div>
                    <div className={styles.miniStatRow}><span>Completed</span><strong>{stats.completed}</strong></div>
                    <div className={styles.miniStatRow}><span>Cancelled</span><strong>{stats.canceled}</strong></div>
                    <div className={styles.miniStatRow}><span>Total tables</span><strong>{stats.totalTables}</strong></div>
                </div>
            </div>
        </section>
    );
}

function OwnerAnalytics() {
    const [brands, setBrands] = useState([]);
    const [branchStats, setBranchStats] = useState([]);
    const [totals, setTotals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const [brandList, branchList] = await Promise.all([
                    getPartnerBrands(),
                    getPartnerBranches(),
                ]);

                const stats = await fetchBranchesDayStats(branchList);
                if (!active) return;

                const branchCountByBrand = branchList.reduce((acc, branch) => {
                    const key = String(branch.brandId);
                    if (key) acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {});

                setBrands(brandList.map((brand) => ({
                    ...brand,
                    branches: branchCountByBrand[String(brand.id)] ?? brand.branches,
                })));
                setBranchStats(stats);
                setTotals(aggregateStats(stats));
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    if (loading) return <div className={styles.analyticsLoading}>Loading organization analytics...</div>;
    if (error) return <div className={styles.analyticsError}>{error}</div>;

    const brandGroups = groupStatsByBrand(branchStats, brands);
    const activeBranches = branchStats.filter((s) => s.totalTables > 0 || s.bookingsTotal > 0).length;

    return (
        <section className={styles.analyticsSection}>
            <div className={styles.analyticsHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Organization Analytics</h2>
                    <p className={styles.sectionSub}>
                        {brands.length} brands · {branchStats.length} branches · Today
                    </p>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <StatCard title="BRANDS" value={String(brands.length)} subtext="Registered brands" icon="◈" isPositive />
                <StatCard title="BRANCHES" value={String(branchStats.length)} subtext={`${activeBranches} active today`} icon="⌂" isPositive />
                <StatCard title="TODAY'S BOOKINGS" value={String(totals?.bookingsTotal || 0)} subtext="All branches combined" icon="📅" isPositive />
                <StatCard title="TABLE UTILIZATION" value={`${totals?.utilization || 0}%`} subtext={`${totals?.occupied || 0}/${totals?.totalTables || 0} occupied`} isPositive={(totals?.utilization || 0) > 40} icon="🪑" />
            </div>

            <div className={styles.orgKpiRow}>
                <div className={styles.orgKpi}><span>Pending</span><strong>{totals?.pending || 0}</strong></div>
                <div className={styles.orgKpi}><span>Confirmed</span><strong>{totals?.confirmed || 0}</strong></div>
                <div className={styles.orgKpi}><span>Completed</span><strong>{totals?.completed || 0}</strong></div>
                <div className={styles.orgKpi}><span>No shows</span><strong>{totals?.noShows || 0}</strong></div>
            </div>

            {brandGroups.map(({ brand, branches, totals: brandTotals }) => (
                <div key={brand.id} className={styles.brandAnalyticsCard}>
                    <div className={styles.brandAnalyticsHeader}>
                        <div>
                            <h3>{brand.name}</h3>
                            <p>{brand.branches} branches · {brand.slug}</p>
                        </div>
                        <div className={styles.brandTotals}>
                            <span>{brandTotals.bookingsTotal} bookings</span>
                            <span>{brandTotals.utilization}% util.</span>
                        </div>
                    </div>

                    {branches.length === 0 ? (
                        <p className={styles.emptyBranchNote}>No branches for this brand yet.</p>
                    ) : (
                        <div className={styles.branchStatsTableWrap}>
                            <table className={styles.branchStatsTable}>
                                <thead>
                                    <tr>
                                        <th>Branch</th>
                                        <th>Bookings</th>
                                        <th>Pending</th>
                                        <th>Tables</th>
                                        <th>Utilization</th>
                                        <th>No shows</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map((branch) => (
                                        <tr key={branch.branchId}>
                                            <td>{branch.branchName}</td>
                                            <td>{branch.bookingsTotal}</td>
                                            <td>{branch.pending}</td>
                                            <td>{branch.occupied}/{branch.totalTables}</td>
                                            <td>{branch.utilization}%</td>
                                            <td>{branch.noShows}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ))}
        </section>
    );
}

export default function ProfileAnalytics() {
    const user = getStoredUser();
    if (user?.role === 'owner') return <OwnerAnalytics />;
    return <StaffAnalytics />;
}
