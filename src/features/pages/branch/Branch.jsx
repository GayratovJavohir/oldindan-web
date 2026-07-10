import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Branch.module.css';
import BranchCard from './components/BranchCard';
import {
    createPartnerBranchWithUniqueSlug,
    getPartnerBrands,
    getPartnerBranches,
    patchPartnerBranch,
} from '../../../services/restaurants.services';
import { getApiError } from '../../../utils/apiHelpers';
import { isOwner } from '../../../utils/authUser';

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
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

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
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{branch ? 'Edit Branch' : 'Add Branch'}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
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
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
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
        if (branch) {
            await patchPartnerBranch(branch.id, {
                name: form.name.trim(),
                address: form.address.trim(),
                phone: form.phone.trim(),
                service_fee: form.service_fee,
                deposit_enabled: form.deposit_enabled,
                deposit_amount: form.deposit_amount,
                is_active: form.is_active,
            });
        } else {
            const brandId = form.brand || selectedBrand?.id;
            if (!brandId) {
                throw new Error('Select a brand before creating a branch.');
            }
            await createPartnerBranchWithUniqueSlug({
                brand: Number(brandId),
                name: form.name.trim(),
                address: form.address.trim(),
                phone: form.phone.trim(),
                is_active: form.is_active,
                service_fee: form.service_fee,
                deposit_enabled: form.deposit_enabled,
                deposit_amount: form.deposit_amount,
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
            <header className={styles.branchHeader}>
                <div className={styles.headerLeft}>
                    {selectedBrand && (
                        <button
                            type="button"
                            className={styles.backBtn}
                            onClick={() => setSelectedBrand(null)}
                        >
                            ← Brands
                        </button>
                    )}
                    <h1 className={styles.branchTitle}>
                        {selectedBrand ? `${selectedBrand.name} — Branches` : 'Branches'}
                    </h1>
                </div>
                {owner && selectedBrand && (
                    <button type="button" className={styles.addBranchBtn} onClick={openCreate}>
                        + Add Branch
                    </button>
                )}
            </header>

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
