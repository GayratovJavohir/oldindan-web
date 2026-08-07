import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../Floor.module.css';
import FloorCanvas from './FloorCanvas';
import BrandBranchSelect from '../../../../components/BrandBranchSelect';
import { getPartnerBranches } from '../../../../services/restaurants.services';
import {
    LAYOUT_ITEM_TYPES,
    ZONE_COLORS,
    buildLayoutItemPayload,
    createPartnerFloor,
    createPartnerLayoutItem,
    createPartnerZone,
    deletePartnerFloor,
    deletePartnerLayoutItem,
    deletePartnerZone,
    getPartnerFloors,
    getPartnerLayoutItems,
    getTypeDefaults,
    patchPartnerFloor,
    patchPartnerLayoutItem,
} from '../../../../services/layouts.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { getStoredUser } from '../../../../utils/authUser';

const CANVAS_W = 900;
const CANVAS_H = 560;
const ALL_ZONES = 'all';
const NO_ZONE = 'none';

function nextTempId() {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Tables scale with seat count so a 2-top and a 6-top look different,
 * regardless of whether the shape is round or rect.
 */
function tableSizeForSeats(seats, shape) {
    const s = Math.max(1, Number(seats) || 2);
    const base = Math.round(64 + Math.min(80, (s - 2) * 8));
    const width = shape === 'rect' ? Math.round(base * 1.3) : base;
    const height = base;
    return { width, height };
}

/**
 * Small in-app modal that replaces window.prompt / window.confirm.
 * kind: 'prompt' -> text input + submit
 * kind: 'confirm' -> message + confirm/cancel
 */
function AppModal({ modal, onClose }) {
    const { t } = useTranslation();
    const [value, setValue] = useState(modal?.initialValue || '');

    useEffect(() => {
        setValue(modal?.initialValue || '');
    }, [modal]);

    if (!modal) return null;

    const submitPrompt = (e) => {
        e.preventDefault();
        modal.onSubmit?.(value);
    };

    return (
        <div className={styles.modalOverlay} onMouseDown={onClose}>
            <div className={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                <h4 className={styles.modalTitle}>{modal.title}</h4>
                {modal.message && <p className={styles.modalMessage}>{modal.message}</p>}

                {modal.kind === 'prompt' && (
                    <form onSubmit={submitPrompt} className={styles.stack}>
                        <input
                            autoFocus
                            className={styles.input}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                                {t('common.cancel', 'Bekor qilish')}
                            </button>
                            <button type="submit" className={styles.primaryBtn}>
                                {t('common.save', 'Saqlash')}
                            </button>
                        </div>
                    </form>
                )}

                {modal.kind === 'confirm' && (
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                            {t('common.cancel', 'Bekor qilish')}
                        </button>
                        <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => modal.onConfirm?.()}
                        >
                            {modal.confirmLabel || t('common.delete', 'O\u2018chirish')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LayoutFloor() {
    const { t } = useTranslation();
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';
    const [searchParams, setSearchParams] = useSearchParams();
    const queryBranchId = searchParams.get('branchId') || '';
    const queryBrandId = searchParams.get('brandId') || '';

    const [brandId, setBrandId] = useState(queryBrandId);
    const [branchId, setBranchId] = useState(queryBranchId || assignedBranchId);
    const [floors, setFloors] = useState([]);
    const [floorId, setFloorId] = useState('');
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [paletteType, setPaletteType] = useState('table');
    const [zoneFilter, setZoneFilter] = useState(ALL_ZONES);
    const [showZoneForm, setShowZoneForm] = useState(false);
    const [showFloorForm, setShowFloorForm] = useState(false);
    const [modal, setModal] = useState(null);
    const canvasWrapRef = useRef(null);
    const [canvasScale, setCanvasScale] = useState(1);

    const [floorForm, setFloorForm] = useState({ name: '', sort_order: 0 });
    const [zoneForm, setZoneForm] = useState({ name: '', color: ZONE_COLORS[0] });
    const [tableDraft, setTableDraft] = useState({ name: '', seats: 4, shape: 'round' });

    const closeModal = () => setModal(null);

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
    }, [floorId, loading]);

    const currentFloor = useMemo(
        () => floors.find((f) => String(f.id) === String(floorId)) || null,
        [floors, floorId]
    );
    const zones = currentFloor?.zones || [];
    const zoneColorById = useMemo(() => {
        const map = {};
        zones.forEach((z) => { map[z.id] = z.color || '#8c1919'; });
        return map;
    }, [zones]);

    const selectedItem = useMemo(
        () => items.find((i) => String(i.id || i.tempId) === String(selectedId)) || null,
        [items, selectedId]
    );

    // `seats` lives directly on the LayoutItem now (a real backend field),
    // so tables no longer need to be looked up against a separate list —
    // this just makes sure the editor's `meta.seats` (used by the inspector
    // input) always mirrors the authoritative value coming from the API.
    const enrichedItems = useMemo(() => items.map((item) => {
        if (item.type !== 'table') return item;
        const seats = item.meta?.seats ?? item.seats ?? 4;
        return {
            ...item,
            seats,
            meta: { ...item.meta, seats },
        };
    }), [items]);

    const visibleItems = useMemo(() => {
        if (zoneFilter === ALL_ZONES) return enrichedItems;
        if (zoneFilter === NO_ZONE) return enrichedItems.filter((i) => !i.zoneId);
        return enrichedItems.filter((i) => String(i.zoneId) === String(zoneFilter));
    }, [enrichedItems, zoneFilter]);

    // How many tables sit in each zone - shown as a small counter on the zone chip.
    const tableCountByZone = useMemo(() => {
        const map = {};
        enrichedItems.forEach((item) => {
            if (item.type !== 'table') return;
            const key = item.zoneId ? String(item.zoneId) : NO_ZONE;
            map[key] = (map[key] || 0) + 1;
        });
        return map;
    }, [enrichedItems]);

    const loadBranchData = useCallback(async (nextBranchId, preferredFloorId = null) => {
        if (!nextBranchId) {
            setFloors([]);
            setFloorId('');
            setItems([]);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const [floorList, layoutItems] = await Promise.all([
                getPartnerFloors(),
                getPartnerLayoutItems({ branch_id: nextBranchId }),
            ]);

            const branchFloors = floorList
                .filter((f) => String(f.branchId) === String(nextBranchId))
                .sort((a, b) => a.sortOrder - b.sortOrder);

            setFloors(branchFloors);

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
            setSelectedId(null);
            setZoneFilter(ALL_ZONES);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (isOwner) {
                    if (queryBranchId) {
                        try {
                            const list = await getPartnerBranches();
                            const match = list.find((b) => String(b.id) === String(queryBranchId));
                            if (match?.brandId) setBrandId(String(match.brandId));
                        } catch {
                            // ignore
                        }
                        setBranchId(String(queryBranchId));
                        await loadBranchData(String(queryBranchId));
                    } else {
                        setLoading(false);
                    }
                } else if (assignedBranchId) {
                    setBranchId(assignedBranchId);
                    await loadBranchData(assignedBranchId);
                } else {
                    setError(t('common.noBranchAssigned'));
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
        if (!isOwner || !queryBranchId) return;
        if (String(queryBranchId) === String(branchId)) return;
        setBranchId(String(queryBranchId));
        loadBranchData(String(queryBranchId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryBranchId]);

    const reloadFloorItems = async (nextFloorId = floorId) => {
        if (!branchId || !nextFloorId) {
            setItems([]);
            return;
        }
        const layoutItems = await getPartnerLayoutItems({ branch_id: branchId, floor_id: nextFloorId });
        setItems(layoutItems);
    };

    const handleBranchChange = async (value) => {
        setBranchId(value);
        setMessage('');
        const params = {};
        if (brandId) params.brandId = String(brandId);
        if (value) params.branchId = String(value);
        setSearchParams(params);
        if (value) await loadBranchData(value);
        else {
            setFloors([]);
            setFloorId('');
            setItems([]);
            setLoading(false);
        }
    };

    const handleFloorChange = async (value) => {
        setFloorId(value);
        setSelectedId(null);
        setZoneFilter(ALL_ZONES);
        setMessage('');
        try {
            await reloadFloorItems(value);
        } catch (err) {
            setError(getApiError(err));
        }
    };

    const handleCreateFloor = async () => {
        if (!branchId || !floorForm.name.trim()) {
            setError(t('layout.needFloorName'));
            return;
        }
        setSaving(true);
        setError('');
        try {
            const floor = await createPartnerFloor({
                branch: Number(branchId),
                name: floorForm.name.trim(),
                sort_order: Number(floorForm.sort_order) || 0,
                is_active: true,
            });
            setFloorForm({ name: '', sort_order: 0 });
            setShowFloorForm(false);
            setMessage(t('layout.floorCreated'));
            await loadBranchData(branchId, floor.id);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleRenameFloor = () => {
        if (!currentFloor) return;
        setModal({
            kind: 'prompt',
            title: t('layout.renameFloorPrompt'),
            initialValue: currentFloor.name,
            onSubmit: async (name) => {
                if (!name?.trim()) return;
                closeModal();
                setSaving(true);
                setError('');
                try {
                    await patchPartnerFloor(currentFloor.id, { name: name.trim() });
                    await loadBranchData(branchId, currentFloor.id);
                    setMessage(t('layout.floorUpdated'));
                } catch (err) {
                    setError(getApiError(err));
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const handleDeleteFloor = () => {
        if (!currentFloor) return;
        setModal({
            kind: 'confirm',
            title: t('layout.confirmDeleteFloor', { name: currentFloor.name }),
            confirmLabel: t('layout.deleteFloor'),
            onConfirm: async () => {
                closeModal();
                setSaving(true);
                setError('');
                try {
                    await deletePartnerFloor(currentFloor.id);
                    setMessage(t('layout.floorDeleted'));
                    await loadBranchData(branchId);
                } catch (err) {
                    setError(getApiError(err));
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const handleCreateZone = async () => {
        if (!floorId || !zoneForm.name.trim()) {
            setError(t('layout.needZoneFloor'));
            return;
        }
        setSaving(true);
        setError('');
        try {
            const zone = await createPartnerZone({
                floor: Number(floorId),
                name: zoneForm.name.trim(),
                color: zoneForm.color,
                sort_order: zones.length,
                is_active: true,
            });
            setZoneForm({ name: '', color: ZONE_COLORS[(zones.length + 1) % ZONE_COLORS.length] });
            setShowZoneForm(false);
            await loadBranchData(branchId, floorId);
            setZoneFilter(String(zone.id));
            setMessage(t('layout.zoneCreated'));
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteZone = (zone) => {
        setModal({
            kind: 'confirm',
            title: t('layout.confirmDeleteZone', { name: zone.name }),
            onConfirm: async () => {
                closeModal();
                setSaving(true);
                setError('');
                try {
                    await deletePartnerZone(zone.id);
                    if (String(zoneFilter) === String(zone.id)) setZoneFilter(ALL_ZONES);
                    await loadBranchData(branchId, floorId);
                    setMessage(t('layout.zoneDeleted'));
                } catch (err) {
                    setError(getApiError(err));
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    const addItemFromPalette = () => {
        if (!floorId) {
            setError(t('layout.needFloorFirst'));
            return;
        }
        const defaults = getTypeDefaults(paletteType);
        const isTable = paletteType === 'table';
        const tempId = nextTempId();
        const activeZoneId = zoneFilter !== ALL_ZONES && zoneFilter !== NO_ZONE ? Number(zoneFilter) : null;
        const tableSize = isTable ? tableSizeForSeats(tableDraft.seats, tableDraft.shape) : null;
        const item = {
            tempId,
            id: null,
            floorId: Number(floorId),
            zoneId: activeZoneId,
            type: paletteType,
            name: isTable ? (tableDraft.name || `T${items.filter((i) => i.type === 'table').length + 1}`) : defaults.label,
            x: 80 + (items.length % 6) * 40,
            y: 80 + Math.floor(items.length / 6) * 40,
            width: isTable ? tableSize.width : defaults.defaultWidth,
            height: isTable ? tableSize.height : defaults.defaultHeight,
            rotation: 0,
            shape: isTable ? tableDraft.shape : defaults.defaultShape,
            zIndex: isTable ? 10 : 1,
            seats: isTable ? (Number(tableDraft.seats) || 4) : 0,
            meta: isTable ? { seats: Number(tableDraft.seats) || 4 } : {},
            isActive: true,
            dirty: true,
            isNew: true,
        };
        setItems((prev) => [...prev, item]);
        setSelectedId(tempId);
        setMessage(t('layout.itemAdded'));
    };

    const updateSelectedLocal = (patch) => {
        if (!selectedItem) return;
        const key = selectedItem.id || selectedItem.tempId;
        setItems((prev) => prev.map((item) => {
            if (String(item.id || item.tempId) !== String(key)) return item;
            return { ...item, ...patch, dirty: true };
        }));
    };

    const handleItemChange = (target, next) => {
        const key = target.id || target.tempId;
        setItems((prev) => prev.map((item) => {
            if (String(item.id || item.tempId) !== String(key)) return item;
            return { ...item, ...next, dirty: true };
        }));
    };

    /**
     * Saves every dirty/new item as a plain LayoutItem. `seats` (for tables)
     * travels as a real top-level field via `buildLayoutItemPayload` — there
     * is no separate "table" record to create/patch/delete on the backend
     * (it doesn't exist), so this is now a single API call per item instead
     * of two.
     */
    const saveSelectedOrAll = async () => {
        if (!floorId) return;
        const dirty = items.filter((item) => item.dirty || item.isNew);
        if (!dirty.length) {
            setMessage(t('layout.noChanges', 'O\u2018zgarish yo\u2018q.'));
            return;
        }

        setSaving(true);
        setError('');
        try {
            for (const item of dirty) {
                const payload = buildLayoutItemPayload({
                    ...item,
                    floorId,
                });

                if (item.isNew || !item.id) {
                    await createPartnerLayoutItem(payload);
                } else {
                    await patchPartnerLayoutItem(item.id, payload);
                }
            }

            await reloadFloorItems(floorId);
            const refreshedFloors = await getPartnerFloors();
            setFloors(
                refreshedFloors
                    .filter((f) => String(f.branchId) === String(branchId))
                    .sort((a, b) => a.sortOrder - b.sortOrder)
            );
            setSelectedId(null);
            setMessage(t('layout.layoutSaved'));
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSelected = () => {
        if (!selectedItem) return;
        setModal({
            kind: 'confirm',
            title: t('layout.confirmDeleteItem'),
            onConfirm: async () => {
                closeModal();
                setSaving(true);
                setError('');
                try {
                    if (selectedItem.id) {
                        await deletePartnerLayoutItem(selectedItem.id);
                    }
                    setItems((prev) => prev.filter((item) => {
                        const key = item.id || item.tempId;
                        const selectedKey = selectedItem.id || selectedItem.tempId;
                        return String(key) !== String(selectedKey);
                    }));
                    setSelectedId(null);
                    setMessage(t('layout.itemDeleted'));
                    if (selectedItem.id) await reloadFloorItems(floorId);
                } catch (err) {
                    setError(getApiError(err));
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    return (
        <div className={styles.floorContainer}>
            <AppModal modal={modal} onClose={closeModal} />

            <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    {isOwner && (
                        <BrandBranchSelect
                            brandId={brandId}
                            branchId={branchId}
                            onBrandChange={(id) => setBrandId(id)}
                            onBranchChange={handleBranchChange}
                            fieldClassName={styles.field}
                            selectClassName={styles.input}
                        />
                    )}
                    <label className={styles.field}>
                        <select value={floorId} onChange={(e) => handleFloorChange(e.target.value)} disabled={!branchId}>
                            <option value="">{t('common.selectFloor')}</option>
                            {floors.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </label>
                    <button type="button" className={styles.iconBtn} onClick={handleRenameFloor} disabled={!currentFloor || saving} title={t('layout.rename')}>
                        &#9998;
                    </button>
                    <button type="button" className={styles.iconBtnDanger} onClick={handleDeleteFloor} disabled={!currentFloor || saving} title={t('layout.deleteFloor')}>
                        &#128465;
                    </button>
                </div>

                <div className={styles.toolbarGroup}>
                    {showFloorForm ? (
                        <>
                            <input
                                autoFocus
                                className={styles.input}
                                placeholder={t('layout.newFloor')}
                                value={floorForm.name}
                                onChange={(e) => setFloorForm((p) => ({ ...p, name: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFloor(); }}
                            />
                            <button type="button" className={styles.primaryBtn} onClick={handleCreateFloor} disabled={!branchId || saving}>
                                {t('layout.addFloor')}
                            </button>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setShowFloorForm(false)}>
                                {t('common.cancel', 'Bekor qilish')}
                            </button>
                        </>
                    ) : (
                        <button type="button" className={styles.secondaryBtn} onClick={() => setShowFloorForm(true)} disabled={!branchId}>
                            {`+ ${t('layout.addFloor')}`}
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.workspace}>
                <aside className={styles.sidebarPanel}>
                    <h3>{t('layout.palette')}</h3>
                    <div className={styles.paletteGrid}>
                        {LAYOUT_ITEM_TYPES.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                className={`${styles.paletteBtn} ${paletteType === type.value ? styles.paletteBtnActive : ''}`}
                                onClick={() => setPaletteType(type.value)}
                            >
                                {t(`layout.types.${type.value}`)}
                            </button>
                        ))}
                    </div>

                    {paletteType === 'table' && (
                        <div className={styles.stack}>
                            <input
                                className={styles.input}
                                placeholder={t('layout.tableName')}
                                value={tableDraft.name}
                                onChange={(e) => setTableDraft((p) => ({ ...p, name: e.target.value }))}
                            />
                            <div className={styles.row}>
                                <input
                                    className={styles.input}
                                    type="number"
                                    min="1"
                                    value={tableDraft.seats}
                                    onChange={(e) => setTableDraft((p) => ({ ...p, seats: Number(e.target.value) }))}
                                />
                                <select
                                    className={styles.input}
                                    value={tableDraft.shape}
                                    onChange={(e) => setTableDraft((p) => ({ ...p, shape: e.target.value }))}
                                >
                                    <option value="round">round</option>
                                    <option value="rect">rect</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {zoneFilter !== ALL_ZONES && (
                        <div className={styles.activeZoneHint}>
                            <span
                                className={styles.zoneDot}
                                style={{ background: zoneFilter === NO_ZONE ? '#555' : zoneColorById[zoneFilter] }}
                            />
                            {t('layout.addingInto', 'Qo\u2018shilmoqda:')}{' '}
                            <strong>
                                {zoneFilter === NO_ZONE
                                    ? t('common.noZone')
                                    : zones.find((z) => String(z.id) === String(zoneFilter))?.name}
                            </strong>
                        </div>
                    )}

                    <button type="button" className={styles.primaryBtn} onClick={addItemFromPalette} disabled={!floorId || saving}>
                        {t('layout.addToFloor')}
                    </button>

                    <div className={styles.actionsSticky}>
                        <button type="button" className={styles.primaryBtn} onClick={saveSelectedOrAll} disabled={saving || !floorId}>
                            {saving ? t('common.saving') : t('layout.saveLayout')}
                        </button>
                        <button type="button" className={styles.dangerBtn} onClick={handleDeleteSelected} disabled={!selectedItem || saving}>
                            {t('layout.deleteSelected')}
                        </button>
                    </div>
                </aside>

                <div className={styles.canvasWrap}>
                    <header className={styles.header}>
                        <div className={styles.zoneTabs}>
                            <button
                                type="button"
                                className={`${styles.zoneTab} ${zoneFilter === ALL_ZONES ? styles.zoneTabActive : ''}`}
                                onClick={() => setZoneFilter(ALL_ZONES)}
                            >
                                {t('layout.allZones', 'Barchasi')}
                                <span className={styles.zoneTabCount}>{enrichedItems.filter((i) => i.type === 'table').length}</span>
                            </button>

                            {zones.map((zone) => (
                                <button
                                    key={zone.id}
                                    type="button"
                                    className={`${styles.zoneTab} ${String(zoneFilter) === String(zone.id) ? styles.zoneTabActive : ''}`}
                                    onClick={() => setZoneFilter(String(zone.id))}
                                    onDoubleClick={() => handleDeleteZone(zone)}
                                    title={t('layout.doubleClickToDelete', 'O\u2018chirish uchun ikki marta bosing')}
                                >
                                    <span className={styles.zoneDot} style={{ background: zone.color }} />
                                    {zone.name}
                                    <span className={styles.zoneTabCount}>{tableCountByZone[String(zone.id)] || 0}</span>
                                </button>
                            ))}

                            <button
                                type="button"
                                className={`${styles.zoneTab} ${zoneFilter === NO_ZONE ? styles.zoneTabActive : ''}`}
                                onClick={() => setZoneFilter(NO_ZONE)}
                            >
                                {t('common.noZone')}
                                <span className={styles.zoneTabCount}>{tableCountByZone[NO_ZONE] || 0}</span>
                            </button>

                            {showZoneForm ? (
                                <div className={styles.zoneInlineForm}>
                                    <input
                                        autoFocus
                                        className={styles.input}
                                        placeholder={t('layout.zoneName')}
                                        value={zoneForm.name}
                                        onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateZone(); }}
                                    />
                                    <div className={styles.colorRow}>
                                        {ZONE_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`${styles.colorSwatch} ${zoneForm.color === color ? styles.colorSwatchActive : ''}`}
                                                style={{ background: color }}
                                                onClick={() => setZoneForm((p) => ({ ...p, color }))}
                                                aria-label={color}
                                            />
                                        ))}
                                    </div>
                                    <button type="button" className={styles.primaryBtn} onClick={handleCreateZone} disabled={saving}>
                                        {t('common.save', 'Saqlash')}
                                    </button>
                                    <button type="button" className={styles.secondaryBtn} onClick={() => setShowZoneForm(false)}>
                                        {t('common.cancel', 'Bekor qilish')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.zoneTabAdd}
                                    onClick={() => setShowZoneForm(true)}
                                    disabled={!floorId}
                                >
                                    {`+ ${t('layout.zones')}`}
                                </button>
                            )}
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.availableDot}`} /> {t('layout.available')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.pendingDot}`} /> {t('layout.pending')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.confirmedDot}`} /> {t('layout.confirmed')}</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.checkedInDot}`} /> {t('layout.checkedIn')}</span>
                        </div>
                    </header>

                    {error && <div className={styles.errorBanner}>{error}</div>}
                    {message && <div className={styles.successBanner}>{message}</div>}
                    {loading ? (
                        <div className={styles.emptyState}>{t('layout.loadingLayout')}</div>
                    ) : !floorId ? (
                        <div className={styles.emptyState}>{t('layout.emptyFloor')}</div>
                    ) : (
                        <div className={styles.canvas} ref={canvasWrapRef}>
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
                                        selectedId={selectedId}
                                        editable
                                        zoneColorById={zoneColorById}
                                        focusZoneId={zoneFilter}
                                        onSelect={(item) => setSelectedId(item.id || item.tempId)}
                                        onBackgroundClick={() => setSelectedId(null)}
                                        onItemChange={handleItemChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <aside className={styles.inspector}>
                    <h3>{t('layout.inspector')}</h3>
                    {!selectedItem ? (
                        <p className={styles.muted}>{t('layout.selectElement')}</p>
                    ) : (
                        <div className={styles.stack}>
                            <label className={styles.field}>
                                <span>{t('common.type')}</span>
                                <input className={styles.input} value={selectedItem.type} readOnly />
                            </label>
                            <label className={styles.field}>
                                <span>{t('common.name')}</span>
                                <input
                                    className={styles.input}
                                    value={selectedItem.name || ''}
                                    onChange={(e) => updateSelectedLocal({ name: e.target.value })}
                                />
                            </label>
                            {selectedItem.type === 'table' && (
                                <label className={styles.field}>
                                    <span>{t('common.seats')}</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="1"
                                        value={selectedItem.meta?.seats || 2}
                                        onChange={(e) => {
                                            const seats = Number(e.target.value) || 2;
                                            const size = tableSizeForSeats(seats, selectedItem.shape);
                                            updateSelectedLocal({
                                                seats,
                                                meta: { ...selectedItem.meta, seats },
                                                width: size.width,
                                                height: size.height,
                                            });
                                        }}
                                    />
                                </label>
                            )}
                            <label className={styles.field}>
                                <span>{t('common.zone')}</span>
                                <select
                                    className={styles.input}
                                    value={selectedItem.zoneId || ''}
                                    onChange={(e) => updateSelectedLocal({
                                        zoneId: e.target.value ? Number(e.target.value) : null,
                                    })}
                                >
                                    <option value="">{t('common.noZone')}</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span>{t('common.shape')}</span>
                                <select
                                    className={styles.input}
                                    value={selectedItem.shape || 'rect'}
                                    onChange={(e) => {
                                        const shape = e.target.value;
                                        if (selectedItem.type === 'table') {
                                            const size = tableSizeForSeats(selectedItem.meta?.seats, shape);
                                            updateSelectedLocal({ shape, width: size.width, height: size.height });
                                        } else {
                                            updateSelectedLocal({ shape });
                                        }
                                    }}
                                >
                                    <option value="round">round</option>
                                    <option value="rect">rect</option>
                                    <option value="icon">icon</option>
                                </select>
                            </label>
                            <div className={styles.row}>
                                <label className={styles.field}>
                                    <span>X</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        value={selectedItem.x}
                                        onChange={(e) => updateSelectedLocal({ x: Number(e.target.value) })}
                                    />
                                </label>
                                <label className={styles.field}>
                                    <span>Y</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        value={selectedItem.y}
                                        onChange={(e) => updateSelectedLocal({ y: Number(e.target.value) })}
                                    />
                                </label>
                            </div>
                            <div className={styles.row}>
                                <label className={styles.field}>
                                    <span>W</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        value={selectedItem.width}
                                        onChange={(e) => updateSelectedLocal({ width: Number(e.target.value) })}
                                    />
                                </label>
                                <label className={styles.field}>
                                    <span>H</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        value={selectedItem.height}
                                        onChange={(e) => updateSelectedLocal({ height: Number(e.target.value) })}
                                    />
                                </label>
                            </div>
                            {(selectedItem.dirty || selectedItem.isNew) && (
                                <span className={styles.dirtyBadge}>{t('layout.unsaved')}</span>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}