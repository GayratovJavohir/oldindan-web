import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Bookings.module.css';
import ManualBookingModal from './ManualBookingModal';
import CheckInModal from '../../../../components/CheckInModal';
import BookingFilters from '../components/BookingsFilter';
import BookingRow from '../components/BookingsRow';
import { getPartnerBookings, noShowBooking, updateBookingStatus } from '../../../../services/bookings.services';
import { canCreateManualBooking, getStoredUser } from '../../../../utils/authUser';
import { getApiError } from '../../../../utils/apiHelpers';

export default function BookingsTable() {
  const { t } = useTranslation();
  const user = getStoredUser();
  const canManualBooking = canCreateManualBooking();
  const assignedBranchId = user?.role !== 'owner' && user?.branchId ? String(user.branchId) : '';
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
      if (assignedBranchId && !params.branch_id) {
        params.branch_id = assignedBranchId;
      }
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

  return (
    <div className={styles.container}>
      <div className={styles.mainCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('bookings.allBookings')}</h2>
          <div className={styles.headerActions}>
            <button type="button" className={styles.manualBtn} onClick={() => setShowQuickCheckIn(true)}>
              {t('bookings.checkInByCode')}
            </button>
            {canManualBooking && (
              <button type="button" className={styles.manualBtn} onClick={() => setIsModalOpen(true)}>
                {t('bookings.manualBooking')}
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
                <th>{t('bookings.code')}</th>
                <th>{t('bookings.guest')}</th>
                <th>{t('bookings.branchTable')}</th>
                <th>{t('bookings.dateTime')}</th>
                <th>{t('common.guests')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.source')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>{t('common.loading')}</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>{t('bookings.noBookings')}</td></tr>
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
            {t('bookings.totalResults')}: {pagination.totalCount} ({t('bookings.page')}: {pagination.page})
          </span>
          <div className={styles.paginationBtns}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => pagination.page > 1 && setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              &larr; {t('bookings.prev')}
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              {t('bookings.next')} &rarr;
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
