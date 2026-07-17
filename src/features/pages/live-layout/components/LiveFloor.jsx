import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../LiveLayout.module.css';
import FloorCanvas from '../../layout/components/FloorCanvas';
import ManualBookingModal from '../../bookings/components/ManualBookingModal';
import BrandBranchSelect from '../../../../components/BrandBranchSelect';
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
} from '../../../../services/bookings.services';
import { getApiError, unwrapList } from '../../../../utils/apiHelpers';
import { canCreateManualBooking, getStoredUser } from '../../../../utils/authUser';
import { translateStatus } from '../../../../utils/statusI18n';

const CANVAS_W = 960;
const CANVAS_H = 640;
const POLL_MS = 20000;

function toIso(date) {
    return date.toISOString();
}

function currentWindow() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 3);
    return { start: toIso(start), end: toIso(end) };
}

function formatSource(source, t) {
    const raw = String(source || '').toLowerCase();
    if (raw.includes('manual') || raw === 'partner_manual') return t('bookings.sourceManual');
    if (raw === 'app') return t('bookings.sourceApp');
    return source || '—';
}

function statusKey(status) {
    const raw = String(status || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    if (raw === 'checkedin' || raw === 'checked_in') return 'checked_in';
    if (raw === 'pending') return 'pending';
    if (raw === 'confirmed') return 'confirmed';
    if (raw === 'occupied') return 'occupied';
    return 'available';
}

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

    const currentFloor = useMemo(
        () => floors.find((f) => String(f.id) === String(floorId)) || null,
        [floors, floorId]
    );

    const zoneColorById = useMemo(() => {
        const map = {};
        (currentFloor?.zones || []).forEach((z) => { map[z.id] = z.color || '#8c1919'; });
        return map;
    }, [currentFloor]);

    const tableByLayoutItem = useMemo(() => {
        const map = {};
        tables.forEach((t) => {
            if (t.layoutItemId) map[String(t.layoutItemId)] = t;
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
            map[item.id] = statusKey(occ.status) === 'available' ? 'occupied' : statusKey(occ.status);
        });
        return map;
    }, [enrichedItems, occupancy]);

    const selectedTable = selectedTableId ? tableById[String(selectedTableId)] : null;
    const selectedOcc = selectedTableId ? occupancy[String(selectedTableId)] : null;

    const loadOccupancy = useCallback(async (nextBranchId, nextFloorId, tableList) => {
        if (!nextBranchId) return;
        const { start, end } = currentWindow();
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
                // fallback below
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

        // ensure every occupied table has at least a stub from occupancy
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
    }, [tables]);

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

            await loadOccupancy(nextBranchId, nextFloorId, tableList);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, [assignedBranchId, isOwner, loadOccupancy]);

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
                    // Owner waits for BrandBranchSelect
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!branchId || !floorId) return undefined;
        const timer = setInterval(async () => {
            try {
                setRefreshing(true);
                await loadOccupancy(branchId, floorId, tables);
            } catch {
                // keep last good state
            } finally {
                setRefreshing(false);
            }
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [branchId, floorId, tables, loadOccupancy]);

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
            await loadOccupancy(branchId, value, tableList);
        } catch (err) {
            setError(getApiError(err));
        }
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
        const booking = bookingByTableId[String(tableId)] || null;
        setSelectedBooking(booking);

        const occ = occupancy[String(tableId)];
        if (occ?.booking_id && !booking) {
            try {
                const full = await getPartnerBooking(occ.booking_id);
                setSelectedBooking(full);
                setBookingByTableId((prev) => ({ ...prev, [String(tableId)]: full }));
            } catch {
                // ignore
            }
        }
    };

    const openBookForTable = (table) => {
        if (!canBook || !table) return;
        setBookDefaults({
            floor: String(floorId),
            zone: table.zoneId ? String(table.zoneId) : '',
            table: String(table.id),
        });
        setShowBookModal(true);
    };

    const occupiedCount = useMemo(
        () => Object.values(occupancy).filter((o) => o.is_occupied).length,
        [occupancy]
    );
    const availableCount = useMemo(
        () => tables.filter((t) => t.is_active && String(t.floorId) === String(floorId) && !occupancy[String(t.id)]?.is_occupied).length,
        [tables, floorId, occupancy]
    );

    return (
        <div className={styles.floorContainer}>
            <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    {isOwner && (
                        <BrandBranchSelect
                            brandId={brandId}
                            branchId={branchId}
                            onBrandChange={setBrandId}
                            onBranchChange={handleBranchChange}
                            fieldClassName={styles.field}
                        />
                    )}
                    <label className={styles.field}>
                        <span>{t('common.floor')}</span>
                        <select value={floorId} onChange={(e) => handleFloorChange(e.target.value)} disabled={!branchId}>
                            <option value="">{t('common.selectFloor')}</option>
                            {floors.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.stats}>
                    <span className={styles.statPill}>{availableCount} {t('layout.free')}</span>
                    <span className={styles.statPillBusy}>{occupiedCount} {t('layout.busy')}</span>
                    {refreshing && <span className={styles.muted}>{t('common.refreshing')}</span>}
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => loadOccupancy(branchId, floorId, tables)}
                        disabled={!branchId}
                    >
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className={styles.workspace}>
                <div className={styles.canvasWrap}>
                    <header className={styles.header}>
                        <div className={styles.legend}>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.availableDot}`} /> {t('layout.available')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.pendingDot}`} /> {t('layout.pending')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.confirmedDot}`} /> {t('layout.confirmed')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.checkedInDot}`} /> {t('layout.checkedIn')}</span>
                        </div>
                    </header>

                    {error && <div className={styles.errorBanner}>{error}</div>}
                    {loading ? (
                        <div className={styles.emptyState}>{t('layout.loadingLive')}</div>
                    ) : !floorId ? (
                        <div className={styles.emptyState}>{t('layout.pickFloorHint')}</div>
                    ) : (
                        <div className={styles.canvas}>
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
                                onBackgroundClick={() => {
                                    setSelectedTableId(null);
                                    setSelectedBooking(null);
                                }}
                            />
                        </div>
                    )}
                </div>

                <aside className={styles.detailPanel}>
                    <h3>{t('layout.tableDetails')}</h3>
                    {!selectedTable ? (
                        <p className={styles.muted}>{t('layout.selectTableHint')}</p>
                    ) : (
                        <div className={styles.detailCard}>
                            <div className={styles.detailTitle}>{selectedTable.name}</div>
                            <div className={styles.detailRow}><span>{t('common.seats')}</span><strong>{selectedTable.seats}</strong></div>
                            <div className={styles.detailRow}>
                                <span>{t('common.zone')}</span>
                                <strong>{selectedTable.zoneName || selectedTable.zoneId || '—'}</strong>
                            </div>
                            <div className={styles.detailRow}>
                                <span>{t('common.status')}</span>
                                <strong className={styles[`status_${statusKey(selectedOcc?.is_occupied ? selectedOcc.status : 'available')}`]}>
                                    {translateStatus(
                                        t,
                                        selectedOcc?.is_occupied ? statusKey(selectedOcc.status) : 'available'
                                    )}
                                </strong>
                            </div>

                            {selectedOcc?.is_occupied ? (
                                <>
                                    <hr className={styles.divider} />
                                    <div className={styles.detailRow}>
                                        <span>{t('bookings.guest')}</span>
                                        <strong>{selectedBooking?.guestName || '—'}</strong>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span>{t('common.phone')}</span>
                                        <strong>{selectedBooking?.phone || '—'}</strong>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span>{t('common.source')}</span>
                                        <strong>{formatSource(selectedBooking?.source, t)}</strong>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span>{t('common.time')}</span>
                                        <strong>
                                            {(selectedBooking?.time || '—')}
                                            {selectedBooking?.endTime ? ` – ${selectedBooking.endTime}` : ''}
                                        </strong>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span>{t('common.guests')}</span>
                                        <strong>
                                            {selectedBooking?.guest_count ?? '—'}
                                            {selectedBooking?.children_count
                                                ? ` (${t('layout.kids', { count: selectedBooking.children_count })})`
                                                : ''}
                                        </strong>
                                    </div>
                                    {selectedBooking?.special_request ? (
                                        <p className={styles.note}>{selectedBooking.special_request}</p>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <p className={styles.muted}>{t('layout.tableEmpty')}</p>
                                    {canBook && (
                                        <button
                                            type="button"
                                            className={styles.primaryBtn}
                                            onClick={() => openBookForTable(selectedTable)}
                                        >
                                            {t('layout.bookThisTable')}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <h3>{t('layout.busyNow')}</h3>
                    <ul className={styles.busyList}>
                        {tables
                            .filter((tbl) => String(tbl.floorId) === String(floorId) && occupancy[String(tbl.id)]?.is_occupied)
                            .map((tbl) => {
                                const booking = bookingByTableId[String(tbl.id)];
                                const occ = occupancy[String(tbl.id)];
                                return (
                                    <li key={tbl.id}>
                                        <button type="button" onClick={() => {
                                            setSelectedTableId(tbl.id);
                                            setSelectedBooking(booking || null);
                                        }}>
                                            <strong>{tbl.name}</strong>
                                            <span>{formatSource(booking?.source, t)} · {translateStatus(t, statusKey(occ?.status))}</span>
                                            <span>{booking?.guestName || t('bookings.guest')}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        {!tables.some((tbl) => String(tbl.floorId) === String(floorId) && occupancy[String(tbl.id)]?.is_occupied) && (
                            <li className={styles.muted}>{t('layout.noBusy')}</li>
                        )}
                    </ul>
                </aside>
            </div>

            {showBookModal && (
                <ManualBookingModal
                    initialValues={bookDefaults}
                    onClose={() => setShowBookModal(false)}
                    onSuccess={async () => {
                        setShowBookModal(false);
                        await loadOccupancy(branchId, floorId, tables);
                    }}
                />
            )}
        </div>
    );
}
