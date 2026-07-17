import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/header/PageHeader';
import LocationMapPicker from '../../../components/LocationMapPicker';
import styles from './Branch.module.css';
import BranchCard from './components/BranchCard';
import {
    WEEKDAY_KEYS,
    WEEKDAY_LABELS,
    createPartnerBranchWithUniqueSlug,
    defaultWorkingHoursSchedule,
    emptyHoursSchedule,
    getPartnerBranch,
    getPartnerBrands,
    getPartnerBranches,
    hoursToApi,
    patchPartnerBranch,
} from '../../../services/restaurants.services';
import { getApiError } from '../../../utils/apiHelpers';
import { isOwner } from '../../../utils/authUser';

function HoursEditor({ title, hint, schedule, onChange }) {
    const updateDay = (day, patch) => {
        onChange({
            ...schedule,
            [day]: { ...schedule[day], ...patch },
        });
    };

    const applyAll = () => {
        const firstEnabled = WEEKDAY_KEYS.map((d) => schedule[d]).find((row) => row.enabled);
        const open = firstEnabled?.open || '10:00';
        const close = firstEnabled?.close || '22:00';
        const next = emptyHoursSchedule();
        WEEKDAY_KEYS.forEach((day) => {
            next[day] = { enabled: true, open, close };
        });
        onChange(next);
    };

    const clearAll = () => onChange(emptyHoursSchedule());

    return (
        <div className={styles.hoursBlock}>
            <div className={styles.hoursHeader}>
                <div>
                    <h4 className={styles.hoursTitle}>{title}</h4>
                    {hint && <p className={styles.hoursHint}>{hint}</p>}
                </div>
                <div className={styles.hoursActions}>
                    <button type="button" className={styles.hoursMiniBtn} onClick={applyAll}>All days</button>
                    <button type="button" className={styles.hoursMiniBtn} onClick={clearAll}>Clear</button>
                </div>
            </div>
            <div className={styles.hoursTable}>
                {WEEKDAY_KEYS.map((day) => {
                    const row = schedule[day] || { enabled: false, open: '10:00', close: '22:00' };
                    return (
                        <div key={day} className={`${styles.hoursRow} ${row.enabled ? '' : styles.hoursRowOff}`}>
                            <label className={styles.hoursDay}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(row.enabled)}
                                    onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                                />
                                {WEEKDAY_LABELS[day]}
                            </label>
                            <input
                                type="time"
                                value={row.open}
                                disabled={!row.enabled}
                                onChange={(e) => updateDay(day, { open: e.target.value })}
                            />
                            <span className={styles.hoursSep}>–</span>
                            <input
                                type="time"
                                value={row.close}
                                disabled={!row.enabled}
                                onChange={(e) => updateDay(day, { close: e.target.value })}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BranchModal({ branch, brands, defaultBrandId, onClose, onSave }) {
    const lockedBrand = defaultBrandId || branch?.brandId || '';
    const [form, setForm] = useState({
        brand: lockedBrand || brands[0]?.id || '',
        name: branch?.name || '',
        address: branch?.location || '',
        phone: branch?.phone || '',
        service_fee: branch?.fee ?? 5000,
        deposit_enabled: branch?.hasDeposit ?? false,
        deposit_amount: branch?.depositAmount ?? 0,
        is_active: branch ? branch.status === 'Active' : true,
        workingHours: branch?.workingHours || defaultWorkingHoursSchedule(),
        bookingHours: branch?.bookingHours || emptyHoursSchedule(),
        latitude: branch?.latitude ?? '',
        longitude: branch?.longitude ?? '',
    });
    const [busy, setBusy] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(Boolean(branch?.id));
    const [error, setError] = useState('');

    useEffect(() => {
        if (!branch?.id) return undefined;
        let active = true;
        (async () => {
            setLoadingDetail(true);
            try {
                const detail = await getPartnerBranch(branch.id);
                if (!active) return;
                setForm((prev) => ({
                    ...prev,
                    name: detail.name || prev.name,
                    address: detail.location || prev.address,
                    phone: detail.phone || prev.phone,
                    service_fee: detail.fee ?? prev.service_fee,
                    deposit_enabled: detail.hasDeposit,
                    deposit_amount: detail.depositAmount ?? prev.deposit_amount,
                    is_active: detail.is_active,
                    workingHours: detail.workingHours || defaultWorkingHoursSchedule(),
                    bookingHours: detail.bookingHours || emptyHoursSchedule(),
                    latitude: detail.latitude ?? '',
                    longitude: detail.longitude ?? '',
                }));
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoadingDetail(false);
            }
        })();
        return () => { active = false; };
    }, [branch?.id]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await onSave(form, branch);
            onClose();
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modalContentWide}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{branch ? 'Edit Branch' : 'Add Branch'}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBodyScroll}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        {loadingDetail && <div className={styles.errorText} style={{ color: '#aaa' }}>Loading branch details...</div>}
                        {!branch && !defaultBrandId && (
                            <div className={styles.formGroup}>
                                <label>Brand *</label>
                                <select
                                    value={form.brand}
                                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                                    required
                                >
                                    <option value="">Select brand</option>
                                    {brands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className={styles.formGroup}>
                            <label>Branch name *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Address *</label>
                            <input
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Location on map *</label>
                            <LocationMapPicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                onChange={({ latitude, longitude }) => setForm((prev) => ({
                                    ...prev,
                                    latitude,
                                    longitude,
                                }))}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Service fee</label>
                                <input
                                    type="number"
                                    value={form.service_fee}
                                    onChange={(e) => setForm({ ...form, service_fee: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={form.deposit_enabled}
                                        onChange={(e) => setForm({ ...form, deposit_enabled: e.target.checked })}
                                    />
                                    {' '}Deposit enabled
                                </label>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Deposit amount</label>
                                <input
                                    type="number"
                                    value={form.deposit_amount}
                                    onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Status</label>
                            <select
                                value={form.is_active ? 'active' : 'inactive'}
                                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <HoursEditor
                            title="Working hours"
                            hint="Branch ochiq bo‘ladigan kunlar (format: mon → [open, close])"
                            schedule={form.workingHours}
                            onChange={(workingHours) => setForm((prev) => ({ ...prev, workingHours }))}
                        />
                        <HoursEditor
                            title="Booking hours"
                            hint="Ixtiyoriy: bron boshlanishi mumkin bo‘lgan oraliq. Bo‘sh qoldirsangiz working hours ishlatiladi."
                            schedule={form.bookingHours}
                            onChange={(bookingHours) => setForm((prev) => ({ ...prev, bookingHours }))}
                        />
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy || loadingDetail}>
                            {busy ? 'Saving...' : (branch ? 'Save Changes' : 'Create Branch')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function BrandPickerGrid({ brands, onSelect }) {
    if (!brands.length) {
        return <div className={styles.emptyState}>No brands found. Create a brand first.</div>;
    }

    return (
        <div className={styles.brandPickerGrid}>
            {brands.map((brand) => (
                <button
                    key={brand.id}
                    type="button"
                    className={styles.brandPickerCard}
                    onClick={() => onSelect(brand)}
                >
                    <div className={styles.brandPickerIcon}>◈</div>
                    <h3>{brand.name}</h3>
                    <p>{brand.slug}</p>
                    <span className={styles.brandPickerMeta}>{brand.branches} branches</span>
                </button>
            ))}
        </div>
    );
}

export default function Branch() {
    const [branches, setBranches] = useState([]);
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const owner = isOwner();

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [branchList, brandList] = await Promise.all([
                getPartnerBranches(),
                getPartnerBrands(),
            ]);

            const branchCountByBrand = branchList.reduce((acc, branch) => {
                const key = String(branch.brandId);
                if (key) acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            setBranches(branchList);
            setBrands(brandList.map((brand) => ({
                ...brand,
                branches: branchCountByBrand[String(brand.id)] ?? brand.branches,
            })));
        } catch (err) {
            console.error('Branches load error:', err);
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredBranches = useMemo(() => {
        if (!selectedBrand) return [];
        return branches.filter((branch) => String(branch.brandId) === String(selectedBrand.id));
    }, [branches, selectedBrand]);

    const handleSave = async (form, branch) => {
        if (form.latitude === '' || form.longitude === '' || form.latitude == null || form.longitude == null) {
            throw new Error('Xaritadan branch joylashuvini belgilang.');
        }
        const working_hours = hoursToApi(form.workingHours);
        const booking_hours = hoursToApi(form.bookingHours);
        const basePayload = {
            name: form.name.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            service_fee: form.service_fee,
            deposit_enabled: form.deposit_enabled,
            deposit_amount: form.deposit_amount,
            is_active: form.is_active,
            working_hours,
            booking_hours,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
        };

        if (branch) {
            await patchPartnerBranch(branch.id, basePayload);
        } else {
            const brandId = form.brand || selectedBrand?.id;
            if (!brandId) {
                throw new Error('Select a brand before creating a branch.');
            }
            await createPartnerBranchWithUniqueSlug({
                ...basePayload,
                brand: Number(brandId),
            });
        }
        await loadData();
    };

    const openCreate = () => {
        if (!selectedBrand && !brands.length) {
            setError('Create a brand first before adding branches.');
            return;
        }
        setEditBranch(null);
        setShowModal(true);
    };

    return (
        <>
            <PageHeader
                title={selectedBrand ? `${selectedBrand.name} — Branches` : 'Branches'}
                actions={(
                    <>
                        {selectedBrand && (
                            <button
                                type="button"
                                className={styles.backBtn}
                                onClick={() => setSelectedBrand(null)}
                            >
                                ← Brands
                            </button>
                        )}
                        {owner && selectedBrand && (
                            <button type="button" className={styles.addBranchBtn} onClick={openCreate}>
                                + Add Branch
                            </button>
                        )}
                    </>
                )}
            />

            {error && <div className={styles.errorBanner}>{error}</div>}

            <div className={selectedBrand ? styles.branchContainer : styles.brandPickerContainer}>
                {loading ? (
                    <div className={styles.emptyState}>Loading...</div>
                ) : !selectedBrand ? (
                    <>
                        <p className={styles.pickerHint}>Select a brand to view and manage its branches</p>
                        <BrandPickerGrid brands={brands} onSelect={setSelectedBrand} />
                    </>
                ) : filteredBranches.length === 0 ? (
                    <div className={styles.emptyState}>
                        No branches for this brand yet.
                        {owner && (
                            <button type="button" className={styles.addBranchBtnInline} onClick={openCreate}>
                                + Add first branch
                            </button>
                        )}
                    </div>
                ) : (
                    filteredBranches.map((item) => (
                        <BranchCard
                            key={item.id}
                            branch={item}
                            onEdit={owner ? () => { setEditBranch(item); setShowModal(true); } : null}
                        />
                    ))
                )}
            </div>

            {showModal && (
                <BranchModal
                    branch={editBranch}
                    brands={brands}
                    defaultBrandId={selectedBrand?.id}
                    onClose={() => { setShowModal(false); setEditBranch(null); }}
                    onSave={handleSave}
                />
            )}
        </>
    );
}
