import { useNavigate } from 'react-router-dom';
import styles from '../Bookings.module.css';
import { useTranslation } from 'react-i18next';
import { getStoredUser } from '../../../../utils/authUser';
import { statusSlug, translateStatus } from '../../../../utils/statusI18n';

export default function BookingDetailsModal({ booking, onClose }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isReceptionist = getStoredUser()?.role === 'receptionist';
    if (!booking) return null;

    return (
        <div className={styles.viewModalOverlay} onClick={onClose}>
            <div className={styles.viewModalBox} onClick={(e) => e.stopPropagation()}>
                <div className={styles.viewModalHeader}>
                    <div className={styles.viewModalTitleGroup}>
                        <h2>{t('bookings.bookingDetails')}</h2>
                        {booking.status && (
                            /* FIX: the class key used to be built with a raw
                               `.toLowerCase()`, so "Checked In" produced the
                               invalid key `status_checked in` and the badge
                               lost its colour. The label was also printed
                               untranslated. */
                            <span className={`${styles.viewModalStatusBadge} ${styles[`status_${statusSlug(booking.status)}`] || ''}`}>
                                • {translateStatus(t, booking.status)}
                            </span>
                        )}
                    </div>
                    <button className={styles.viewModalCloseBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.viewModalBody}>
                    <div className={styles.viewModalGridRow}>
                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>
                                {t('bookings.guest')}
                            </span>
                            <div className={styles.viewModalPrimaryText}>{booking.guestName}</div>
                            <div className={styles.viewModalSecondaryText}>{booking.phone}</div>
                        </div>

                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>{t('bookings.window')}</span>
                            <div className={styles.viewModalPrimaryText}>{booking.date}</div>
                            <div className={styles.viewModalSecondaryText}>
                                {booking.time} {booking.endTime ? `→ ${booking.endTime}` : ''}
                            </div>
                        </div>
                    </div>

                    <div className={styles.viewModalGridRow}>
                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>
                                {t('bookings.location')}
                            </span>
                            <div className={styles.viewModalPrimaryText}>{booking.branch}</div>
                            <div className={styles.viewModalSecondaryText}>
                                {booking.floor || t('bookings.floorDefault')} •{' '}
                                {booking.zone || t('bookings.zoneDefault')} •{' '}
                                {booking.table}
                            </div>
                        </div>

                        <div className={styles.viewModalInfoGroup}>
                            <span className={styles.viewModalLabel}>
                                {t('bookings.partySize')}
                            </span>
                            <div className={styles.viewModalPrimaryText}>
                                {booking.guest_count}{' '}
                                {booking.guest_count === 1
                                    ? t('bookings.guestSingular')
                                    : t('bookings.guestPlural')}
                            </div>
                            {/* FIX: `booking.children` does not exist — the
                                mapper produces `children_count`, so the child
                                count never rendered. */}
                            {Number(booking.children_count) > 0 && (
                                <div className={styles.viewModalSecondaryText}>
                                    {booking.children_count}{' '}
                                    {booking.children_count === 1
                                        ? t('bookings.childSingular')
                                        : t('bookings.childPlural')}
                                </div>
                            )}
                        </div>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>
                            {t('bookings.specialRequest')}
                        </span>

                        <div className={styles.viewModalRequestText}>
                            {booking.special_request || t('bookings.noSpecialRequest')}
                        </div>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>
                            {t('bookings.source')}
                        </span>

                        <span className={styles.viewModalSourceBadge}>
                            📱 {booking.source || t('bookings.bookedViaApp')}
                        </span>
                    </div>

                    <hr className={styles.viewModalDivider} />

                    <div className={styles.viewModalInfoGroup}>
                        <span className={styles.viewModalLabel}>
                            {t('bookings.addNote')}
                        </span>

                        <input
                            type="text"
                            placeholder={t('bookings.optionalNote')}
                            className={styles.viewModalNoteInput}
                        />
                    </div>

                    {isReceptionist && (
                        <div className={styles.viewModalFooter} style={{ gridTemplateColumns: '1fr' }}>
                            <button
                                type="button"
                                className={styles.viewModalBtnPrimary}
                                onClick={() => {
                                    onClose();
                                    navigate(`/chat?booking=${booking.id}`);
                                }}
                            >
                                {t('chat.openChat')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}