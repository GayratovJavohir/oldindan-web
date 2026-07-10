import React, { useEffect, useState } from 'react';
import styles from '../Profile.module.css';
import AuthService from '../../../../services/auth.services';
import { getApiError } from '../../../../utils/apiHelpers';
import { getStoredUser } from '../../../../utils/authUser';
import ProfileAnalytics from './ProfileAnalytics';

function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'manager') return 'Manager';
    if (role === 'receptionist') return 'Receptionist';
    return 'Partner';
}

function roleBadgeClass(role) {
    if (role === 'owner') return styles.roleOwner;
    if (role === 'manager') return styles.roleManager;
    return styles.roleReceptionist;
}

export default function ProfileCard() {
    const [user, setUser] = useState(getStoredUser());
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const syncForm = (profile) => {
        setForm({
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            phone: profile?.phone || '',
        });
    };

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const profile = await AuthService.getProfile();
                if (!active) return;
                const mapped = getStoredUser();
                setUser(mapped);
                syncForm(mapped || profile);
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const initials = (user?.name || 'P')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'P';

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await AuthService.updateProfile({
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                phone: form.phone.trim(),
            });
            const updated = getStoredUser();
            setUser(updated);
            syncForm(updated);
            setEditing(false);
            setSuccess('Profile updated successfully.');
        } catch (err) {
            setError(err.message || getApiError(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading && !user) {
        return <div className={styles.loadingState}>Loading profile...</div>;
    }

    return (
        <div className={styles.profileLayout}>
            <section className={styles.profileHero}>
                <div className={styles.avatarLarge}>{initials}</div>
                <div className={styles.heroInfo}>
                    <h2 className={styles.heroName}>{user?.name || 'Partner'}</h2>
                    <p className={styles.heroEmail}>{user?.email || '—'}</p>
                    <span className={`${styles.roleBadge} ${roleBadgeClass(user?.role)}`}>
                        {roleLabel(user?.role)}
                    </span>
                    {user?.branchId && (
                        <p className={styles.branchNote}>Assigned branch ID: {user.branchId}</p>
                    )}
                </div>
                <button
                    type="button"
                    className={styles.editToggleBtn}
                    onClick={() => { setEditing((v) => !v); setSuccess(''); setError(''); }}
                >
                    {editing ? 'Cancel' : 'Edit profile'}
                </button>
            </section>

            {error && <div className={styles.errorBanner}>{error}</div>}
            {success && <div className={styles.successBanner}>{success}</div>}

            <section className={styles.profileCard}>
                <h3 className={styles.cardTitle}>Account details</h3>

                {editing ? (
                    <form className={styles.profileForm} onSubmit={handleSave}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>First name</label>
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
                                    required
                                />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input value={user?.email || ''} disabled />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                        </div>
                        <button type="submit" className={styles.saveBtn} disabled={saving}>
                            {saving ? 'Saving...' : 'Save changes'}
                        </button>
                    </form>
                ) : (
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>First name</span>
                            <span className={styles.infoValue}>{user?.first_name || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Last name</span>
                            <span className={styles.infoValue}>{user?.last_name || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Email</span>
                            <span className={styles.infoValue}>{user?.email || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Phone</span>
                            <span className={styles.infoValue}>{user?.phone || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Account type</span>
                            <span className={styles.infoValue}>{user?.accountType || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Role</span>
                            <span className={styles.infoValue}>{roleLabel(user?.role)}</span>
                        </div>
                    </div>
                )}
            </section>

            <ProfileAnalytics />
        </div>
    );
}
