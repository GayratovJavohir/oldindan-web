import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../LiveLayout.module.css';
import FloorCanvas from '../../layout/components/FloorCanvas';
import ManualBookingModal from '../../bookings/components/ManualBookingModal';
import BrandBranchSelect from '../../../../components/BrandBranchSelect';
import BookingDetailsModal from './BookingTableModal';
import {
    getBranchFloors,
    getPartnerFloors,
    getPartnerLayoutItems,
} from '../../../../services/layouts.services';
import { loadTablesForBranch } from '../../../../services/tables.services';
import {
    getOccupiedTables,
    getPartnerBooking,
    getPartnerBookings,
    mapBookingFromApi,
    updateBookingStatus,
    noShowBooking,
    checkInBooking,
} from '../../../../services/bookings.services';
import { getApiError, unwrapList } from '../../../../utils/apiHelpers';
import { canCreateManualBooking, getStoredUser } from '../../../../utils/authUser';

const CANVAS_W = 960;
const CANVAS_H = 640;
const POLL_MS = 20000;

function toIso(date) {
    return date.toISOString();
}

// Tanlangan vaqt bo'yicha 3 soatlik oynani hisoblash
function getWindowForTime(timeStr) {
    const start = new Date();
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':');
        start.setHours(parseInt(hours, 10), parseInt(minutes || 0, 10), 0, 0);
    } else {
        start.setMinutes(0, 0, 0);
    }
    const end = new Date(start);
    end.setHours(end.getHours() + 3);
    return { start: toIso(start), end: toIso(end) };
}

function statusKey(status) {
    const raw = String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    if (raw === 'checkedin' || raw === 'checked_in') return 'checked_in';
    if (raw === 'pending') return 'pending';
    if (raw === 'confirmed') return 'confirmed';
    if (raw === 'completed') return 'completed';
    if (raw === 'canceled' || raw === 'cancelled') return 'canceled';
    if (raw === 'no_show' || raw === 'noshow') return 'no_show';
    if (raw === 'occupied') return 'occupied';
    return 'available';
}

const LEGEND_ITEMS = [
    { key: 'available', label: 'Bo\u2018sh', dotClass: 'availableDot' },
    { key: 'pending', label: 'Kutilmoqda', dotClass: 'pendingDot' },
    { key: 'confirmed', label: 'Tasdiqlangan', dotClass: 'confirmedDot' },
    { key: 'checked_in', label: 'Kelgan', dotClass: 'checkedInDot' },
];

export default function LiveFloor() {
    const { t } = useTranslation();
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const canBook = canCreateManualBooking();
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';

    const [brandId, setBrandId] = useState('');
    const [branchId, setBranchId] = useState(assignedBranchId);
    const [floors, setFloors] = useState([]);
    const [floorId, setFloorId] = useState('');
    const [items, setItems] = useState([]);
    const [tables, setTables] = useState([]);
    const [occupancy, setOccupancy] = useState({});
    const [bookingByTableId, setBookingByTableId] = useState({});

    const [selectedTableId, setSelectedTableId] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showBookModal, setShowBookModal] = useState(false);
    const [bookDefaults, setBookDefaults] = useState(null);

    // Vaqt va Modal statelari
    const [selectedTime, setSelectedTime] = useState('');
    const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Hover tooltip statelari
    const [hoveredTableId, setHoveredTableId] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const tableByLayoutItem = useMemo(() => {
        const map = {};
        tables.forEach((t) => {
            const key = t.layoutItemId ?? t.id;
            if (key != null) map[String(key)] = t;
        });
        return map;
    }, [tables]);

    const tableById = useMemo(() => {
        const map = {};
        tables.forEach((t) => { map[String(t.id)] = t; });
        return map;
    }, [tables]);

    const enrichedItems = useMemo(() => items.map((item) => {
        const table = tableByLayoutItem[String(item.id)];
        if (!table) return item;
        return {
            ...item,
            name: table.name || item.name,
            seats: table.seats,
            meta: { ...item.meta, seats: table.seats, table_id: table.id },
            tableId: table.id,
        };
    }), [items, tableByLayoutItem]);

    const statusByLayoutItemId = useMemo(() => {
        const map = {};
        enrichedItems.forEach((item) => {
            if (item.type !== 'table') {
                map[item.id] = 'facility';
                return;
            }
            const tableId = item.tableId || item.meta?.table_id;
            const occ = occupancy[String(tableId)];
            if (!occ?.is_occupied) {
                map[item.id] = 'available';
                return;
            }
            map[item.id] = statusKey(occ.status);
        });
        return map;
    }, [enrichedItems, occupancy]);

    const selectedTable = selectedTableId ? tableById[String(selectedTableId)] : null;
    const hoveredTable = hoveredTableId ? tableById[String(hoveredTableId)] : null;
    const hoveredOcc = hoveredTableId ? occupancy[String(hoveredTableId)] : null;
    const hoveredBooking = hoveredTableId ? bookingByTableId[String(hoveredTableId)] : null;

    // Stol bandliklarini yuklash funksiyasi
    const loadOccupancy = useCallback(async (nextBranchId, nextFloorId, tableList, timeVal = '') => {
        if (!nextBranchId) return;
        const { start, end } = getWindowForTime(timeVal);
        try {
            const data = await getOccupiedTables({
                branch_id: nextBranchId,
                floor_id: nextFloorId || undefined,
                booking_start: start,
                booking_end: end,
            });
            const list = unwrapList(data);
            const nextOcc = {};
            list.forEach((row) => {
                const id = row.table_id ?? row.table?.id ?? row.table;
                if (!id) return;
                nextOcc[String(id)] = {
                    table_id: id,
                    is_occupied: Boolean(row.is_occupied),
                    booking_id: row.booking_id ?? null,
                    status: row.status || null,
                };
            });
            setOccupancy(nextOcc);

            const occupiedBookingIds = list
                .filter((row) => row.is_occupied && row.booking_id)
                .map((row) => row.booking_id);

            const bookingsMap = {};
            if (occupiedBookingIds.length) {
                try {
                    const bookingsRes = await getPartnerBookings({
                        branch_id: nextBranchId,
                        date: start.slice(0, 10),
                    });
                    (bookingsRes.results || []).forEach((b) => {
                        if (b.tableId) bookingsMap[String(b.tableId)] = b;
                    });
                } catch {
                    // ignore
                }

                await Promise.all(occupiedBookingIds.map(async (bookingId) => {
                    const already = Object.values(bookingsMap).find((b) => String(b.id) === String(bookingId));
                    if (already) return;
                    try {
                        const booking = await getPartnerBooking(bookingId);
                        if (booking?.tableId) bookingsMap[String(booking.tableId)] = booking;
                    } catch {
                        // ignore
                    }
                }));
            }

            (tableList || tables).forEach((table) => {
                const occ = nextOcc[String(table.id)];
                if (occ?.is_occupied && !bookingsMap[String(table.id)] && occ.booking_id) {
                    bookingsMap[String(table.id)] = mapBookingFromApi({
                        id: occ.booking_id,
                        status: occ.status,
                        table: table.id,
                        table_name: table.name,
                        source: 'app',
                    });
                }
            });

            setBookingByTableId(bookingsMap);

            // Modal ochiq bo'lsa, undagi bookingni ham yangilab turamiz
            setSelectedBooking((prev) => {
                if (!prev || !selectedTableId) return prev;
                return bookingsMap[String(selectedTableId)] || prev;
            });
        } catch (err) {
            console.error("Error loading occupancy:", err);
        }
    }, [tables, selectedTableId]);

    const loadLayout = useCallback(async (nextBranchId, preferredFloorId = null) => {
        if (!nextBranchId) {
            setFloors([]);
            setFloorId('');
            setItems([]);
            setTables([]);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const floorLoader = isOwner || !assignedBranchId
                ? getPartnerFloors()
                : getBranchFloors(nextBranchId).catch(() => getPartnerFloors());

            const [floorList, layoutItems, tableList] = await Promise.all([
                floorLoader,
                getPartnerLayoutItems({ branch_id: nextBranchId }),
                loadTablesForBranch(nextBranchId),
            ]);

            const branchFloors = floorList
                .filter((f) => !f.branchId || String(f.branchId) === String(nextBranchId))
                .sort((a, b) => a.sortOrder - b.sortOrder);

            setFloors(branchFloors);
            console.log('[DEBUG] tableList from API:', tableList);
            console.log('[DEBUG] layoutItemId values:', tableList.map(t => ({ id: t.id, name: t.name, layoutItemId: t.layoutItemId, raw_layout_item: t.raw?.layout_item, raw_layout_item_id: t.raw?.layout_item_id })));
            setTables(tableList);

            const nextFloorId = preferredFloorId
                && branchFloors.some((f) => String(f.id) === String(preferredFloorId))
                ? preferredFloorId
                : (branchFloors[0]?.id || '');

            setFloorId(nextFloorId ? String(nextFloorId) : '');
            setItems(
                nextFloorId
                    ? layoutItems.filter((item) => String(item.floorId) === String(nextFloorId))
                    : []
            );

            await loadOccupancy(nextBranchId, nextFloorId, tableList, selectedTime);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, [assignedBranchId, isOwner, loadOccupancy, selectedTime]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (!isOwner && assignedBranchId) {
                    setBranchId(assignedBranchId);
                    await loadLayout(assignedBranchId);
                } else if (!isOwner) {
                    setError('Branch biriktirilmagan.');
                    setLoading(false);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                if (active) {
                    setError(getApiError(err));
                    setLoading(false);
                }
            }
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!branchId || !floorId) return undefined;
        const timer = setInterval(async () => {
            try {
                setRefreshing(true);
                await loadOccupancy(branchId, floorId, tables, selectedTime);
            } catch {
                // keep last good state
            } finally {
                setRefreshing(false);
            }
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [branchId, floorId, tables, loadOccupancy, selectedTime]);

    const handleBranchChange = async (value) => {
        setBranchId(value);
        setSelectedTableId(null);
        setSelectedBooking(null);
        if (value) await loadLayout(value);
        else {
            setFloors([]);
            setFloorId('');
            setItems([]);
            setTables([]);
        }
    };

    const handleFloorChange = async (value) => {
        setFloorId(value);
        setSelectedTableId(null);
        setSelectedBooking(null);
        try {
            const layoutItems = await getPartnerLayoutItems({ branch_id: branchId, floor_id: value });
            const tableList = await loadTablesForBranch(branchId, value);
            setItems(layoutItems);
            setTables((prev) => {
                const others = prev.filter((t) => String(t.floorId) !== String(value));
                return [...others, ...tableList];
            });
            await loadOccupancy(branchId, value, tableList, selectedTime);
        } catch (err) {
            setError(getApiError(err));
        }
    };

    const handleTimeChange = (e) => {
        const newTime = e.target.value;
        setSelectedTime(newTime);
        loadOccupancy(branchId, floorId, tables, newTime);
    };

    const handleSelectItem = async (item) => {
        if (item.type !== 'table') {
            setSelectedTableId(null);
            setSelectedBooking(null);
            return;
        }
        const tableId = item.tableId || item.meta?.table_id || tableByLayoutItem[String(item.id)]?.id;
        if (!tableId) return;

        setSelectedTableId(tableId);
        let booking = bookingByTableId[String(tableId)] || null;

        const occ = occupancy[String(tableId)];
        if (occ?.booking_id && !booking) {
            try {
                const full = await getPartnerBooking(occ.booking_id);
                booking = full;
                setBookingByTableId((prev) => ({ ...prev, [String(tableId)]: full }));
            } catch {
                // ignore
            }
        }

        setSelectedBooking(booking);

        // Stol band bo'lsa Booking Details modalini ochish, bo'sh bo'lsa Manual Book
        if (occ?.is_occupied) {
            setShowBookingDetailsModal(true);
        } else if (canBook) {
            setBookDefaults({
                floor: String(floorId),
                zone: item.zoneId ? String(item.zoneId) : '',
                table: String(tableId),
            });
            setShowBookModal(true);
        }
    };

    const handleBookingAction = async (actionType, note = '') => {
        if (!selectedBooking?.id) return;
        setActionLoading(true);
        setError('');
        try {
            switch (actionType) {
                case 'cancel':
                    await updateBookingStatus(selectedBooking.id, 'canceled', note);
                    break;
                case 'noshow':
                    await noShowBooking(selectedBooking.id, note);
                    break;
                case 'confirm':
                    await updateBookingStatus(selectedBooking.id, 'confirmed', note);
                    break;
                case 'checkin':
                    await checkInBooking(selectedBooking.id, { note });
                    break;
                case 'complete':
                    await updateBookingStatus(selectedBooking.id, 'completed', note);
                    break;
                default:
                    break;
            }
            setShowBookingDetailsModal(false);
            setSelectedBooking(null);
            setSelectedTableId(null);
            await loadOccupancy(branchId, floorId, tables, selectedTime);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className={styles.floorContainer}>
            <div className={styles.toolbar} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#fff' }}>Live Floor View</h2>

                <div className={styles.legend}>
                    {LEGEND_ITEMS.map((li) => (
                        <div key={li.key} className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles[li.dotClass]}`} />
                            {li.label}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1a1a1a', padding: '8px 12px', borderRadius: '8px', border: '1px solid #333' }}>
                        <input
                            type="time"
                            value={selectedTime}
                            onChange={handleTimeChange}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', outline: 'none', cursor: 'pointer' }}
                        />
                        <span style={{ color: '#666' }}>🕒</span>
                    </div>

                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => loadOccupancy(branchId, floorId, tables, selectedTime)}
                        disabled={!branchId}
                        style={{ padding: '10px 16px', borderRadius: '8px' }}
                    >
                        {refreshing ? t('common.refreshing') : 'Refresh'}
                    </button>

                    <select
                        value={floorId}
                        onChange={(e) => handleFloorChange(e.target.value)}
                        disabled={!branchId}
                        style={{ padding: '10px 12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', outline: 'none' }}
                    >
                        <option value="">{t('common.selectFloor')}</option>
                        {floors.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>

                    {isOwner && (
                        <BrandBranchSelect
                            brandId={brandId}
                            branchId={branchId}
                            onBrandChange={setBrandId}
                            onBranchChange={handleBranchChange}
                        />
                    )}
                </div>
            </div>

            <div className={styles.workspace} style={{ gridTemplateColumns: '1fr' }}>
                <div className={styles.canvasWrap}>
                    {error && <div className={styles.errorBanner}>{error}</div>}
                    {loading ? (
                        <div className={styles.emptyState}>{t('layout.loadingLive')}</div>
                    ) : !floorId ? (
                        <div className={styles.emptyState}>{t('layout.pickFloorHint')}</div>
                    ) : (
                        <div
                            className={styles.canvas}
                            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setHoveredTableId(null)}
                        >
                            <FloorCanvas
                                width={CANVAS_W}
                                height={CANVAS_H}
                                items={enrichedItems}
                                selectedId={
                                    selectedTable
                                        ? enrichedItems.find((i) => String(i.tableId || i.meta?.table_id) === String(selectedTable.id))?.id
                                        : null
                                }
                                editable={false}
                                statusByLayoutItemId={statusByLayoutItemId}
                                zoneColorById={{}}
                                onSelect={handleSelectItem}
                                onHover={(item) => {
                                    console.log('[DEBUG] onHover fired:', item);
                                    if (item?.type === 'table') {
                                        const tid = item.tableId || item.meta?.table_id;
                                        setHoveredTableId(tid);
                                    } else {
                                        setHoveredTableId(null);
                                    }
                                }}
                                onBackgroundClick={() => {
                                    setSelectedTableId(null);
                                    setSelectedBooking(null);
                                }}
                            />

                            {/* HOVER TOOLTIP */}
                            {hoveredTable && (
                                <div
                                    className={styles.tooltipBox}
                                    style={{ position: 'fixed', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 9999 }}
                                >
                                    <div className={styles.tooltipHeader}>
                                        <span className={styles.tooltipTitle}>{hoveredTable.name}</span>
                                        <span className={hoveredOcc?.is_occupied ? styles.tooltipBadgeBusy : styles.tooltipBadgeFree}>
                                            {hoveredOcc?.is_occupied ? t('layout.busy') : t('layout.available')}
                                        </span>
                                    </div>
                                    <div className={styles.tooltipBody}>
                                        <div>{hoveredTable.seats} {t('common.seats')} • {hoveredTable.zoneName || '—'}</div>
                                        {hoveredOcc?.is_occupied && hoveredBooking && (
                                            <div className={styles.tooltipBookingInfo}>
                                                <div className={styles.tooltipRow}>
                                                    <span>👤</span> {hoveredBooking.guestName || t('bookings.guest')}
                                                </div>
                                                <div className={styles.tooltipRow}>
                                                    <span>⏰</span> {hoveredBooking.time} {hoveredBooking.endTime ? `- ${hoveredBooking.endTime}` : ''}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Booking Modal */}
            {showBookModal && (
                <ManualBookingModal
                    initialValues={bookDefaults}
                    onClose={() => setShowBookModal(false)}
                    onSuccess={async () => {
                        setShowBookModal(false);
                        await loadOccupancy(branchId, floorId, tables, selectedTime);
                    }}
                />
            )}

            {/* Booking Details Modal */}
            {showBookingDetailsModal && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    table={selectedTable}
                    loading={actionLoading}
                    onClose={() => setShowBookingDetailsModal(false)}
                    onAction={handleBookingAction}
                />
            )}
        </div>
    );
}