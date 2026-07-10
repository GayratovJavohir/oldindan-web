import React, { useEffect, useMemo, useState } from 'react';
import styles from '../Profile.module.css';
import StatCard from '../../dashboard/components/StatCard';
import StatusBreakdown from '../../dashboard/components/StatusBreakdown';
import {
    aggregateStats,
    fetchBranchDayStats,
    fetchBranchesDayStats,
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

function BrandPickerGrid({ brands, onSelect }) {
    if (!brands.length) {
        return <p className={styles.emptyBranchNote}>No brands found. Create a brand first.</p>;
    }

    return (
        <div className={styles.brandPickerGrid}>
            {brands.map((brand) => (
                <button
                    key={brand.id}
                    type="button"
                    className={styles.brandPickerCard}
                    onClick={() => onSelect(brand)}
                >
                    <div className={styles.brandPickerIcon}>◈</div>
                    <h3>{brand.name}</h3>
                    <p>{brand.slug}</p>
                    <span className={styles.brandPickerMeta}>{brand.branches} branches</span>
                </button>
            ))}
        </div>
    );
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
    const [allBranches, setAllBranches] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [branchStats, setBranchStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingBrandStats, setLoadingBrandStats] = useState(false);
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
                setAllBranches(branchList);
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!selectedBrand) {
            setBranchStats([]);
            return;
        }

        let active = true;
        const brandBranches = allBranches.filter(
            (branch) => String(branch.brandId) === String(selectedBrand.id)
        );

        (async () => {
            setLoadingBrandStats(true);
            try {
                const stats = brandBranches.length
                    ? await fetchBranchesDayStats(brandBranches)
                    : [];
                if (active) setBranchStats(stats);
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoadingBrandStats(false);
            }
        })();

        return () => { active = false; };
    }, [selectedBrand, allBranches]);

    const brandTotals = useMemo(
        () => aggregateStats(branchStats),
        [branchStats]
    );

    if (loading) return <div className={styles.analyticsLoading}>Loading organization analytics...</div>;
    if (error && !selectedBrand) return <div className={styles.analyticsError}>{error}</div>;

    const totalBranches = allBranches.length;

    return (
        <section className={styles.analyticsSection}>
            <div className={styles.analyticsHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Organization Analytics</h2>
                    <p className={styles.sectionSub}>
                        {selectedBrand
                            ? `${selectedBrand.name} · ${selectedBrand.branches} branches · Today`
                            : `${brands.length} brands · ${totalBranches} branches · Select a brand`}
                    </p>
                </div>
                {selectedBrand && (
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={() => setSelectedBrand(null)}
                    >
                        ← All brands
                    </button>
                )}
            </div>

            {!selectedBrand ? (
                <>
                    <div className={styles.statsGrid}>
                        <StatCard title="BRANDS" value={String(brands.length)} subtext="Your restaurant brands" icon="◈" isPositive />
                        <StatCard title="BRANCHES" value={String(totalBranches)} subtext="Across all brands" icon="⌂" isPositive />
                        <StatCard title="TODAY" value="—" subtext="Pick a brand below" icon="📅" />
                        <StatCard title="UTILIZATION" value="—" subtext="Pick a brand below" icon="🪑" />
                    </div>

                    <h3 className={styles.pickerTitle}>Select a brand to view branch analytics</h3>
                    <BrandPickerGrid brands={brands} onSelect={setSelectedBrand} />
                </>
            ) : (
                <>
                    <div className={styles.statsGrid}>
                        <StatCard title="BRAND" value={selectedBrand.name} subtext={selectedBrand.slug} icon="◈" isPositive />
                        <StatCard title="BRANCHES" value={String(selectedBrand.branches)} subtext="In this brand" icon="⌂" isPositive />
                        <StatCard title="TODAY'S BOOKINGS" value={String(brandTotals.bookingsTotal)} subtext="This brand today" icon="📅" isPositive />
                        <StatCard title="UTILIZATION" value={`${brandTotals.utilization}%`} subtext={`${brandTotals.occupied}/${brandTotals.totalTables} tables`} isPositive={brandTotals.utilization > 40} icon="🪑" />
                    </div>

                    <div className={styles.orgKpiRow}>
                        <div className={styles.orgKpi}><span>Pending</span><strong>{brandTotals.pending}</strong></div>
                        <div className={styles.orgKpi}><span>Confirmed</span><strong>{brandTotals.confirmed}</strong></div>
                        <div className={styles.orgKpi}><span>Completed</span><strong>{brandTotals.completed}</strong></div>
                        <div className={styles.orgKpi}><span>No shows</span><strong>{brandTotals.noShows}</strong></div>
                    </div>

                    {loadingBrandStats ? (
                        <div className={styles.analyticsLoading}>Loading branch stats...</div>
                    ) : branchStats.length === 0 ? (
                        <p className={styles.emptyBranchNote}>No branches for this brand yet.</p>
                    ) : (
                        <div className={styles.brandAnalyticsCard}>
                            <div className={styles.brandAnalyticsHeader}>
                                <div>
                                    <h3>{selectedBrand.name} branches</h3>
                                    <p>Today's performance by branch</p>
                                </div>
                            </div>
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
                                        {branchStats.map((branch) => (
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
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export default function ProfileAnalytics() {
    const user = getStoredUser();
    if (user?.role === 'owner') return <OwnerAnalytics />;
    return <StaffAnalytics />;
}
