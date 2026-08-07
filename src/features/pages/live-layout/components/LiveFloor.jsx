import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const CANVAS_W = 900;
const CANVAS_H = 560;
const POLL_MS = 20000;

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
        // ignore storage errors (private mode, quota, etc.)
    }
}

function toIso(date) {
    return date.toISOString();
}

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



export default function LiveFloor() {
    const { t } = useTranslation();
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const canBook = canCreateManualBooking();
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';

    const [brandId, setBrandId] = useState(() => readStoredValue(BRAND_STORAGE_KEY));
    const [branchId, setBranchId] = useState(() => assignedBranchId || readStoredValue(BRANCH_STORAGE_KEY));
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

    const [selectedTime, setSelectedTime] = useState('');
    const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Track the whole hovered layout item (not just a resolved table id) so the
    // tooltip still shows for tables whose backend link to a `tables` row is
    // momentarily missing (e.g. just-created tables before a full refresh).
    const [hoveredItem, setHoveredItem] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const canvasWrapRef = useRef(null);
    const [canvasScale, setCanvasScale] = useState(1);

    const LEGEND_ITEMS = [
        { key: 'available', label: t('status.available'), dotClass: 'availableDot' },
        { key: 'pending', label: t('status.pending'), dotClass: 'pendingDot' },
        { key: 'confirmed', label: t('status.confirmed'), dotClass: 'confirmedDot' },
        { key: 'checked_in', label: t('status.checkedIn'), dotClass: 'checkedInDot' },
    ];

    const currentFloor = useMemo(
        () => floors.find((f) => String(f.id) === String(floorId)) || null,
        [floors, floorId]
    );
    const zones = currentFloor?.zones || [];
    const zoneById = useMemo(() => {
        const map = {};
        zones.forEach((z) => { map[String(z.id)] = z; });
        return map;
    }, [zones]);
    const zoneColorById = useMemo(() => {
        const map = {};
        zones.forEach((z) => { map[z.id] = z.color || '#8c1919'; });
        return map;
    }, [zones]);



    const tableById = useMemo(() => {
        const map = {};
        tables.forEach((t) => { map[String(t.id)] = t; });
        return map;
    }, [tables]);

    const enrichedItems = useMemo(() => items.map((item) => {
        if (item.type !== 'table') return item;
        const table = tableById[String(item.id)] || null;
        const seats = item.seats || table?.seats || item.meta?.seats || 0;
        return {
            ...item,
            name: item.name || table?.name || '',
            seats,
            meta: { ...item.meta, seats, table_id: item.id },
            tableId: item.id,
        };
    }), [items, tableById]);

    const statusByLayoutItemId = useMemo(() => {
        const map = {};
        enrichedItems.forEach((item) => {
            if (item.type !== 'table') {
                map[item.id] = 'facility';
                return;
            }
            const occ = occupancy[String(item.id)];
            if (!occ?.is_occupied) {
                map[item.id] = 'available';
                return;
            }
            map[item.id] = statusKey(occ.status);
        });
        return map;
    }, [enrichedItems, occupancy]);

    const selectedTable = selectedTableId ? tableById[String(selectedTableId)] : null;

    const hoveredTableId = hoveredItem?.tableId || hoveredItem?.meta?.table_id || null;
    const hoveredTable = hoveredTableId ? tableById[String(hoveredTableId)] : null;
    const hoveredOcc = hoveredTableId ? occupancy[String(hoveredTableId)] : null;
    const hoveredBooking = hoveredTableId ? bookingByTableId[String(hoveredTableId)] : null;
    const hoveredZoneName = hoveredItem?.zoneId
        ? (zoneById[String(hoveredItem.zoneId)]?.name || hoveredTable?.zoneName)
        : hoveredTable?.zoneName;

    useEffect(() => {
        const el = canvasWrapRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const recompute = () => {
            const available = el.clientWidth;
            if (!available) return;
            setCanvasScale(Math.min(1, available / CANVAS_W));
        };
        recompute();
        const observer = new ResizeObserver(recompute);
        observer.observe(el);
        return () => observer.disconnect();
    }, [floorId, loading, branchId]);

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
                    setError(t('common.noBranchAssigned'));
                    setLoading(false);
                } else if (isOwner && branchId) {
                    await loadLayout(branchId);
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
                // ignore
            } finally {
                setRefreshing(false);
            }
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [branchId, floorId, tables, loadOccupancy, selectedTime]);

    const handleBrandChange = (value) => {
        setBrandId(value);
        writeStoredValue(BRAND_STORAGE_KEY, value);
    };

    const handleBranchChange = async (value) => {
        setBranchId(value);
        writeStoredValue(BRANCH_STORAGE_KEY, value);
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
        setHoveredItem(null);
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
        const tableId = item.tableId || item.id; // stol = layout element
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
        setError('');

        if (occ?.is_occupied) {
            setShowBookingDetailsModal(true);
        } else if (canBook) {
            setBookDefaults({
                floor: String(floorId),
                zone: item.zoneId ? String(item.zoneId) : '',
                table: String(tableId),
            });
            setShowBookModal(true);
        } else {
            setShowBookingDetailsModal(true);
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
            <div className={styles.toolbar}>
                <h2 className={styles.toolbarTitle}>{t('layout.liveFloorView')}</h2>

                <div className={styles.legend}>
                    {LEGEND_ITEMS.map((li) => (
                        <div key={li.key} className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles[li.dotClass]}`} />
                            {li.label}
                        </div>
                    ))}
                </div>

                <div className={styles.toolbarGroup}>
                    {isOwner && (
                        <BrandBranchSelect
                            brandId={brandId}
                            branchId={branchId}
                            onBrandChange={handleBrandChange}
                            onBranchChange={handleBranchChange}
                        />
                    )}

                    <select
                        className={styles.input}
                        value={floorId}
                        onChange={(e) => handleFloorChange(e.target.value)}
                        disabled={!branchId}
                    >
                        <option value="">{t('common.selectFloor')}</option>
                        {floors.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>

                    <div className={styles.timePicker}>
                        <input
                            type="time"
                            className={styles.timeInput}
                            value={selectedTime}
                            onChange={handleTimeChange}
                        />
                        <span className={styles.timeIcon}>&#128337;</span>
                    </div>

                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => loadOccupancy(branchId, floorId, tables, selectedTime)}
                        disabled={!branchId}
                    >
                        {refreshing ? t('common.refreshing') : t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className={styles.workspace} style={{ gridTemplateColumns: '1fr' }}>
                <div className={styles.canvasWrap}>
                    {error && <div className={styles.errorBanner}>{error}</div>}
                    {loading ? (
                        <div className={styles.emptyState}>{t('layout.loadingLive')}</div>
                    ) : !branchId ? (
                        <div className={styles.emptyState}>{t('layout.pickBranchHint') || 'Iltimos, filialni tanlang'}</div>
                    ) : !floorId ? (
                        <div className={styles.emptyState}>{t('layout.pickFloorHint')}</div>
                    ) : (
                        <div
                            className={styles.canvas}
                            ref={canvasWrapRef}
                            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setHoveredItem(null)}
                        >
                            <div
                                className={styles.canvasScaler}
                                style={{ width: CANVAS_W * canvasScale, height: CANVAS_H * canvasScale }}
                            >
                                <div
                                    style={{
                                        width: CANVAS_W,
                                        height: CANVAS_H,
                                        transform: `scale(${canvasScale})`,
                                        transformOrigin: 'top left',
                                    }}
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
                                        zoneColorById={zoneColorById}
                                        onSelect={handleSelectItem}
                                        onHover={(item) => setHoveredItem(item?.type === 'table' ? item : null)}
                                        onBackgroundClick={() => {
                                            setSelectedTableId(null);
                                            setSelectedBooking(null);
                                        }}
                                    />
                                </div>
                            </div>

                            {hoveredItem && (
                                <div
                                    className={styles.tooltipBox}
                                    style={{ position: 'fixed', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 9999 }}
                                >
                                    <div className={styles.tooltipHeader}>
                                        <span className={styles.tooltipTitle}>
                                            {hoveredTable?.name || hoveredItem.name || t('layout.types.table')}
                                        </span>
                                        <span className={hoveredOcc?.is_occupied ? styles.tooltipBadgeBusy : styles.tooltipBadgeFree}>
                                            {hoveredOcc?.is_occupied ? t('layout.busy') : t('layout.available')}
                                        </span>
                                    </div>
                                    <div className={styles.tooltipBody}>
                                        <div>
                                            {hoveredTable?.seats || hoveredItem.meta?.seats || '—'} {t('common.seats')} &bull; {hoveredZoneName || t('common.noZone')}
                                        </div>
                                        {hoveredOcc?.is_occupied && hoveredBooking && (
                                            <div className={styles.tooltipBookingInfo}>
                                                <div className={styles.tooltipRow}>
                                                    <span>&#128100;</span> {hoveredBooking.guestName || t('bookings.guest')}
                                                </div>
                                                <div className={styles.tooltipRow}>
                                                    <span>&#9200;</span> {hoveredBooking.time} {hoveredBooking.endTime ? `- ${hoveredBooking.endTime}` : ''}
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

            {showBookingDetailsModal && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    table={selectedTable}
                    loading={actionLoading}
                    onClose={() => setShowBookingDetailsModal(false)}
                    onAction={handleBookingAction}
                    onCreateBooking={() => {
                        setShowBookingDetailsModal(false);
                        setBookDefaults({
                            floor: String(floorId),
                            zone: selectedTable?.zoneId ? String(selectedTable.zoneId) : '',
                            table: String(selectedTableId),
                        });
                        setShowBookModal(true);
                    }}
                />
            )}
        </div>
    );
}