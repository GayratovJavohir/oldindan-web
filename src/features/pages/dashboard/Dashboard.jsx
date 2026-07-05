import React, { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import Sidebar from '../../../components/sidebar/Sidebar';
import StatCard from './components/StatCard';
import UpcomingBookings from './components/UpcomingBookings';
import StatusBreakdown from './components/StatusBreakdown';
import RecentNotifications from './components/RecentNotifications';

import { getOccupiedTables, getPartnerBookings } from '../../../services/bookings.services';
import { getPartnerTables } from '../../../services/tables.services';

export default function Dashboard() {
  const [bookingsList, setBookingsList] = useState([]);
  const [occupiedTables, setOccupiedTables] = useState({ occupied: 0, total: 0 });
  const [pendingBookings, setPendingBookings] = useState(0);
  const [noShowsCount, setNoShowsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      const todayStr = new Date().toISOString().split('T')[0];
      const CURRENT_BRANCH_ID = 1;

      const tableParams = {
        branch_id: CURRENT_BRANCH_ID,
        booking_start: `${todayStr} 00:00:00`,
        booking_end: `${todayStr} 23:59:59`
      };

      const bookingParams = {
        date: todayStr
      };

      const [occupiedData, bookingsData, allTablesData] = await Promise.all([
        getOccupiedTables(tableParams),
        getPartnerBookings(bookingParams),
        getPartnerTables(CURRENT_BRANCH_ID)
      ]);

      const countOfOccupied = Array.isArray(occupiedData) ? occupiedData.length : 0;

      const totalTablesList = Array.isArray(allTablesData)
        ? allTablesData
        : (Array.isArray(allTablesData?.results) ? allTablesData.results : []);

      const countOfTotalTables = totalTablesList.length || 0;

      setOccupiedTables({
        occupied: countOfOccupied,
        total: countOfTotalTables
      });

      const list = Array.isArray(bookingsData)
        ? bookingsData
        : (Array.isArray(bookingsData?.results) ? bookingsData.results : []);

      setBookingsList(list);

      const pendingFiltered = list.filter(b => b.status?.toLowerCase() === 'pending');
      setPendingBookings(pendingFiltered.length || 0);

      const noShowsFiltered = list.filter(b => b.status?.toLowerCase() === 'no_show');
      setNoShowsCount(noShowsFiltered.length || 0);

    } catch (error) {
      console.error("Ma'lumotlarni yuklashda xatolik:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  if (loading) {
    return <p className={styles.loadingText}>Loading stats...</p>;
  }

  const utilizationPercentage = occupiedTables.total > 0
    ? Math.round((occupiedTables.occupied / occupiedTables.total) * 100)
    : 0;

  return (


    <>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <div className={styles.bellIcon}>🔔</div>
      </header>
      <div className={styles.dashboardContainer}>

        <section className={styles.statsGrid}>
          <StatCard
            title="TODAY'S BOOKINGS"
            value={String(bookingsList.length)}
            subtext="↑ 3 from yesterday"
            isPositive={true}
            icon="📅"
          />

          <StatCard
            title="PENDING"
            value={String(pendingBookings)}
            subtext={pendingBookings > 0 ? "Needs attention" : "All cleared"}
            status={pendingBookings > 0 ? "pending" : "normal"}
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
      </div></>
  );
}