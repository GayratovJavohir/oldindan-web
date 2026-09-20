import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Brand.module.css';
import {
    createPartnerBrandWithUniqueSlug,
    getPartnerBrands,
    getPartnerBranches,
} from '../../../../services/restaurants.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { isOwner } from '../../../../utils/authUser';

// FIX: this whole page was hard-coded English while the `brands.*`
// translations already existed in uz/en/ru and were simply never wired up.
function BrandModal({ onClose, onSave }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({ name: '', description: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setBusy(true);
        setError('');
        try {
            await onSave(form);
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
                    <h3 className={styles.modalTitle}>{t('brands.addBrandTitle')}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        <div className={styles.formGroup}>
                            <label>{t('brands.brandName')} *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder={t('brands.brandNamePlaceholder')}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>{t('brands.description')}</label>
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder={t('brands.descriptionPlaceholder')}
                            />
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
                            {busy ? t('common.saving') : t('brands.createBrand')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function BTableCard() {
    const { t } = useTranslation();
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const owner = isOwner();

    const loadBrands = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [brandList, branchList] = await Promise.all([
                getPartnerBrands(),
                getPartnerBranches().catch(() => []),
            ]);
            const branchCountByBrand = branchList.reduce((acc, branch) => {
                const key = String(branch.brandId);
                if (key) acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            setBrands(brandList.map((brand) => ({
                ...brand,
                branches: branchCountByBrand[String(brand.id)] ?? brand.branches,
            })));
        } catch (err) {
            console.error('Brands load error:', err);
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBrands();
    }, [loadBrands]);

    const handleCreate = async (form) => {
        await createPartnerBrandWithUniqueSlug(form.name.trim(), form.description.trim());
        await loadBrands();
    };

    return (
        <div className={styles.pageBrands}>
            <div className={styles.cardBrand}>
                <div className={styles.cardBrandHeader}>
                    <h2 className={styles.headerTitle}>{t('brands.title')}</h2>
                    {owner && (
                        <button type="button" className={styles.addBtn} onClick={() => setShowModal(true)}>
                            {t('brands.addBrand')}
                        </button>
                    )}
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.tableWrapper}>
                    <table className={styles.brandTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{t('brands.headers.name')}</th>
                                <th>{t('brands.headers.slug')}</th>
                                <th>{t('brands.headers.owner')}</th>
                                <th>{t('brands.headers.branches')}</th>
                                <th>{t('brands.headers.created')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}>{t('brands.loading')}</td></tr>
                            ) : brands.length === 0 ? (
                                <tr><td colSpan={6}>{t('brands.noBrands')}</td></tr>
                            ) : (
                                brands.map((brand) => (
                                    <tr key={brand.id}>
                                        <td>#{brand.id}</td>
                                        <td className={styles.brandName}>{brand.name}</td>
                                        <td className={styles.slug}>{brand.slug}</td>
                                        <td>{brand.owner}</td>
                                        <td>{brand.branches}</td>
                                        <td>{brand.created}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <BrandModal
                    onClose={() => setShowModal(false)}
                    onSave={handleCreate}
                />
            )}
        </div>
    );
}
