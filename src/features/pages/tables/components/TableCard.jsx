import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../Table.module.css';
import { getPartnerBranches } from '../../../../services/restaurants.services';
import { getPartnerFloors } from '../../../../services/layouts.services';
import {
    createTableWithLayout,
    deletePartnerTable,
    getPartnerTables,
    patchPartnerTable,
} from '../../../../services/tables.services';
import { getApiError } from '../../../../utils/apiHelpers';

function TableModal({ table, branches, floors, onClose, onSave }) {
    const [form, setForm] = useState({
        branch: table?.branchId || branches[0]?.id || '',
        floor: table?.floorId || '',
        zone: table?.zoneId || '',
        name: table?.name || '',
        seats: table?.seats ?? 2,
        shape: table?.shape === 'rect' ? 'rect' : 'round',
        is_active: table ? table.is_active : true,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const branchFloors = floors.filter((floor) => String(floor.branchId) === String(form.branch));
    const floorZones = branchFloors.find((f) => String(f.id) === String(form.floor))?.zones || [];

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await onSave(form, table);
            onClose();
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{table ? 'Edit Table' : 'Add Table'}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        {!table && (
                            <div className={styles.formGroup}>
                                <label>Branch *</label>
                                <select
                                    value={form.branch}
                                    onChange={(e) => setForm({ ...form, branch: e.target.value, floor: '', zone: '' })}
                                    required
                                >
                                    <option value="">Select branch</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Floor *</label>
                                <select
                                    value={form.floor}
                                    onChange={(e) => setForm({ ...form, floor: e.target.value, zone: '' })}
                                    required
                                    disabled={Boolean(table)}
                                >
                                    <option value="">Select floor</option>
                                    {branchFloors.map((floor) => (
                                        <option key={floor.id} value={floor.id}>{floor.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Zone</label>
                                <select
                                    value={form.zone}
                                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                                >
                                    <option value="">No zone</option>
                                    {floorZones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Name *</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Seats *</label>
                                <input type="number" min="1" value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} required />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            {!table && (
                                <div className={styles.formGroup}>
                                    <label>Shape</label>
                                    <select value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value })}>
                                        <option value="round">round</option>
                                        <option value="rect">rect</option>
                                    </select>
                                </div>
                            )}
                            <div className={styles.formGroup}>
                                <label>Status</label>
                                <select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}>
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </div>
                        </div>
                        {!table && (
                            <div className={styles.errorText} style={{ color: '#aaa' }}>
                                Table layout item avtomatik yaratiladi. Joylashuvni Floor Layout da sozlang.
                            </div>
                        )}
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
                            {busy ? 'Saving...' : (table ? 'Save Changes' : 'Create Table')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function TableCard() {
    const [tables, setTables] = useState([]);
    const [branches, setBranches] = useState([]);
    const [floors, setFloors] = useState([]);
    const [branchFilter, setBranchFilter] = useState('');
    const [floorFilter, setFloorFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editTable, setEditTable] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [branchList, floorList] = await Promise.all([
                getPartnerBranches(),
                getPartnerFloors(),
            ]);
            setBranches(branchList);
            setFloors(floorList);

            const allTables = [];
            for (const branch of branchList) {
                try {
                    const branchTables = await getPartnerTables(branch.id);
                    allTables.push(...branchTables);
                } catch {
                    // skip branch
                }
            }
            setTables(allTables);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredTables = useMemo(() => tables.filter((table) => {
        if (branchFilter && String(table.branchId) !== String(branchFilter)) return false;
        if (floorFilter && String(table.floorId) !== String(floorFilter)) return false;
        return true;
    }), [tables, branchFilter, floorFilter]);

    const branchFloors = useMemo(
        () => floors.filter((floor) => !branchFilter || String(floor.branchId) === String(branchFilter)),
        [floors, branchFilter]
    );

    const handleSave = async (form, table) => {
        if (table) {
            const payload = {
                name: form.name.trim(),
                seats: Number(form.seats),
                is_active: form.is_active,
            };
            if (form.zone) payload.zone = Number(form.zone);
            else payload.zone = null;
            await patchPartnerTable(table.id, payload);
        } else {
            await createTableWithLayout({
                branchId: form.branch,
                floorId: form.floor,
                zoneId: form.zone || null,
                name: form.name.trim(),
                seats: Number(form.seats),
                shape: form.shape === 'rect' ? 'rect' : 'round',
                width: form.shape === 'rect' ? 140 : 90,
                height: 90,
                x: 100 + Math.floor(Math.random() * 200),
                y: 100 + Math.floor(Math.random() * 160),
            });
        }
        await loadData();
    };

    const handleDeactivate = async (table) => {
        await patchPartnerTable(table.id, { is_active: false });
        await loadData();
    };

    const handleDelete = async (table) => {
        await deletePartnerTable(table.id);
        await loadData();
    };

    return (
        <div className={styles.pageTables}>
            <div className={styles.cardTable}>
                <div className={styles.cardTableHeader}>
                    <h2 className={styles.headerTitle}>Tables</h2>
                    <div className={styles.buttonWrapper}>
                        <select
                            value={branchFilter}
                            onChange={(e) => { setBranchFilter(e.target.value); setFloorFilter(''); }}
                        >
                            <option value="">All branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                        <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
                            <option value="">All floors</option>
                            {branchFloors.map((floor) => (
                                <option key={floor.id} value={floor.id}>{floor.name}</option>
                            ))}
                        </select>
                        <Link to="/floor-layout" className={styles.editBtn}>Open Floor Layout</Link>
                        <button type="button" className={styles.addBtn} onClick={() => { setEditTable(null); setShowModal(true); }}>
                            + Add Table
                        </button>
                    </div>
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.tableWrapper}>
                    <table className={styles.Table}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>NAME</th>
                                <th>BRANCH</th>
                                <th>FLOOR</th>
                                <th>ZONE</th>
                                <th>SEATS</th>
                                <th>LAYOUT ITEM</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9}>Loading...</td></tr>
                            ) : filteredTables.length === 0 ? (
                                <tr><td colSpan={9}>No tables found.</td></tr>
                            ) : (
                                filteredTables.map((table) => (
                                    <tr key={table.id}>
                                        <td>#{table.id}</td>
                                        <td>{table.name}</td>
                                        <td>{table.branchName || table.branchId}</td>
                                        <td>{table.floorName || table.floorId || '—'}</td>
                                        <td>{table.zoneName || table.zoneId || '—'}</td>
                                        <td>{table.seats}</td>
                                        <td>{table.layoutItemId || '—'}</td>
                                        <td className={styles.status}>{table.status}</td>
                                        <td>
                                            <button type="button" className={styles.editBtn} onClick={() => { setEditTable(table); setShowModal(true); }}>Edit</button>
                                            {table.is_active ? (
                                                <button type="button" className={styles.deactiveBtn} onClick={() => handleDeactivate(table)}>Deactivate</button>
                                            ) : (
                                                <button type="button" className={styles.deactiveBtn} onClick={() => handleDelete(table)}>Delete</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <TableModal
                    table={editTable}
                    branches={branches}
                    floors={floors}
                    onClose={() => { setShowModal(false); setEditTable(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}
