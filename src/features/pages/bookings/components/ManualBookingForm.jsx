import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../Bookings.module.css';
import $api from '../../../../config/api.config';
import { createManualBooking, getOccupiedTables } from '../../../../services/bookings.services';
import { getConsumers } from '../../../../services/consumers.services';
import { loadTablesForBranch } from '../../../../services/tables.services';
import { getStoredUser } from '../../../../utils/authUser';

function toLocalInputValue(date) {
    const pad = (value) => String(value).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
}

function toApiDateTime(value) {
    if (!value) return '';
    return new Date(value).toISOString();
}

function plusHours(value, hours) {
    if (!value) return '';
    const date = new Date(value);
    date.setHours(date.getHours() + hours);
    return toLocalInputValue(date);
}

function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

export default function ManualBookingForm({ onClose, onSuccess, submitLabel = 'Create Booking', pageMode = false }) {
    const initialStart = toLocalInputValue(new Date());
    const [form, setForm] = useState({
        guest: '',
        branch: '',
        floor: '',
        zone: '',
        table: '',
        guest_count: 2,
        children_count: 0,
        booking_start: initialStart,
        booking_end: plusHours(initialStart, 2),
        special_request: '',
    });
    const [branches, setBranches] = useState([]);
    const [floors, setFloors] = useState([]);
    const [tables, setTables] = useState([]);
    const [consumers, setConsumers] = useState([]);
    const [occupiedIds, setOccupiedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let active = true;
        const user = getStoredUser();
        const assignedBranchId = user?.branchId;
        const isReceptionist = user?.role === 'receptionist';

        (async () => {
            setLoading(true);
            setErrorMessage('');
            try {
                let branchList = [];
                let floorList = [];

                if (isReceptionist && assignedBranchId) {
                    const [branchRes, floorsRes] = await Promise.all([
                        $api.get(`/restaurants/partner/branches/${assignedBranchId}/`).catch(() =>
                            $api.get(`/restaurants/branches/${assignedBranchId}/`)
                        ),
                        $api.get(`/layouts/branches/${assignedBranchId}/floors/`),
                    ]);
                    if (!active) return;
                    branchList = [branchRes.data];
                    floorList = unwrapList(floorsRes.data);
                } else {
                    const [branchesRes, floorsRes] = await Promise.all([
                        $api.get('/restaurants/partner/branches/'),
                        $api.get('/layouts/partner/floors/'),
                    ]);
                    if (!active) return;
                    branchList = unwrapList(branchesRes.data);
                    floorList = unwrapList(floorsRes.data);
                }

                const consumerList = await getConsumers();
                if (!active) return;

                setBranches(branchList);
                setFloors(floorList);
                setConsumers(consumerList);
                setForm((prev) => ({
                    ...prev,
                    branch: prev.branch || branchList[0]?.id || assignedBranchId || '',
                }));
            } catch (err) {
                console.error('Manual booking bootstrap error:', err);
                if (active) setErrorMessage(err.response?.data?.detail || err.message || 'Failed to load booking form data.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const branchFloors = useMemo(
        () => floors.filter((floor) => String(floor.branch ?? floor.branch_id) === String(form.branch)),
        [floors, form.branch]
    );

    useEffect(() => {
        if (!form.branch) return;
        if (!branchFloors.some((floor) => String(floor.id) === String(form.floor))) {
            setForm((prev) => ({
                ...prev,
                floor: branchFloors[0]?.id || '',
                zone: '',
                table: '',
            }));
        }
    }, [form.branch, branchFloors]);

    useEffect(() => {
        let active = true;
        if (!form.branch) {
            setTables([]);
            return undefined;
        }

        (async () => {
            try {
                const list = await loadTablesForBranch(form.branch, form.floor || null);
                if (!active) return;

                const filtered = form.floor
                    ? list.filter((table) => String(table.floorId) === String(form.floor))
                    : list;

                setTables(filtered);
            } catch (err) {
                console.error('Manual booking tables error:', err);
                if (active) setErrorMessage(err.response?.data?.detail || err.message || 'Failed to load tables.');
            }
            return undefined;
        })();

        return () => {
            active = false;
        };
    }, [form.branch, form.floor]);

    const zones = useMemo(() => {
        const map = new Map();
        tables.forEach((table) => {
            const zoneId = table.zoneId;
            if (!zoneId) return;
            map.set(String(zoneId), { id: zoneId, name: table.zoneName || `Zone #${zoneId}` });
        });
        return Array.from(map.values());
    }, [tables]);

    useEffect(() => {
        if (form.zone && !zones.some((zone) => String(zone.id) === String(form.zone))) {
            setForm((prev) => ({ ...prev, zone: '' }));
        }
    }, [zones, form.zone]);

    useEffect(() => {
        let active = true;
        if (!form.branch || !form.floor || !form.booking_start || !form.booking_end) {
            setOccupiedIds([]);
            return undefined;
        }
        (async () => {
            try {
                const data = await getOccupiedTables({
                    branch_id: form.branch,
                    floor_id: form.floor,
                    booking_start: toApiDateTime(form.booking_start),
                    booking_end: toApiDateTime(form.booking_end),
                });
                if (!active) return;
                const occupied = unwrapList(data).map((item) => item.table_id ?? item.table?.id ?? item.table).filter(Boolean);
                setOccupiedIds(occupied.map(String));
            } catch (err) {
                console.error('Occupied tables error:', err);
                if (active) setOccupiedIds([]);
            }
        })();
        return () => {
            active = false;
        };
    }, [form.branch, form.floor, form.booking_start, form.booking_end]);

    const filteredTables = useMemo(() => tables.filter((table) => {
        const matchesZone = !form.zone || String(table.zoneId) === String(form.zone);
        const notOccupied = !occupiedIds.includes(String(table.id));
        const isActive = table.is_active !== false && table.status !== 'inactive';
        return matchesZone && notOccupied && isActive;
    }), [tables, form.zone, occupiedIds]);

    useEffect(() => {
        if (!filteredTables.some((table) => String(table.id) === String(form.table))) {
            setForm((prev) => ({ ...prev, table: filteredTables[0]?.id || '' }));
        }
    }, [filteredTables, form.table]);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!form.branch || !form.floor || !form.table) {
            setErrorMessage('Select branch, floor and table.');
            return;
        }

        setSaving(true);
        setErrorMessage('');
        try {
            const payload = {
                branch: Number(form.branch),
                floor: Number(form.floor),
                table: Number(form.table),
                guest_count: Number(form.guest_count),
                children_count: Number(form.children_count || 0),
                booking_start: toApiDateTime(form.booking_start),
                booking_end: toApiDateTime(form.booking_end),
                special_request: form.special_request || '',
            };
            if (form.zone) payload.zone = Number(form.zone);
            if (form.guest) payload.guest = Number(form.guest);

            await createManualBooking(payload);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Manual booking create error:', err);
            setErrorMessage(err.response?.data?.detail || err.message || 'Failed to create manual booking.');
        } finally {
            setSaving(false);
        }
    };

    const user = getStoredUser();
    const lockBranch = user?.role === 'receptionist' && branches.length <= 1;

    return (
        <>
            <div className={styles.modalBody}>
                {loading && <div style={{ color: '#aaaaaa' }}>Loading form data...</div>}
                {errorMessage && <div style={{ color: '#cf222e', fontSize: 14 }}>{errorMessage}</div>}

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Guest (consumer)</label>
                        <select name="guest" value={form.guest} onChange={updateField}>
                            <option value="">Select consumer</option>
                            {consumers.map((consumer) => (
                                <option key={consumer.id} value={consumer.id}>
                                    {consumer.name}{consumer.phone ? ` · ${consumer.phone}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Branch *</label>
                        <select name="branch" value={form.branch} onChange={updateField} disabled={lockBranch}>
                            <option value="">Select branch</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Floor *</label>
                        <select name="floor" value={form.floor} onChange={updateField}>
                            <option value="">Select floor</option>
                            {branchFloors.map((floor) => (
                                <option key={floor.id} value={floor.id}>{floor.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Zone</label>
                        <select name="zone" value={form.zone} onChange={updateField}>
                            <option value="">Any zone</option>
                            {zones.map((zone) => (
                                <option key={zone.id} value={zone.id}>{zone.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Table *</label>
                        <select name="table" value={form.table} onChange={updateField} disabled={!filteredTables.length}>
                            <option value="">{filteredTables.length ? 'Select table' : 'No available tables'}</option>
                            {filteredTables.map((table) => (
                                <option key={table.id} value={table.id}>
                                    {table.name} - {table.seats} seats
                                </option>
                            ))}
                        </select>
                        {!loading && form.floor && !filteredTables.length && (
                            <span style={{ color: '#888', fontSize: 12 }}>No tables on this floor. Check branch/floor or create tables first.</span>
                        )}
                    </div>
                    <div className={styles.formGroup}>
                        <label>Guest count *</label>
                        <input name="guest_count" type="number" min="1" value={form.guest_count} onChange={updateField} />
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Children count</label>
                        <input name="children_count" type="number" min="0" value={form.children_count} onChange={updateField} />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Booking start *</label>
                        <input name="booking_start" type="datetime-local" value={form.booking_start} onChange={updateField} />
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Booking end *</label>
                        <input name="booking_end" type="datetime-local" value={form.booking_end} onChange={updateField} />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Occupied in range</label>
                        <input type="text" value={`${occupiedIds.length} table(s) occupied`} readOnly />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Special request</label>
                    <textarea
                        name="special_request"
                        placeholder="Walk-in guest, birthday, allergy..."
                        rows="4"
                        value={form.special_request}
                        onChange={updateField}
                    />
                </div>
            </div>

            <div className={styles.modalFooter}>
                {onClose && (
                    <button type="button" className={styles.modalCancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                )}
                <button type="button" className={styles.modalSubmitBtn} onClick={handleSubmit} disabled={saving || loading}>
                    {saving ? 'Saving...' : submitLabel}
                </button>
            </div>
        </>
    );
}
