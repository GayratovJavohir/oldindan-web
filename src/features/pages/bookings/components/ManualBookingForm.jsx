import React, { useEffect, useMemo, useState } from 'react';
import styles from '../Bookings.module.css';
import $api from '../../../../config/api.config';
import { createManualBooking, getOccupiedTables } from '../../../../services/bookings.services';
import { loadTablesForBranch } from '../../../../services/tables.services';
import { getApiError, unwrapList } from '../../../../utils/apiHelpers';
import { canCreateManualBooking, getStoredUser } from '../../../../utils/authUser';

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

export default function ManualBookingForm({ onClose, onSuccess, submitLabel = 'Create Booking' }) {
    const initialStart = toLocalInputValue(new Date());
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
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
    const [branchName, setBranchName] = useState('');
    const [floors, setFloors] = useState([]);
    const [tables, setTables] = useState([]);
    const [occupiedIds, setOccupiedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingTables, setLoadingTables] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const user = getStoredUser();
    const allowed = canCreateManualBooking();

    useEffect(() => {
        if (!allowed) return undefined;

        let active = true;
        const assignedBranchId = user?.branchId;

        (async () => {
            setLoading(true);
            setErrorMessage('');
            try {
                if (!assignedBranchId) {
                    throw new Error('Receptionist account has no assigned branch.');
                }

                const branchRes = await $api.get(`/restaurants/partner/branches/${assignedBranchId}/`).catch(() =>
                    $api.get(`/restaurants/branches/${assignedBranchId}/`)
                );
                if (!active) return;

                setBranchName(branchRes.data?.name || `Branch #${assignedBranchId}`);
                setForm((prev) => ({ ...prev, branch: String(assignedBranchId) }));
            } catch (err) {
                console.error('Manual booking bootstrap error:', err);
                if (active) setErrorMessage(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => { active = false; };
    }, [allowed, user?.branchId]);

    useEffect(() => {
        if (!allowed || !form.branch) {
            setFloors([]);
            return undefined;
        }

        let active = true;
        (async () => {
            try {
                const response = await $api.get(`/layouts/branches/${form.branch}/floors/`);
                if (!active) return;
                const floorList = unwrapList(response.data);
                setFloors(floorList);
                setForm((prev) => ({
                    ...prev,
                    floor: floorList.some((f) => String(f.id) === String(prev.floor))
                        ? prev.floor
                        : (floorList[0]?.id || ''),
                    zone: '',
                    table: '',
                }));
            } catch (err) {
                if (active) setErrorMessage(getApiError(err));
            }
        })();

        return () => { active = false; };
    }, [allowed, form.branch]);

    useEffect(() => {
        if (!allowed || !form.branch || !form.floor) {
            setTables([]);
            return undefined;
        }

        let active = true;
        (async () => {
            setLoadingTables(true);
            try {
                const list = await loadTablesForBranch(form.branch, form.floor);
                if (!active) return;
                setTables(list);
                setForm((prev) => ({
                    ...prev,
                    table: list.some((t) => String(t.id) === String(prev.table))
                        ? prev.table
                        : (list[0]?.id || ''),
                }));
            } catch (err) {
                if (active) {
                    setTables([]);
                    setErrorMessage(getApiError(err));
                }
            } finally {
                if (active) setLoadingTables(false);
            }
        })();

        return () => { active = false; };
    }, [allowed, form.branch, form.floor]);

    const zones = useMemo(() => {
        const map = new Map();
        tables.forEach((table) => {
            if (!table.zoneId) return;
            map.set(String(table.zoneId), {
                id: table.zoneId,
                name: table.zoneName || `Zone #${table.zoneId}`,
            });
        });
        return Array.from(map.values());
    }, [tables]);

    useEffect(() => {
        if (!allowed || !form.branch || !form.floor || !form.booking_start || !form.booking_end) {
            setOccupiedIds([]);
            return undefined;
        }

        let active = true;
        (async () => {
            try {
                const data = await getOccupiedTables({
                    branch_id: form.branch,
                    floor_id: form.floor,
                    booking_start: toApiDateTime(form.booking_start),
                    booking_end: toApiDateTime(form.booking_end),
                });
                if (!active) return;
                const occupied = unwrapList(data)
                    .map((item) => item.table_id ?? item.table?.id ?? item.table)
                    .filter(Boolean)
                    .map(String);
                setOccupiedIds(occupied);
            } catch {
                if (active) setOccupiedIds([]);
            }
        })();

        return () => { active = false; };
    }, [allowed, form.branch, form.floor, form.booking_start, form.booking_end]);

    const selectableTables = useMemo(() => tables.filter((table) => {
        if (!table.is_active && table.status === 'inactive') return false;
        if (form.zone && String(table.zoneId) !== String(form.zone)) return false;
        return true;
    }), [tables, form.zone]);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'floor') {
                next.zone = '';
                next.table = '';
            }
            if (name === 'zone') {
                next.table = '';
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
            setErrorMessage('Ism, familiya va telefon raqamini kiriting.');
            return;
        }
        if (!form.branch || !form.floor || !form.table) {
            setErrorMessage('Floor va table tanlang.');
            return;
        }

        setSaving(true);
        setErrorMessage('');
        try {
            const payload = {
                branch: Number(form.branch),
                branch_id: Number(form.branch),
                floor: Number(form.floor),
                floor_id: Number(form.floor),
                table: Number(form.table),
                table_id: Number(form.table),
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                phone: form.phone.trim(),
                guest_count: Number(form.guest_count),
                children_count: Number(form.children_count || 0),
                booking_start: toApiDateTime(form.booking_start),
                booking_end: toApiDateTime(form.booking_end),
                special_request: form.special_request || '',
            };
            if (form.zone) {
                payload.zone = Number(form.zone);
                payload.zone_id = Number(form.zone);
            }

            await createManualBooking(payload);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Manual booking create error:', err);
            setErrorMessage(getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    if (!allowed) {
        return (
            <div className={styles.modalBody}>
                <div style={{ color: '#cf222e', fontSize: 14 }}>
                    Manual booking faqat receptionist uchun.
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.modalBody}>
                {loading && <div style={{ color: '#aaaaaa' }}>Loading form data...</div>}
                {errorMessage && <div style={{ color: '#cf222e', fontSize: 14 }}>{errorMessage}</div>}

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Ism *</label>
                        <input name="first_name" value={form.first_name} onChange={updateField} placeholder="Doniyor" required />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Familiya *</label>
                        <input name="last_name" value={form.last_name} onChange={updateField} placeholder="Karimov" required />
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Telefon *</label>
                        <input name="phone" value={form.phone} onChange={updateField} placeholder="+998 90 123 45 67" required />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Branch</label>
                        <input type="text" value={branchName || (form.branch ? `Branch #${form.branch}` : '')} readOnly />
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label>Floor *</label>
                        <select name="floor" value={form.floor} onChange={updateField} disabled={!form.branch}>
                            <option value="">Select floor</option>
                            {floors.map((floor) => (
                                <option key={floor.id} value={floor.id}>{floor.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Zone</label>
                        <select name="zone" value={form.zone} onChange={updateField} disabled={!zones.length}>
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
                        <select
                            name="table"
                            value={form.table}
                            onChange={updateField}
                            disabled={loadingTables || !selectableTables.length}
                        >
                            <option value="">
                                {loadingTables
                                    ? 'Loading tables...'
                                    : (selectableTables.length ? 'Select table' : 'No tables on this floor')}
                            </option>
                            {selectableTables.map((table) => {
                                const occupied = occupiedIds.includes(String(table.id));
                                return (
                                    <option key={table.id} value={table.id}>
                                        {table.name} · {table.seats} seats{occupied ? ' (occupied)' : ''}
                                    </option>
                                );
                            })}
                        </select>
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
                <button type="button" className={styles.modalSubmitBtn} onClick={handleSubmit} disabled={saving || loading || loadingTables}>
                    {saving ? 'Saving...' : submitLabel}
                </button>
            </div>
        </>
    );
}
