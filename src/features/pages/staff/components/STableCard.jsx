import React, { useCallback, useEffect, useState } from 'react';
import styles from '../Staff.module.css';
import { getPartnerBranches } from '../../../../services/restaurants.services';
import { getStaffList, registerStaff } from '../../../../services/staff.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { canManageStaff } from '../../../../utils/authUser';

function StaffModal({ branches, onClose, onSave }) {
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
                    <h3 className={styles.modalTitle}>Add Staff</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {error && <div className={styles.errorText}>{error}</div>}
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>First name *</label>
                                <input
                                    value={form.first_name}
                                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Last name</label>
                                <input
                                    value={form.last_name}
                                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Email *</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Password *</label>
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
                                <label>Role *</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="manager">Manager</option>
                                    <option value="receptionist">Receptionist</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Branch *</label>
                                <select
                                    value={form.branch_id}
                                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select branch</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={busy}>
                            {busy ? 'Saving...' : 'Create Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function STableCard() {
    const [staff, setStaff] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
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
            throw new Error('Branch is required.');
        }
        await registerStaff(form, branches);
        await loadData();
    };

    const openCreateModal = () => {
        if (!branches.length) {
            setError('Create at least one branch before adding staff.');
            return;
        }
        setError('');
        setShowModal(true);
    };

    return (
        <div className={styles.pageBrands}>
            <div className={styles.cardStaff}>
                <div className={styles.cardStaffHeader}>
                    <h2 className={styles.headerTitle}>Staff Members</h2>
                    {canAdd && (
                        <button type="button" className={styles.addBtn} onClick={openCreateModal}>
                            + Add Staff
                        </button>
                    )}
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.tableWrapper}>
                    <table className={styles.staffTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>NAME</th>
                                <th>EMAIL</th>
                                <th>ROLE</th>
                                <th>BRANCH</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}>Loading...</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan={6}>No staff yet. Register your first staff member.</td></tr>
                            ) : (
                                staff.map((member) => (
                                    <tr key={member.id}>
                                        <td>#{member.id}</td>
                                        <td className={styles.staffName}>{member.name}</td>
                                        <td>{member.email}</td>
                                        <td className={styles.role}>{member.role}</td>
                                        <td>{member.branch}</td>
                                        <td className={styles.status}>{member.status}</td>
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
        </div>
    );
}
