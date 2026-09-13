import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { getStoredUser } from '../../../utils/authUser';

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
        owner: t('settings.roleOwner', 'Egasi'),
        manager: t('settings.roleManager', 'Menejer'),
        receptionist: t('settings.roleReceptionist', 'Qabulxona xodimi'),
    };
    return map[role] || role || t('settings.roleUnknown', "Noma'lum");
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
            { key: 'profile', label: t('settings.tabProfile', 'Profil') },
            { key: 'appearance', label: t('settings.tabAppearance', "Ko'rinish") },
            { key: 'notifications', label: t('settings.tabNotifications', 'Bildirishnomalar') },
            { key: 'security', label: t('settings.tabSecurity', 'Xavfsizlik') },
        ];
        const roleTab = {
            owner: { key: 'role', label: t('settings.tabOwner', 'Biznes boshqaruvi') },
            manager: { key: 'role', label: t('settings.tabManager', 'Filial sozlamalari') },
            receptionist: { key: 'role', label: t('settings.tabReceptionist', 'Ish sozlamalari') },
        }[role];
        return roleTab ? [...base, roleTab] : base;
    }, [role, t]);

    const [activeTab, setActiveTab] = useState('profile');

    // --- appearance state ---
    const { theme, setTheme } = useTheme();
    const currentLangCode = (i18n.language || 'uz').split('-')[0];

    const handleLanguageChange = (code) => {
        i18n.changeLanguage(code);
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
            setPwStatus({ loading: false, error: t('settings.pwAllFields', "Barcha maydonlarni to'ldiring."), success: '' });
            return;
        }
        if (pwForm.next !== pwForm.confirm) {
            setPwStatus({ loading: false, error: t('settings.pwMismatch', "Yangi parollar mos kelmadi."), success: '' });
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
                success: t('settings.pwEndpointMissing', "Bu bo'lim hali backend bilan ulanmagan — endpoint tayyor bo'lgach ishlaydi."),
            });
            setPwForm({ current: '', next: '', confirm: '' });
        } catch (err) {
            setPwStatus({ loading: false, error: getErrorMessage(err, t), success: '' });
        }
    };

    const handleLogout = () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch {
            // ignore
        }
        window.location.href = '/login';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>{t('settings.title', 'Sozlamalar')}</h1>
                <p className={styles.subtitle}>
                    {t('settings.subtitle', 'Hisobingiz va ilova sozlamalarini shu yerdan boshqaring.')}
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
                            title={t('settings.profileTitle', 'Profil')}
                            description={t('settings.profileDesc', 'Hisobingiz haqidagi asosiy ma\u02bblumotlar.')}
                        >
                            <div className={styles.profileTop}>
                                <div className={styles.avatar}>
                                    {initials(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name)}
                                </div>
                                <div>
                                    <div className={styles.profileName}>
                                        {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || t('settings.noName', 'Ism kiritilmagan')}
                                    </div>
                                    <div className={styles.profileRole}>{roleLabel(role, t)}</div>
                                </div>
                            </div>

                            <div className={styles.divider} />

                            <Row
                                label={t('common.phone', 'Telefon')}
                                control={<span className={styles.staticValue}>{user?.phone || '—'}</span>}
                            />
                            <Row
                                label={t('settings.email', 'Email')}
                                control={<span className={styles.staticValue}>{user?.email || '—'}</span>}
                            />
                            {user?.branchId && (
                                <Row
                                    label={t('common.branch', 'Filial')}
                                    control={<span className={styles.staticValue}>{user?.branchName || `#${user.branchId}`}</span>}
                                />
                            )}
                            <p className={styles.note}>
                                {t('settings.profileEditNote', "Profilni tahrirlash tez orada qo'shiladi.")}
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'appearance' && (
                        <SectionCard
                            title={t('settings.appearanceTitle', "Ko'rinish")}
                            description={t('settings.appearanceDesc', 'Til va mavzuni tanlang.')}
                        >
                            <Row
                                label={t('settings.language', 'Til')}
                                hint={t('settings.languageHint', 'Interfeys tili darhol o\u2018zgaradi.')}
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
                                label={t('settings.theme', 'Mavzu (Dizayn)')}
                                hint={t('settings.themeHint', "Ilova qanday ko'rinishini tanlang.")}
                                control={(
                                    <select
                                        className={styles.select}
                                        value={theme || 'system'}
                                        onChange={(e) => handleThemeChange(e.target.value)}
                                    >
                                        <option value="light">{t('settings.themeLight', 'Yorug\u2018 rejim')}</option>
                                        <option value="dark">{t('settings.themeDark', 'Tungi rejim')}</option>
                                        <option value="system">{t('settings.themeSystem', 'Tizim (Avtomatik)')}</option>
                                    </select>
                                )}
                            />
                        </SectionCard>
                    )}

                    {activeTab === 'notifications' && (
                        <SectionCard
                            title={t('settings.notificationsTitle', 'Bildirishnomalar')}
                            description={t('settings.notificationsDesc', 'Qaysi hodisalar haqida xabar olishni tanlang.')}
                            badge={t('settings.comingSoonBadge', 'Tez orada')}
                        >
                            <Row
                                label={t('settings.notifNewBooking', 'Yangi bron')}
                                control={<Toggle checked={notifPrefs.newBooking} onChange={updateNotif('newBooking')} />}
                            />
                            <Row
                                label={t('settings.notifCancelled', 'Bekor qilingan bron')}
                                control={<Toggle checked={notifPrefs.cancelledBooking} onChange={updateNotif('cancelledBooking')} />}
                            />
                            <Row
                                label={t('settings.notifDailySummary', 'Kunlik hisobot')}
                                control={<Toggle checked={notifPrefs.dailySummary} onChange={updateNotif('dailySummary')} />}
                            />
                            <Row
                                label={t('settings.notifSystem', 'Tizim ogohlantirishlari')}
                                control={<Toggle checked={notifPrefs.systemAlerts} onChange={updateNotif('systemAlerts')} />}
                            />
                            <p className={styles.note}>
                                {t('settings.notifNote', "Bu sozlamalar hozircha faqat shu qurilmada saqlanadi, backendga ulanmagan.")}
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'security' && (
                        <>
                            <SectionCard
                                title={t('settings.pwTitle', 'Parolni almashtirish')}
                                description={t('settings.pwDesc', 'Xavfsizlik uchun kuchli parol tanlang.')}
                            >
                                <form className={styles.formStack} onSubmit={handlePasswordSubmit}>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwCurrent', 'Joriy parol')}</span>
                                        <input
                                            type="password"
                                            className={styles.input}
                                            value={pwForm.current}
                                            onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                                        />
                                    </label>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwNext', 'Yangi parol')}</span>
                                        <input
                                            type="password"
                                            className={styles.input}
                                            value={pwForm.next}
                                            onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                                        />
                                    </label>
                                    <label className={styles.field}>
                                        <span>{t('settings.pwConfirm', 'Yangi parolni tasdiqlang')}</span>
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
                                        {pwStatus.loading ? t('common.saving', 'Saqlanmoqda...') : t('settings.pwSubmit', "Parolni yangilash")}
                                    </button>
                                </form>
                            </SectionCard>

                            <SectionCard
                                title={t('settings.sessionTitle', 'Sessiya')}
                                description={t('settings.sessionDesc', 'Joriy qurilmadan chiqish.')}
                            >
                                <button type="button" className={styles.dangerBtn} onClick={handleLogout}>
                                    {t('settings.logout', 'Tizimdan chiqish')}
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
    return err?.response?.data?.detail || err?.message || t('settings.pwGenericError', "Xatolik yuz berdi.");
}

// ---------------------------------------------------------------------------
// Role-specific sections
// ---------------------------------------------------------------------------

function OwnerSettings({ t }) {
    return (
        <>
            <SectionCard
                title={t('settings.ownerTitle', 'Biznes boshqaruvi')}
                description={t('settings.ownerDesc', 'Brend, filiallar va xodimlarni boshqaring.')}
            >
                <div className={styles.linkGrid}>
                    <a className={styles.linkCard} href="/floor-layout">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBranches', 'Filiallar va layout')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBranchesHint', 'Filial qo\u2018shish, joy tartibini tahrirlash')}</span>
                    </a>
                    <a className={styles.linkCard} href="/staff">
                        <span className={styles.linkCardTitle}>{t('settings.ownerStaff', 'Xodimlar')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerStaffHint', 'Menejer va qabulxona xodimlarini boshqarish')}</span>
                    </a>
                    <a className={styles.linkCard} href="/profile">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBilling', 'Hisob-kitob')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBillingHint', 'Tarif va to\u2018lovlar')}</span>
                    </a>
                    <a className={styles.linkCard} href="/brands">
                        <span className={styles.linkCardTitle}>{t('settings.ownerBrand', 'Brend sozlamalari')}</span>
                        <span className={styles.linkCardHint}>{t('settings.ownerBrandHint', 'Nomi, logotipi, umumiy sozlamalar')}</span>
                    </a>
                </div>
                <p className={styles.note}>
                    {t('settings.ownerNote', "Havolalar sizning marshrutlaringizga (routes) mos ravishda sozlanishi kerak.")}
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
            setStatus({ saving: false, error: err?.message || t('settings.pwGenericError', 'Xatolik yuz berdi.'), success: '' });
        }
    };

    return (
        <SectionCard
            title={t('settings.depositTitle', "Depozit va onlayn to'lov")}
            description={t('settings.depositDesc', "Bronlar uchun standart depozit va to'lov provayderi (Payme / Click). Har bir filial buni o'zicha almashtirishi mumkin.")}
            badge={t('settings.comingSoonBadge', 'Tez orada')}
        >
            {loading ? (
                <p className={styles.note}>{t('common.loading', 'Yuklanmoqda...')}</p>
            ) : (
                <form className={styles.formStack} onSubmit={handleSave}>
                    <Row
                        label={t('settings.depositEnabled', 'Depozit talab qilinsin')}
                        hint={t('settings.depositEnabledHint', "Yoqilsa, bron vaqtida mehmondan oldindan to'lov so'raladi.")}
                        control={<Toggle checked={form.enabled} onChange={(v) => update({ enabled: v })} />}
                    />

                    <Row
                        label={t('settings.depositType', 'Depozit turi')}
                        control={(
                            <select
                                className={styles.select}
                                value={form.depositType}
                                disabled={!form.enabled}
                                onChange={(e) => update({ depositType: e.target.value })}
                            >
                                {DEPOSIT_TYPES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        )}
                    />

                    <Row
                        label={form.depositType === 'percent'
                            ? t('settings.depositValuePercent', 'Depozit miqdori (%)')
                            : t('settings.depositValueFixed', 'Depozit miqdori (so\u2018m)')}
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
                        label={t('settings.paymentProvider', "To'lov provayderi")}
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
                        label={t('settings.paymentMerchantId', 'Merchant / Kassa ID')}
                        hint={t('settings.paymentMerchantIdHint', "Faqat ochiq (public) ID. Maxfiy kalitlar bu yerga kiritilmaydi — ular faqat serverda saqlanadi.")}
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
                        {status.saving ? t('common.saving', 'Saqlanmoqda...') : t('common.save', 'Saqlash')}
                    </button>
                </form>
            )}
        </SectionCard>
    );
}

function ManagerSettings({ t }) {
    return (
        <SectionCard
            title={t('settings.managerTitle', 'Filial sozlamalari')}
            description={t('settings.managerDesc', 'Sizga biriktirilgan filial bo\u2018yicha sozlamalar.')}
            badge={t('settings.comingSoonBadge', 'Tez orada')}
        >
            <Row
                label={t('settings.managerHours', 'Ish vaqti')}
                hint={t('settings.managerHoursHint', 'Filial ochilish/yopilish vaqtlari')}
                control={<span className={styles.staticValue}>—</span>}
            />
            <Row
                label={t('settings.managerAutoConfirm', 'Bronlarni avtomatik tasdiqlash')}
                control={<Toggle checked={false} disabled />}
            />
            <Row
                label={t('settings.managerTeam', 'Jamoa')}
                hint={t('settings.managerTeamHint', 'Qabulxona xodimlarini ko\u2018rish')}
                control={<span className={styles.staticValue}>—</span>}
            />
        </SectionCard>
    );
}

function ReceptionistSettings({ t }) {
    const [defaults, setDefaults] = useState({ guestCount: 2, durationHours: 2 });
    return (
        <SectionCard
            title={t('settings.receptionistTitle', 'Ish sozlamalari')}
            description={t('settings.receptionistDesc', 'Qo\u2018lda bron yaratishda ishlatiladigan standart qiymatlar.')}
            badge={t('settings.comingSoonBadge', 'Tez orada')}
        >
            <Row
                label={t('settings.receptionistGuests', 'Standart mehmonlar soni')}
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
                label={t('settings.receptionistDuration', 'Standart bron davomiyligi (soat)')}
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
                {t('settings.receptionistNote', "Bu qiymatlar hozircha faqat shu sahifada ko'rinadi, boshqa joyga ulanmagan.")}
            </p>
        </SectionCard>
    );
}