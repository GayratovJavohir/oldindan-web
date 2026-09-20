import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { getStoredUser } from '../../../utils/authUser';
import AuthService from '../../../services/auth.services';
import { setAppLanguage } from '../../../i18n';

const LANGUAGES = [
    { code: 'uz', label: "O'zbekcha" },
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
];

import { useTheme } from '../../../context/ThemeContext';
import {
    DEPOSIT_TYPES,
    PAYMENT_PROVIDERS,
    getDefaultPaymentSettings,
    updateDefaultPaymentSettings,
} from '../../../services/paymentSettings.services';

function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

function roleLabel(role, t) {
    const map = {
        owner: t('settings.roleOwner'),
        manager: t('settings.roleManager'),
        receptionist: t('settings.roleReceptionist'),
    };
    return map[role] || role || t('settings.roleUnknown');
}

/** Small reusable on/off switch used across the settings sections. */
function Toggle({ checked, onChange, disabled = false }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
            onClick={() => !disabled && onChange?.(!checked)}
        >
            <span className={styles.toggleKnob} />
        </button>
    );
}

function SectionCard({ title, description, children, badge }) {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <h3 className={styles.cardTitle}>{title}</h3>
                    {description && <p className={styles.cardDescription}>{description}</p>}
                </div>
                {badge && <span className={styles.badge}>{badge}</span>}
            </div>
            <div className={styles.cardBody}>{children}</div>
        </div>
    );
}

function Row({ label, hint, control }) {
    return (
        <div className={styles.row}>
            <div className={styles.rowText}>
                <span className={styles.rowLabel}>{label}</span>
                {hint && <span className={styles.rowHint}>{hint}</span>}
            </div>
            <div className={styles.rowControl}>{control}</div>
        </div>
    );
}

export default function Settings() {
    const { t, i18n } = useTranslation();
    const user = getStoredUser();
    const role = user?.role || 'receptionist';

    const TABS = useMemo(() => {
        const base = [
            { key: 'profile', label: t('settings.tabProfile') },
            { key: 'appearance', label: t('settings.tabAppearance') },
            { key: 'notifications', label: t('settings.tabNotifications') },
            { key: 'security', label: t('settings.tabSecurity') },
        ];
        const roleTab = {
            owner: { key: 'role', label: t('settings.tabOwner') },
            manager: { key: 'role', label: t('settings.tabManager') },
            receptionist: { key: 'role', label: t('settings.tabReceptionist') },
        }[role];
        return roleTab ? [...base, roleTab] : base;
    }, [role, t]);

    const [activeTab, setActiveTab] = useState('profile');

    // --- appearance state ---
    const { theme, setTheme } = useTheme();
    const currentLangCode = (i18n.language || 'uz').split('-')[0];

    // FIX: called `i18n.changeLanguage` directly, bypassing `setAppLanguage`,
    // which is the single place that persists the choice under `rp_lang`.
    const handleLanguageChange = (code) => {
        setAppLanguage(code);
    };

    const handleThemeChange = (value) => {
        setTheme(value);
    };

    // --- notification toggles (local-only placeholder state for now) ---
    const [notifPrefs, setNotifPrefs] = useState({
        newBooking: true,
        cancelledBooking: true,
        dailySummary: false,
        systemAlerts: true,
    });
    const updateNotif = (key) => (value) => setNotifPrefs((prev) => ({ ...prev, [key]: value }));

    // --- security: change password ---
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [pwStatus, setPwStatus] = useState({ loading: false, error: '', success: '' });

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
            setPwStatus({ loading: false, error: t('settings.pwAllFields'), success: '' });
            return;
        }
        if (pwForm.next.length < 8) {
            setPwStatus({ loading: false, error: t('settings.pwTooShort'), success: '' });
            return;
        }
        if (pwForm.next !== pwForm.confirm) {
            setPwStatus({ loading: false, error: t('settings.pwMismatch'), success: '' });
            return;
        }
        setPwStatus({ loading: true, error: '', success: '' });
        try {
            // TODO: wire this to the real change-password endpoint once known,
            // e.g. await $api.post('/accounts/change-password/', {
            //   old_password: pwForm.current, new_password: pwForm.next,
            // });
            await new Promise((resolve) => setTimeout(resolve, 500));
            setPwStatus({
                loading: false,
                error: '',
                success: t('settings.pwEndpointMissing'),
            });
            setPwForm({ current: '', next: '', confirm: '' });
        } catch (err) {
            setPwStatus({ loading: false, error: getErrorMessage(err, t), success: '' });
        }
    };

    // FIX: this wiped the *entire* localStorage, so signing out also threw
    // away the chosen theme, the interface language and the remembered
    // brand/branch. Only the auth keys should go.
    const handleLogout = () => {
        AuthService.logout();
        window.location.replace('/login');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>{t('settings.title')}</h1>
                <p className={styles.subtitle}>
                    {t('settings.subtitle')}
                </p>
            </div>

            <div className={styles.layout}>
                <nav className={styles.nav}>
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`${styles.navItem} ${activeTab === tab.key ? styles.navItemActive : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div className={styles.content}>
                    {activeTab === 'profile' && (
                        <SectionCard
                            title={t('settings.profileTitle')}
                            description={t('settings.profileDesc')}
                        >
                            <div className={styles.profileTop}>
                                <div className={styles.avatar}>
                                    {/* FIX: mapProfile() stores `first_name` /
                                        `last_name`; the camelCase keys were
                                        always undefined here. */}
                                    {initials(`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.name)}
                                </div>
                                <div>
                                    <div className={styles.profileName}>
                                        {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.name || t('settings.noName')}
                                    </div>
                                    <div className={styles.profileRole}>{roleLabel(role, t)}</div>
                                </div>
                            </div>

                            <div className={styles.divider} />

                            <Row
                                label={t('common.phone')}
                                control={<span className={styles.staticValue}>{user?.phone || '—'}</span>}
                            />
                            <Row
                                label={t('settings.email')}
                                control={<span className={styles.staticValue}>{user?.email || '—'}</span>}
                            />
                            {user?.branchId && (
                                <Row
                                    label={t('common.branch')}
                                    control={<span className={styles.staticValue}>{user?.branchName || `#${user.branchId}`}</span>}
                                />
                            )}
                            <p className={styles.note}>
                                {t('settings.profileEditNote')}
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'appearance' && (
                        <SectionCard
                            title={t('settings.appearanceTitle')}
                            description={t('settings.appearanceDesc')}
                        >
                            <Row
                                label={t('settings.language')}
                                hint={t('settings.languageHint')}
                                control={(
                                    <select
                                        className={styles.select}
                                        value={currentLangCode}
                                        onChange={(e) => handleLanguageChange(e.target.value)}
                                    >
                                        {LANGUAGES.map((lang) => (
                                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                                        ))}
                                    </select>
                                )}
                            />

                            {/* MAVZU UCHUN YANGILANGAN QISM */}
                            <Row
                                label={t('settings.theme')}
                                hint={t('settings.themeHint')}
                                control={(
                                    <select
                                        className={styles.select}
                                        value={theme || 'system'}
                                        onChange={(e) => handleThemeChange(e.target.value)}
                                    >
                                        <option value="light">{t('settings.themeLight')}</option>
                                        <option value="dark">{t('settings.themeDark')}</option>
                                        <option value="system">{t('settings.themeSystem')}</option>
                                    </select>
                                )}
                            />
                        </SectionCard>
                    )}

                    {activeTab === 'notifications' && (
                        <SectionCard
                            title={t('settings.notificationsTitle')}
                            description={t('settings.notificationsDesc')}
                            badge={t('settings.comingSoonBadge')}
                        >
                            <Row
                                label={t('settings.notifNewBooking')}
                                control={<Toggle checked={notifPrefs.newBooking} onChange={updateNotif('newBooking')} />}
                            />
                            <Row
                                label={t('settings.notifCancelled')}
                                control={<Toggle checked={notifPrefs.cancelledBooking} onChange={updateNotif('cancelledBooking')} />}
                            />
                            <Row
                                label={t('settings.notifDailySummary')}
                                control={<Toggle checked={notifPrefs.dailySummary} onChange={updateNotif('dailySummary')} />}
                            />
                            <Row
                                label={t('settings.notifSystem')}
                                control={<Toggle checked={notifPrefs.systemAlerts} onChange={updateNotif('systemAlerts')} />}
                            />
                            <p className={styles.note}>
                                {t('settings.notifNote')}
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'security' && (
                        <>
                            <SectionCard
                                title={t('settings.pwTitle')}
                                description={t('settings.pwDesc')}
                            >
                                <form className={styles.formStack} onSubmit={handlePasswordSubmit}>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwCurrent')}</span>
                                        <input
                                            type="password"
                                            className={styles.input}
                                            value={pwForm.current}
                                            onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                                        />
                                    </label>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwNext')}</span>
                                        <input
                                            type="password"
                                            className={styles.input}
                                            value={pwForm.next}
                                            onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                                        />
                                    </label>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwConfirm')}</span>
                                        <input
                                            type="password"
                                            className={styles.input}
                                            value={pwForm.confirm}
                                            onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                                        />
                                    </label>

                                    {pwStatus.error && <div className={styles.errorBanner}>{pwStatus.error}</div>}
                                    {pwStatus.success && <div className={styles.successBanner}>{pwStatus.success}</div>}

                                    <button type="submit" className={styles.primaryBtn} disabled={pwStatus.loading}>
                                        {pwStatus.loading ? t('common.saving') : t('settings.pwSubmit')}
                                    </button>
                                </form>
                            </SectionCard>

                            <SectionCard
                                title={t('settings.sessionTitle')}
                                description={t('settings.sessionDesc')}
                            >
                                <button type="button" className={styles.dangerBtn} onClick={handleLogout}>
                                    {t('settings.logout')}
                                </button>
                            </SectionCard>
                        </>
                    )}

                    {activeTab === 'role' && role === 'owner' && <OwnerSettings t={t} />}
                    {activeTab === 'role' && role === 'manager' && <ManagerSettings t={t} />}
                    {activeTab === 'role' && role === 'receptionist' && <ReceptionistSettings t={t} />}
                </div>
            </div>
        </div>
    );
}

function getErrorMessage(err, t) {
    return err?.response?.data?.detail || err?.message || t('settings.pwGenericError');
}

// ---------------------------------------------------------------------------
// Role-specific sections
// ---------------------------------------------------------------------------

function OwnerSettings({ t }) {
    return (
        <>
            <SectionCard
                title={t('settings.ownerTitle')}
                description={t('settings.ownerDesc')}
            >
                <div className={styles.linkGrid}>
                    <a className={styles.linkCard} href="/floor-layout">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBranches')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBranchesHint')}</span>
                    </a>
                    <a className={styles.linkCard} href="/staff">
                        <span className={styles.linkCardTitle}>{t('settings.ownerStaff')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerStaffHint')}</span>
                    </a>
                    <a className={styles.linkCard} href="/profile">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBilling')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBillingHint')}</span>
                    </a>
                    <a className={styles.linkCard} href="/brands">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBrand')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBrandHint')}</span>
                    </a>
                </div>
                <p className={styles.note}>
                    {t('settings.ownerNote')}
                </p>
            </SectionCard>

            <DepositPaymentSettingsCard t={t} />
        </>
    );
}

/**
 * Global default deposit / online-payment (Payme, Click) settings.
 * Individual branches can override these on the Branch page.
 */
function DepositPaymentSettingsCard({ t }) {
    const [form, setForm] = useState({
        enabled: false,
        depositType: 'fixed',
        depositValue: 0,
        provider: 'payme',
        merchantId: '',
    });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ saving: false, error: '', success: '' });

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await getDefaultPaymentSettings();
                if (active) setForm((prev) => ({ ...prev, ...data }));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus({ saving: true, error: '', success: '' });
        try {
            await updateDefaultPaymentSettings(form);
            setStatus({
                saving: false,
                error: '',
                success: t(
                    'settings.depositSavedPlaceholder',
                    "Saqlandi (hozircha shu qurilmada — backend endpoint tayyor bo'lgach serverga ulanadi).",
                ),
            });
        } catch (err) {
            setStatus({ saving: false, error: err?.message || t('settings.pwGenericError'), success: '' });
        }
    };

    return (
        <SectionCard
            title={t('settings.depositTitle')}
            description={t('settings.depositDesc')}
            badge={t('settings.comingSoonBadge')}
        >
            {loading ? (
                <p className={styles.note}>{t('common.loading')}</p>
            ) : (
                <form className={styles.formStack} onSubmit={handleSave}>
                    <Row
                        label={t('settings.depositEnabled')}
                        hint={t('settings.depositEnabledHint')}
                        control={<Toggle checked={form.enabled} onChange={(v) => update({ enabled: v })} />}
                    />

                    <Row
                        label={t('settings.depositType')}
                        control={(
                            <select
                                className={styles.select}
                                value={form.depositType}
                                disabled={!form.enabled}
                                onChange={(e) => update({ depositType: e.target.value })}
                            >
                                {/* FIX: DEPOSIT_TYPES used to carry hard-coded
                                    Uzbek labels from the service layer. */}
                                {DEPOSIT_TYPES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {t(`settings.depositType${opt.value === 'percent' ? 'Percent' : 'Fixed'}`)}
                                    </option>
                                ))}
                            </select>
                        )}
                    />

                    <Row
                        label={form.depositType === 'percent'
                            ? t('settings.depositValuePercent')
                            : t('settings.depositValueFixed')}
                        control={(
                            <input
                                type="number"
                                min="0"
                                max={form.depositType === 'percent' ? 100 : undefined}
                                className={styles.inputSmall}
                                disabled={!form.enabled}
                                value={form.depositValue}
                                onChange={(e) => update({ depositValue: Number(e.target.value) || 0 })}
                            />
                        )}
                    />

                    <div className={styles.divider} />

                    <Row
                        label={t('settings.paymentProvider')}
                        control={(
                            <select
                                className={styles.select}
                                value={form.provider}
                                disabled={!form.enabled}
                                onChange={(e) => update({ provider: e.target.value })}
                            >
                                {PAYMENT_PROVIDERS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        )}
                    />

                    <Row
                        label={t('settings.paymentMerchantId')}
                        hint={t('settings.paymentMerchantIdHint')}
                        control={(
                            <input
                                type="text"
                                className={styles.input}
                                disabled={!form.enabled}
                                placeholder={form.provider === 'click' ? 'service_id / merchant_id' : 'merchant_id'}
                                value={form.merchantId}
                                onChange={(e) => update({ merchantId: e.target.value })}
                            />
                        )}
                    />

                    {status.error && <div className={styles.errorBanner}>{status.error}</div>}
                    {status.success && <div className={styles.successBanner}>{status.success}</div>}

                    <button type="submit" className={styles.primaryBtn} disabled={status.saving}>
                        {status.saving ? t('common.saving') : t('common.save')}
                    </button>
                </form>
            )}
        </SectionCard>
    );
}

function ManagerSettings({ t }) {
    return (
        <SectionCard
            title={t('settings.managerTitle')}
            description={t('settings.managerDesc')}
            badge={t('settings.comingSoonBadge')}
        >
            <Row
                label={t('settings.managerHours')}
                hint={t('settings.managerHoursHint')}
                control={<span className={styles.staticValue}>—</span>}
            />
            <Row
                label={t('settings.managerAutoConfirm')}
                control={<Toggle checked={false} disabled />}
            />
            <Row
                label={t('settings.managerTeam')}
                hint={t('settings.managerTeamHint')}
                control={<span className={styles.staticValue}>—</span>}
            />
        </SectionCard>
    );
}

function ReceptionistSettings({ t }) {
    const [defaults, setDefaults] = useState({ guestCount: 2, durationHours: 2 });
    return (
        <SectionCard
            title={t('settings.receptionistTitle')}
            description={t('settings.receptionistDesc')}
            badge={t('settings.comingSoonBadge')}
        >
            <Row
                label={t('settings.receptionistGuests')}
                control={(
                    <input
                        type="number"
                        min="1"
                        className={styles.inputSmall}
                        value={defaults.guestCount}
                        onChange={(e) => setDefaults((p) => ({ ...p, guestCount: Number(e.target.value) || 1 }))}
                    />
                )}
            />
            <Row
                label={t('settings.receptionistDuration')}
                control={(
                    <input
                        type="number"
                        min="1"
                        className={styles.inputSmall}
                        value={defaults.durationHours}
                        onChange={(e) => setDefaults((p) => ({ ...p, durationHours: Number(e.target.value) || 1 }))}
                    />
                )}
            />
            <p className={styles.note}>
                {t('settings.receptionistNote')}
            </p>
        </SectionCard>
    );
}