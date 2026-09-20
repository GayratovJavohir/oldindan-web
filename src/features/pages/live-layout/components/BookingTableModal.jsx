import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './BookingTableModal.module.css';
import { statusSlug, translateStatus } from '../../../../utils/statusI18n';

// FIX: the label text used to live in this map, hard-coded in English, so the
// status badge stayed English in uz/ru. Only the colour is component-level
// presentation now; the label comes from the shared i18n status helper.
const STATUS_COLORS = {
    pending: '#f5a623',
    confirmed: '#4c8bf5',
    checked_in: '#a463f2',
    completed: '#4ade80',
    canceled: '#f87171',
    no_show: '#9ca3af',
};

const AVAILABLE_COLOR = '#4ade80';

function formatDate(value, locale) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    // FIX: the date was always formatted with the 'en-GB' locale.
    return d.toLocaleDateString(locale || 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * `booking` is null/undefined whenever the selected table has no active
 * booking right now (available table) — this is a normal, expected state,
 * not missing data. `table` always describes the physical table itself
 * (name, seats, zone) and should be shown regardless of booking status.
 */
export default function BookingDetailsModal({
    booking,
    table,
    onClose,
    onAction,
    onCreateBooking,
    loading = false,
}) {
    const { t, i18n } = useTranslation();
    const [note, setNote] = useState('');

    if (!booking && !table) return null;

    const isEmpty = !booking;

    const rawStatus = statusSlug(booking?.status);
    const statusColor = isEmpty
        ? AVAILABLE_COLOR
        : (STATUS_COLORS[rawStatus] || STATUS_COLORS.pending);
    const statusLabel = isEmpty
        ? t('status.available')
        : translateStatus(t, booking?.status);

    const runAction = (type) => {
        if (loading || isEmpty) return;
        onAction(type, note.trim());
    };

    const bookingDate = formatDate(booking?.date, i18n.language);

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2>{isEmpty ? t('layout.tableDetails') : t('bookings.bookingDetails')}</h2>
                        <span
                            className={styles.statusBadge}
                            style={{ color: statusColor, backgroundColor: `${statusColor}1A` }}
                        >
                            <span className={styles.dot} style={{ backgroundColor: statusColor }} />
                            {statusLabel}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>✕</button>
                </div>

                <div className={styles.grid}>
                    <div className={styles.gridItem}>
                        <label>{t('common.table')}</label>
                        <div className={styles.valueLarge}>{table?.name || '—'}</div>
                        <div className={styles.valueSub}>
                            {table?.seats ? t('bookings.seatsCount', { count: table.seats }) : '—'}
                        </div>
                    </div>

                    <div className={styles.gridItem}>
                        <label>{t('common.location')}</label>
                        <div className={styles.valueLarge}>{table?.branchName || t('common.branch')}</div>
                        <div className={styles.valueSub}>
                            {table?.floorName || t('common.floor')} • {table?.zoneName || t('common.noZone')}
                        </div>
                    </div>

                    {isEmpty ? (
                        <div className={styles.gridItem} style={{ gridColumn: '1 / -1' }}>
                            <label>{t('common.status')}</label>
                            <div className={styles.valueLarge} style={{ color: AVAILABLE_COLOR }}>
                                {t('layout.tableEmpty')}
                            </div>
                            <div className={styles.valueSub}>
                                {t('bookings.noActiveBooking')}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className={styles.gridItem}>
                                <label>{t('bookings.guest')}</label>
                                <div className={styles.valueLarge}>
                                    {booking?.guestName || t('bookings.walkInGuest')}
                                </div>
                                <div className={styles.valueSub}>{booking?.phone || '—'}</div>
                            </div>

                            <div className={styles.gridItem}>
                                <label>{t('bookings.window')}</label>
                                <div className={styles.valueLarge}>{bookingDate || '—'}</div>
                                <div className={styles.valueSub}>
                                    {booking?.time || '—'} → {booking?.endTime || '—'}
                                </div>
                            </div>

                            <div className={styles.gridItem}>
                                <label>{t('bookings.partySize')}</label>
                                <div className={styles.valueLarge}>
                                    {booking?.guest_count ?? 0} {t('bookings.guestPlural')}
                                </div>
                                <div className={styles.valueSub}>
                                    {booking?.children_count ?? 0} {t('bookings.childPlural')}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!isEmpty && (
                    <>
                        <div className={styles.section}>
                            <label>{t('bookings.specialRequest')}</label>
                            <div className={styles.value}>{booking?.special_request || '—'}</div>
                        </div>

                        <div className={styles.section}>
                            <label>{t('bookings.source')}</label>
                            <div className={styles.sourceBadge}>
                                📱 {booking?.source || t('bookings.sourceApp')}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <label>{t('bookings.statusUpdate')}</label>
                            <input
                                type="text"
                                className={styles.noteInput}
                                placeholder={t('bookings.optionalNote')}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </>
                )}

                {isEmpty ? (
                    <div className={styles.actions}>
                        <button className={styles.btnSecondary} onClick={onClose}>
                            {t('common.close')}
                        </button>
                        {onCreateBooking && (
                            <button
                                className={styles.btnPrimary}
                                onClick={() => onCreateBooking(table)}
                            >
                                {t('layout.bookThisTable')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={styles.actions}>
                        <button className={styles.btnDanger} disabled={loading} onClick={() => runAction('cancel')}>
                            {t('bookings.cancelBooking')}
                        </button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('noshow')}>
                            {t('bookings.noShow')}
                        </button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('confirm')}>
                            {t('bookings.confirm')}
                        </button>
                        <button className={styles.btnPrimary} disabled={loading} onClick={() => runAction('checkin')}>
                            {loading ? '…' : t('bookings.checkIn')}
                        </button>
                        <button className={styles.btnSecondary} disabled={loading} onClick={() => runAction('complete')}>
                            {t('bookings.complete')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
