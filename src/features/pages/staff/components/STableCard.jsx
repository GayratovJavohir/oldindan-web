import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Staff.module.css';
import { getPartnerBranches } from '../../../../services/restaurants.services';
import { getStaffList, registerStaff, updateStaff } from '../../../../services/staff.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { canManageStaff } from '../../../../utils/authUser';

// FIX: the whole staff screen was hard-coded English even though the
// `staff.*` translations already shipped in uz/en/ru.
function StaffModal({ branches, onClose, onSave }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'manager',
        branch_id: branches[0]?.id || '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
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
                    <h3 className={styles.modalTitle}>{t('staff.addStaffTitle')}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>{t('staff.firstName')} *</label>
                                <input
                                    value={form.first_name}
                                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>{t('staff.lastName')}</label>
                                <input
                                    value={form.last_name}
                                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>{t('staff.email')} *</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>{t('staff.password')} *</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                minLength={6}
                                required
                            />
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>{t('staff.role')} *</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="manager">{t('staff.roleManager')}</option>
                                    <option value="receptionist">{t('staff.roleReceptionist')}</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>{t('staff.branch')} *</label>
                                <select
                                    value={form.branch_id}
                                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                                    required
                                >
                                    <option value="">{t('staff.selectBranch')}</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
                            {busy ? t('common.saving') : t('staff.createStaff')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Deliberately narrow: staff identity (name/email/password) isn't editable
 * here — only role, branch, and active/inactive status can change.
 */
function EditStaffModal({ member, branches, onClose, onSave }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        role: member.roleKey || 'manager',
        branch_id: member.branchId || branches[0]?.id || '',
        status: member.status || 'active',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await onSave(member.id, form);
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
                    <h3 className={styles.modalTitle}>{t('staff.editStaffTitle')} — {member.name}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>{t('staff.role')} *</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="manager">{t('staff.roleManager')}</option>
                                    <option value="receptionist">{t('staff.roleReceptionist')}</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>{t('staff.branch')} *</label>
                                <select
                                    value={form.branch_id}
                                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                                    required
                                >
                                    <option value="">{t('staff.selectBranch')}</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>{t('staff.status')} *</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="active">{t('staff.statusActive')}</option>
                                <option value="inactive">{t('staff.statusInactive')}</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
                            {busy ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function STableCard() {
    const { t } = useTranslation();
    const [staff, setStaff] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const canAdd = canManageStaff();

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [staffList, branchList] = await Promise.all([
                getStaffList(),
                getPartnerBranches().catch(() => []),
            ]);
            setStaff(staffList);
            setBranches(branchList);
        } catch (err) {
            console.error('Staff load error:', err);
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = async (form) => {
        if (!form.branch_id) {
            throw new Error(t('staff.needBranch'));
        }
        await registerStaff(form, branches);
        await loadData();
    };

    const handleUpdate = async (id, form) => {
        await updateStaff(id, form, branches);
        await loadData();
    };

    const openCreateModal = () => {
        if (!branches.length) {
            setError(t('staff.createBranchFirst'));
            return;
        }
        setError('');
        setShowModal(true);
    };

    const openEditModal = (member) => {
        setError('');
        setEditingStaff(member);
    };

    return (
        <div className={styles.pageBrands}>
            <div className={styles.cardStaff}>
                <div className={styles.cardStaffHeader}>
                    <h2 className={styles.headerTitle}>{t('staff.membersTitle')}</h2>
                    {canAdd && (
                        <button type="button" className={styles.addBtn} onClick={openCreateModal}>
                            {t('staff.addStaff')}
                        </button>
                    )}
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.tableWrapper}>
                    <table className={styles.staffTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{t('staff.headers.name')}</th>
                                <th>{t('staff.headers.email')}</th>
                                <th>{t('staff.headers.role')}</th>
                                <th>{t('staff.headers.branch')}</th>
                                <th>{t('staff.headers.status')}</th>
                                {canAdd && <th>{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={canAdd ? 7 : 6}>{t('staff.loading')}</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan={canAdd ? 7 : 6}>{t('staff.noStaff')}</td></tr>
                            ) : (
                                staff.map((member) => (
                                    <tr key={member.id}>
                                        <td>#{member.id}</td>
                                        <td className={styles.staffName}>{member.name}</td>
                                        <td>{member.email}</td>
                                        <td className={styles.role}>{member.role}</td>
                                        <td>{member.branch}</td>
                                        <td className={styles.status}>
                                            {member.status === 'inactive' ? t('staff.statusInactive') : t('staff.statusActive')}
                                        </td>
                                        {canAdd && (
                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.editBtn}
                                                    onClick={() => openEditModal(member)}
                                                >
                                                    {t('staff.edit')}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <StaffModal
                    branches={branches}
                    onClose={() => setShowModal(false)}
                    onSave={handleCreate}
                />
            )}

            {editingStaff && (
                <EditStaffModal
                    member={editingStaff}
                    branches={branches}
                    onClose={() => setEditingStaff(null)}
                    onSave={handleUpdate}
                />
            )}
        </div>
    );
}