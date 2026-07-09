import React, { useCallback, useEffect, useState } from 'react';
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

function BranchModal({ branch, brands, onClose, onSave }) {
    const [form, setForm] = useState({
        brand: branch?.brandId || brands[0]?.id || '',
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
                        {!branch && (
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

export default function Branch() {
    const [branches, setBranches] = useState([]);
    const [brands, setBrands] = useState([]);
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
            setBranches(branchList);
            setBrands(brandList);
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
            if (!form.brand) {
                throw new Error('Select a brand before creating a branch.');
            }
            await createPartnerBranchWithUniqueSlug({
                brand: Number(form.brand),
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
        if (!brands.length) {
            setError('Create a brand first before adding branches.');
            return;
        }
        setEditBranch(null);
        setShowModal(true);
    };

    return (
        <>
            <header className={styles.branchHeader}>
                <h1 className={styles.branchTitle}>Branches</h1>
                {owner && (
                    <button type="button" className={styles.addBranchBtn} onClick={openCreate}>
                        + Add Branch
                    </button>
                )}
            </header>

            {error && <div className={styles.errorBanner}>{error}</div>}

            <div className={styles.branchContainer}>
                {loading ? (
                    <div className={styles.emptyState}>Loading branches...</div>
                ) : branches.length === 0 ? (
                    <div className={styles.emptyState}>No branches found.</div>
                ) : (
                    branches.map((item) => (
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
                    onClose={() => { setShowModal(false); setEditBranch(null); }}
                    onSave={handleSave}
                />
            )}
        </>
    );
}
