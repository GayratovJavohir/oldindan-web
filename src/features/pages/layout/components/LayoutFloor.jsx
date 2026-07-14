import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../Floor.module.css';
import FloorCanvas from './FloorCanvas';
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
import {
    createPartnerTable,
    deletePartnerTable,
    loadTablesForBranch,
    patchPartnerTable,
} from '../../../../services/tables.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { getStoredUser } from '../../../../utils/authUser';

const CANVAS_W = 960;
const CANVAS_H = 640;

function nextTempId() {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function LayoutFloor() {
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';

    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState(assignedBranchId);
    const [floors, setFloors] = useState([]);
    const [floorId, setFloorId] = useState('');
    const [items, setItems] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [paletteType, setPaletteType] = useState('table');

    const [floorForm, setFloorForm] = useState({ name: '', sort_order: 0 });
    const [zoneForm, setZoneForm] = useState({ name: '', color: ZONE_COLORS[0] });
    const [tableDraft, setTableDraft] = useState({ name: '', seats: 4, shape: 'round' });

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

    const tableByLayoutItem = useMemo(() => {
        const map = {};
        tables.forEach((t) => {
            if (t.layoutItemId) map[String(t.layoutItemId)] = t;
        });
        return map;
    }, [tables]);

    const enrichedItems = useMemo(() => items.map((item) => {
        if (item.type !== 'table') return item;
        const table = tableByLayoutItem[String(item.id)];
        return {
            ...item,
            name: item.name || table?.name || '',
            seats: table?.seats ?? item.meta?.seats,
            meta: {
                ...item.meta,
                seats: table?.seats ?? item.meta?.seats,
                table_id: table?.id ?? item.meta?.table_id,
            },
        };
    }), [items, tableByLayoutItem]);

    const loadBranchData = useCallback(async (nextBranchId, preferredFloorId = null) => {
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
            const [floorList, layoutItems, tableList] = await Promise.all([
                getPartnerFloors(),
                getPartnerLayoutItems({ branch_id: nextBranchId }),
                loadTablesForBranch(nextBranchId),
            ]);

            const branchFloors = floorList
                .filter((f) => String(f.branchId) === String(nextBranchId))
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
            setSelectedId(null);
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
                    const list = await getPartnerBranches();
                    if (!active) return;
                    setBranches(list);
                    const initial = branchId || (list[0] ? String(list[0].id) : '');
                    setBranchId(initial);
                    await loadBranchData(initial);
                } else if (assignedBranchId) {
                    setBranchId(assignedBranchId);
                    await loadBranchData(assignedBranchId);
                } else {
                    setError('Branch biriktirilmagan.');
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

    const reloadFloorItems = async (nextFloorId = floorId) => {
        if (!branchId || !nextFloorId) {
            setItems([]);
            return;
        }
        const [layoutItems, tableList] = await Promise.all([
            getPartnerLayoutItems({ branch_id: branchId, floor_id: nextFloorId }),
            loadTablesForBranch(branchId, nextFloorId),
        ]);
        setItems(layoutItems);
        setTables((prev) => {
            const others = prev.filter((t) => String(t.floorId) !== String(nextFloorId));
            return [...others, ...tableList];
        });
    };

    const handleBranchChange = async (value) => {
        setBranchId(value);
        setMessage('');
        await loadBranchData(value);
    };

    const handleFloorChange = async (value) => {
        setFloorId(value);
        setSelectedId(null);
        setMessage('');
        try {
            await reloadFloorItems(value);
        } catch (err) {
            setError(getApiError(err));
        }
    };

    const handleCreateFloor = async () => {
        if (!branchId || !floorForm.name.trim()) {
            setError('Floor nomini kiriting.');
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
            setMessage('Floor yaratildi.');
            await loadBranchData(branchId, floor.id);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleRenameFloor = async () => {
        if (!currentFloor) return;
        const name = window.prompt('Floor nomi', currentFloor.name);
        if (!name?.trim()) return;
        setSaving(true);
        try {
            await patchPartnerFloor(currentFloor.id, { name: name.trim() });
            await loadBranchData(branchId, currentFloor.id);
            setMessage('Floor yangilandi.');
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFloor = async () => {
        if (!currentFloor) return;
        if (!window.confirm(`"${currentFloor.name}" floor o'chirilsinmi? Ichidagi zone/itemlar ham o'chadi.`)) return;
        setSaving(true);
        try {
            await deletePartnerFloor(currentFloor.id);
            setMessage('Floor o\'chirildi.');
            await loadBranchData(branchId);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleCreateZone = async () => {
        if (!floorId || !zoneForm.name.trim()) {
            setError('Zone nomi va floor kerak.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await createPartnerZone({
                floor: Number(floorId),
                name: zoneForm.name.trim(),
                color: zoneForm.color,
                sort_order: zones.length,
                is_active: true,
            });
            setZoneForm({ name: '', color: ZONE_COLORS[(zones.length + 1) % ZONE_COLORS.length] });
            await loadBranchData(branchId, floorId);
            setMessage('Zone yaratildi.');
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteZone = async (zone) => {
        if (!window.confirm(`"${zone.name}" zone o'chirilsinmi?`)) return;
        setSaving(true);
        try {
            await deletePartnerZone(zone.id);
            await loadBranchData(branchId, floorId);
            setMessage('Zone o\'chirildi.');
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const addItemFromPalette = () => {
        if (!floorId) {
            setError('Avval floor tanlang yoki yarating.');
            return;
        }
        const defaults = getTypeDefaults(paletteType);
        const isTable = paletteType === 'table';
        const tempId = nextTempId();
        const item = {
            tempId,
            id: null,
            floorId: Number(floorId),
            zoneId: null,
            type: paletteType,
            name: isTable ? (tableDraft.name || `T${items.filter((i) => i.type === 'table').length + 1}`) : defaults.label,
            x: 80 + (items.length % 6) * 40,
            y: 80 + Math.floor(items.length / 6) * 40,
            width: isTable && tableDraft.shape === 'rect' ? 140 : defaults.defaultWidth,
            height: defaults.defaultHeight,
            rotation: 0,
            shape: isTable ? tableDraft.shape : defaults.defaultShape,
            zIndex: isTable ? 10 : 1,
            meta: isTable ? { seats: Number(tableDraft.seats) || 4 } : {},
            isActive: true,
            dirty: true,
            isNew: true,
        };
        setItems((prev) => [...prev, item]);
        setSelectedId(tempId);
        setMessage('Element qo\'shildi — Save bosib backendga yuboring.');
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

    const saveSelectedOrAll = async () => {
        if (!floorId) return;
        const dirty = items.filter((item) => item.dirty || item.isNew);
        if (!dirty.length) {
            setMessage('O\'zgarish yo\'q.');
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
                    const created = await createPartnerLayoutItem(payload);
                    if (created.type === 'table') {
                        const seats = Number(item.meta?.seats || tableDraft.seats || 4);
                        const tableName = item.name?.trim() || `Table ${created.id}`;
                        const tablePayload = {
                            branch: Number(branchId),
                            floor: Number(floorId),
                            layout_item: created.id,
                            name: tableName,
                            seats,
                            is_active: true,
                        };
                        if (item.zoneId) tablePayload.zone = Number(item.zoneId);
                        await createPartnerTable(tablePayload);
                    }
                } else {
                    await patchPartnerLayoutItem(item.id, payload);
                    const linked = tableByLayoutItem[String(item.id)];
                    if (item.type === 'table' && linked) {
                        const tablePatch = {
                            name: item.name?.trim() || linked.name,
                            seats: Number(item.meta?.seats || linked.seats || 2),
                        };
                        if (item.zoneId) tablePatch.zone = Number(item.zoneId);
                        else tablePatch.zone = null;
                        await patchPartnerTable(linked.id, tablePatch);
                    }
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
            setMessage('Layout saqlandi.');
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedItem) return;
        if (!window.confirm('Tanlangan element o\'chirilsinmi?')) return;

        setSaving(true);
        setError('');
        try {
            if (selectedItem.id) {
                const linked = tableByLayoutItem[String(selectedItem.id)];
                if (linked) {
                    try {
                        await deletePartnerTable(linked.id);
                    } catch {
                        // table may cascade with layout item
                    }
                }
                await deletePartnerLayoutItem(selectedItem.id);
            }
            setItems((prev) => prev.filter((item) => {
                const key = item.id || item.tempId;
                const selectedKey = selectedItem.id || selectedItem.tempId;
                return String(key) !== String(selectedKey);
            }));
            setSelectedId(null);
            setMessage('Element o\'chirildi.');
            if (selectedItem.id) await reloadFloorItems(floorId);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.floorContainer}>
            <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    {isOwner && (
                        <label className={styles.field}>
                            <span>Branch</span>
                            <select value={branchId} onChange={(e) => handleBranchChange(e.target.value)}>
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className={styles.field}>
                        <span>Floor</span>
                        <select value={floorId} onChange={(e) => handleFloorChange(e.target.value)} disabled={!branchId}>
                            <option value="">Select floor</option>
                            {floors.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </label>
                    <button type="button" className={styles.secondaryBtn} onClick={handleRenameFloor} disabled={!currentFloor || saving}>Rename</button>
                    <button type="button" className={styles.dangerBtn} onClick={handleDeleteFloor} disabled={!currentFloor || saving}>Delete floor</button>
                </div>

                <div className={styles.toolbarGroup}>
                    <input
                        className={styles.input}
                        placeholder="New floor name"
                        value={floorForm.name}
                        onChange={(e) => setFloorForm((p) => ({ ...p, name: e.target.value }))}
                    />
                    <button type="button" className={styles.primaryBtn} onClick={handleCreateFloor} disabled={!branchId || saving}>
                        + Floor
                    </button>
                </div>
            </div>

            <div className={styles.workspace}>
                <aside className={styles.sidebarPanel}>
                    <h3>Palette</h3>
                    <div className={styles.paletteGrid}>
                        {LAYOUT_ITEM_TYPES.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                className={`${styles.paletteBtn} ${paletteType === type.value ? styles.paletteBtnActive : ''}`}
                                onClick={() => setPaletteType(type.value)}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {paletteType === 'table' && (
                        <div className={styles.stack}>
                            <input
                                className={styles.input}
                                placeholder="Table name"
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

                    <button type="button" className={styles.primaryBtn} onClick={addItemFromPalette} disabled={!floorId || saving}>
                        Add to floor
                    </button>

                    <h3>Zones</h3>
                    <div className={styles.stack}>
                        <input
                            className={styles.input}
                            placeholder="Zone name"
                            value={zoneForm.name}
                            onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
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
                        <button type="button" className={styles.secondaryBtn} onClick={handleCreateZone} disabled={!floorId || saving}>
                            + Zone
                        </button>
                    </div>

                    <ul className={styles.zoneList}>
                        {zones.map((zone) => (
                            <li key={zone.id}>
                                <span className={styles.zoneDot} style={{ background: zone.color }} />
                                <span>{zone.name}</span>
                                <button type="button" onClick={() => handleDeleteZone(zone)}>×</button>
                            </li>
                        ))}
                        {!zones.length && <li className={styles.muted}>No zones yet</li>}
                    </ul>

                    <div className={styles.actionsSticky}>
                        <button type="button" className={styles.primaryBtn} onClick={saveSelectedOrAll} disabled={saving || !floorId}>
                            {saving ? 'Saving...' : 'Save layout'}
                        </button>
                        <button type="button" className={styles.dangerBtn} onClick={handleDeleteSelected} disabled={!selectedItem || saving}>
                            Delete selected
                        </button>
                    </div>
                </aside>

                <div className={styles.canvasWrap}>
                    <header className={styles.header}>
                        <div className={styles.legend}>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.availableDot}`} /> Available</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.pendingDot}`} /> Pending</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.confirmedDot}`} /> Confirmed</span>
                            <span className={styles.legendItem}><div className={`${styles.dot} ${styles.checkedInDot}`} /> Checked In</span>
                        </div>
                        <span className={styles.muted}>
                            {currentFloor ? `${currentFloor.name} · ${enrichedItems.length} items` : 'Floor tanlang'}
                        </span>
                    </header>

                    {error && <div className={styles.errorBanner}>{error}</div>}
                    {message && <div className={styles.successBanner}>{message}</div>}
                    {loading ? (
                        <div className={styles.emptyState}>Loading layout...</div>
                    ) : !floorId ? (
                        <div className={styles.emptyState}>Floor yarating yoki tanlang.</div>
                    ) : (
                        <div className={styles.canvas}>
                            <FloorCanvas
                                width={CANVAS_W}
                                height={CANVAS_H}
                                items={enrichedItems}
                                selectedId={selectedId}
                                editable
                                zoneColorById={zoneColorById}
                                onSelect={(item) => setSelectedId(item.id || item.tempId)}
                                onBackgroundClick={() => setSelectedId(null)}
                                onItemChange={handleItemChange}
                            />
                        </div>
                    )}
                </div>

                <aside className={styles.inspector}>
                    <h3>Inspector</h3>
                    {!selectedItem ? (
                        <p className={styles.muted}>Element tanlang yoki palette dan qo&apos;shing.</p>
                    ) : (
                        <div className={styles.stack}>
                            <label className={styles.field}>
                                <span>Type</span>
                                <input className={styles.input} value={selectedItem.type} readOnly />
                            </label>
                            <label className={styles.field}>
                                <span>Name</span>
                                <input
                                    className={styles.input}
                                    value={selectedItem.name || ''}
                                    onChange={(e) => updateSelectedLocal({ name: e.target.value })}
                                />
                            </label>
                            {selectedItem.type === 'table' && (
                                <label className={styles.field}>
                                    <span>Seats</span>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="1"
                                        value={selectedItem.meta?.seats || 2}
                                        onChange={(e) => updateSelectedLocal({
                                            meta: { ...selectedItem.meta, seats: Number(e.target.value) || 2 },
                                        })}
                                    />
                                </label>
                            )}
                            <label className={styles.field}>
                                <span>Zone</span>
                                <select
                                    className={styles.input}
                                    value={selectedItem.zoneId || ''}
                                    onChange={(e) => updateSelectedLocal({
                                        zoneId: e.target.value ? Number(e.target.value) : null,
                                    })}
                                >
                                    <option value="">No zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span>Shape</span>
                                <select
                                    className={styles.input}
                                    value={selectedItem.shape || 'rect'}
                                    onChange={(e) => updateSelectedLocal({ shape: e.target.value })}
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
                                <span className={styles.dirtyBadge}>Unsaved changes</span>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
