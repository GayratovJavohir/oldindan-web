import React, { useState, useEffect } from 'react';
import styles from '../Bookings.module.css';
import ManualBookingModal from './ManualBookingModal';
import CheckInModal from '../../../../components/CheckInModal';
import BookingFilters from '../components/BookingsFilter';
import BookingRow from '../components/BookingsRow';
import { getPartnerBookings, noShowBooking, updateBookingStatus } from '../../../../services/bookings.services';
import { canCreateManualBooking } from '../../../../utils/authUser';
import { getApiError } from '../../../../utils/apiHelpers';

export default function BookingsTable() {
  const canManualBooking = canCreateManualBooking();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [showQuickCheckIn, setShowQuickCheckIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [pagination, setPagination] = useState({ page: 1, totalCount: 0 });
  const [activeFilters, setActiveFilters] = useState({});

  const fetchBookings = async (page = 1, filters = {}) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const params = { page, ...filters };
      const data = await getPartnerBookings(params);
      setBookings(data.results || data);
      setPagination({ page, totalCount: data.count || data.length });
    } catch (error) {
      console.error('Bookings fetch error:', error);
      setErrorMessage(getApiError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(pagination.page, activeFilters);
  }, [pagination.page, activeFilters]);

  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = async (booking, action) => {
    try {
      setErrorMessage('');
      if (action === 'checkin') {
        setCheckInTarget(booking);
        return;
      }
      if (action === 'no_show') {
        await noShowBooking(booking.id);
      } else {
        const statusMap = {
          confirm: 'confirmed',
          cancel: 'cancelled',
          complete: 'completed',
        };
        await updateBookingStatus(booking.id, statusMap[action] || action);
      }
      await fetchBookings(pagination.page, activeFilters);
    } catch (error) {
      console.error('Status update error:', error);
      setErrorMessage(getApiError(error));
    }
  };

  const handleNextPage = () => {
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
  };

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>All Bookings</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={styles.manualBtn} onClick={() => setShowQuickCheckIn(true)}>
              Check In by code
            </button>
            {canManualBooking && (
              <button type="button" className={styles.manualBtn} onClick={() => setIsModalOpen(true)}>
                + Manual Booking
              </button>
            )}
          </div>
        </div>

        <BookingFilters onApplyFilters={handleApplyFilters} />
        {errorMessage && (
          <div style={{ color: '#cf222e', marginBottom: 16, fontSize: 14 }}>{errorMessage}</div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>CODE</th>
                <th>GUEST</th>
                <th>BRANCH / TABLE</th>
                <th>DATE & TIME</th>
                <th>GUESTS</th>
                <th>STATUS</th>
                <th>SOURCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No bookings found.</td></tr>
              ) : (
                bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span className={styles.resultsCount}>
            Total results: {pagination.totalCount} (Page: {pagination.page})
          </span>
          <div className={styles.paginationBtns}>
            <button type="button" className={styles.pageBtn} onClick={handlePrevPage} disabled={pagination.page === 1}>
              &larr; Prev
            </button>
            <button type="button" className={styles.pageBtn} onClick={handleNextPage}>
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {canManualBooking && isModalOpen && (
        <ManualBookingModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchBookings(1, activeFilters);
          }}
        />
      )}

      {(checkInTarget || showQuickCheckIn) && (
        <CheckInModal
          bookingNumber={checkInTarget?.bookingNumber || ''}
          branchId={checkInTarget?.branchId || null}
          guestHint={checkInTarget?.guestName || ''}
          onClose={() => {
            setCheckInTarget(null);
            setShowQuickCheckIn(false);
          }}
          onSuccess={() => {
            setTimeout(() => {
              setCheckInTarget(null);
              setShowQuickCheckIn(false);
              fetchBookings(pagination.page, activeFilters);
            }, 800);
          }}
        />
      )}
    </div>
  );
}
