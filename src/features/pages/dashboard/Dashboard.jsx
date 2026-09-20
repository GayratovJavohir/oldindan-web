import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Dashboard.module.css';
import PageHeader from '../../../components/header/PageHeader';
import StatCard from './components/StatCard';
import UpcomingBookings from './components/UpcomingBookings';
import StatusBreakdown from './components/StatusBreakdown';
import BrandBranchSelect from '../../../components/BrandBranchSelect';
import {
    IoTodaySharp,
    IoPersonOutline,
    IoRestaurantOutline,
    IoCloseCircleOutline,
} from "react-icons/io5";

import { getOccupiedTables, getPartnerBookings } from '../../../services/bookings.services';
import { loadTablesForBranch } from '../../../services/tables.services';
import { getStoredUser } from '../../../utils/authUser';
import { unwrapList, todayLocalISO } from '../../../utils/apiHelpers';

const BRAND_STORAGE_KEY = 'kfc_partner_brand_id';
const BRANCH_STORAGE_KEY = 'kfc_partner_branch_id';

function readStoredValue(key) {
    if (typeof window === 'undefined') return '';
    try {
        return localStorage.getItem(key) || '';
    } catch {
        return '';
    }
}

function writeStoredValue(key, value) {
    if (typeof window === 'undefined') return;
    try {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export default function Dashboard() {
    const { t } = useTranslation();
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';

    const [brandId, setBrandId] = useState(() => readStoredValue(BRAND_STORAGE_KEY));
    const [branchId, setBranchId] = useState(() => assignedBranchId || readStoredValue(BRANCH_STORAGE_KEY));
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
            // FIX: was `new Date().toISOString().slice(0,10)`, i.e. the UTC
            // date. In UTC+5 every request made before 05:00 local time asked
            // the API for *yesterday's* bookings.
            const todayStr = todayLocalISO();
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
                total: tables.filter((tbl) => tbl.is_active).length || tables.length,
            });
            setPendingBookings(list.filter((b) => b.status === 'Pending').length);
            setNoShowsCount(list.filter((b) => b.status === 'No Show').length);
        } catch (err) {
            console.error('Dashboard stats error:', err);
            setError(err?.message || t('dashboard.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    // FIX: there used to be two effects here — a mount-only one and a
    // `[branchId]` one. For an owner with a branch restored from localStorage
    // both fired on the first render, so the dashboard issued every API call
    // twice. A single effect covers both cases.
    useEffect(() => {
        const effectiveBranchId = isOwner ? branchId : assignedBranchId;

        if (!isOwner && !assignedBranchId) {
            setLoading(false);
            setError(t('dashboard.noBranchAssigned'));
            return;
        }

        if (!effectiveBranchId) {
            setLoading(false);
            return;
        }

        fetchDashboardStats(effectiveBranchId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOwner, branchId, assignedBranchId]);

    const utilizationPercentage = useMemo(() => (
        occupiedTables.total > 0
            ? Math.round((occupiedTables.occupied / occupiedTables.total) * 100)
            : 0
    ), [occupiedTables]);

    return (
        <>
            <PageHeader
                title={t("pages.dashboard")}
                actions={
                    isOwner ? (
                        <div className={styles.brandBranchSelect}>
                            <BrandBranchSelect
                                brandId={brandId}
                                branchId={branchId}
                                onBrandChange={(id) => {
                                    setBrandId(id);
                                    writeStoredValue(BRAND_STORAGE_KEY, id);
                                }}
                                onBranchChange={(id) => {
                                    setBranchId(id);
                                    writeStoredValue(BRANCH_STORAGE_KEY, id);
                                }}
                            />
                        </div>
                    ) : null
                }
            />

            {error && <p className={styles.loadingText} style={{ color: '#ff6b6b' }}>{error}</p>}
            {!branchId && isOwner ? (
                <div className={styles.loadingText}>
                    <h3>{t('dashboard.pickBrandBranchTitle')}</h3>
                    <p>{t('dashboard.pickBrandBranchHint')}</p>
                </div>
            ) : loading ? (
                <p className={styles.loadingText}>
                    {t('dashboard.loadingStats')}
                </p>
            ) : (
                <div className={styles.dashboardContainer}>
                    <section className={styles.statsGrid}>
                        <StatCard
                            title={t('dashboard.todaysBookings')}
                            value={String(bookingsList.length)}
                            subtext={t('dashboard.todayForBranch')}
                            isPositive
                            icon={<IoTodaySharp />}
                        />
                        <StatCard
                            title={t('dashboard.pending')}
                            value={String(pendingBookings)}
                            subtext={pendingBookings > 0 ? t('dashboard.needsAttention') : t('dashboard.allCleared')}
                            status={pendingBookings > 0 ? 'pending' : 'normal'}
                            icon={<IoPersonOutline />}
                        />
                        <StatCard
                            title={t('dashboard.occupiedTables')}
                            value={`${occupiedTables.occupied}/${occupiedTables.total}`}
                            subtext={`${utilizationPercentage}% ${t('dashboard.utilization')}`}
                            isPositive={utilizationPercentage > 50}
                            icon={<IoRestaurantOutline />}
                        />
                        <StatCard
                            title={t('dashboard.noShowsToday')}
                            value={String(noShowsCount)}
                            subtext={t('dashboard.fromTodaysVisits')}
                            isPositive={noShowsCount === 0}
                            icon={<IoCloseCircleOutline />}
                        />
                    </section>

                    <div className={styles.mainContentGrid}>
                        <UpcomingBookings bookings={bookingsList} />
                        <StatusBreakdown bookings={bookingsList} />
                    </div>
                </div>
            )}
        </>
    );
}