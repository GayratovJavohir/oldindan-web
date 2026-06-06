import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore, DAYS } from '../store/appStore';
import { api, getApiError } from '../services/api';

const TABS = ['General', 'Brand', 'Working Hours', 'Deposit & Fees', 'Notifications', 'Integrations'];

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 14, color: 'var(--text)' }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function ToggleRow({ label, description, value, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                {description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{description}</div>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!value)}
                style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: value ? 'var(--red)' : 'var(--bg3)',
                    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    flexShrink: 0,
                }}
            >
                <div style={{
                    position: 'absolute', top: 3,
                    left: value ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                }} />
            </button>
        </div>
    );
}

function slugify(name, maxLen = 50) {
    const s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = s || `brand-${Date.now()}`;
    return base.slice(0, maxLen).replace(/-+$/g, '') || `brand-${Date.now()}`;
}

/** Brand Management Tab — fully wired to the real API */
function BrandTab() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', description: '' });
    const [creating, setCreating] = useState(false);

    const fetchBrands = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const list = await api.getPartnerBrands();
            setBrands(list);
        } catch (e) {
            setError(getApiError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBrands(); }, [fetchBrands]);

    const flash = (msg) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(''), 2500);
    };

    const handleCreate = async () => {
        if (!createForm.name.trim()) return;
        setCreating(true);
        setError('');

        const name = createForm.name.trim();
        const description = createForm.description.trim() || `${name} brand`;

        // Try slug variants to handle uniqueness conflicts automatically
        let lastErr = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            let slug = slugify(name, 50);
            if (attempt > 0) {
                const entropy = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
                slug = `${slugify(name, 34)}-${entropy}`.slice(0, 50);
            }
            try {
                await api.createPartnerBrand({ name, slug, description, logo: null });
                await fetchBrands();
                setCreateForm({ name: '', description: '' });
                setShowCreate(false);
                flash('Brand created successfully!');
                setCreating(false);
                return;
            } catch (e) {
                lastErr = e;
                const msg = getApiError(e).toLowerCase();
                const isConflict = (msg.includes('slug') || msg.includes('name')) &&
                    (msg.includes('exist') || msg.includes('unique') || msg.includes('already'));
                if (!isConflict) break;
            }
        }
        setError(getApiError(lastErr));
        setCreating(false);
    };

    return (
        <div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Brand Management</div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>
                Manage your restaurant brands. A branch must belong to a brand.
            </div>

            {error && (
                <div style={{ background: 'var(--red-muted)', border: '1px solid rgba(232,25,44,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13.5, color: 'var(--red-light)', marginBottom: 16 }}>
                    ⚠ {error}
                </div>
            )}
            {success && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13.5, color: 'var(--green)', marginBottom: 16 }}>
                    ✓ {success}
                </div>
            )}

            <div className="card card-lg" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Your Brands</div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setShowCreate(true); setError(''); }}>
                        + New Brand
                    </button>
                </div>

                {loading ? (
                    <div style={{ color: 'var(--text3)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>Loading brands…</div>
                ) : brands.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>
                        No brands yet. Create one to start adding branches.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {brands.map((brand) => (
                            <div key={brand.id} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '12px 16px', background: 'var(--bg2)',
                                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: `hsl(${((brand.id || 1) * 73) % 360}, 55%, 38%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 18, color: 'white', fontWeight: 700, flexShrink: 0,
                                }}>
                                    {brand.name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{brand.name}</div>
                                    {brand.description && (
                                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {brand.description}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>slug: {brand.slug}</div>
                                </div>
                                <span className="badge badge-green">Active</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
                    <div className="modal">
                        <div className="modal-title">Create New Brand</div>
                        <div className="modal-sub">A brand groups your restaurant branches under one identity.</div>

                        <div className="form-group">
                            <label className="form-label">Brand Name *</label>
                            <input
                                className="form-input"
                                value={createForm.name}
                                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. My Restaurant Group"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <input
                                className="form-input"
                                value={createForm.description}
                                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional short description"
                            />
                        </div>

                        {error && (
                            <div style={{ background: 'var(--red-muted)', border: '1px solid rgba(232,25,44,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13.5, color: 'var(--red-light)', marginBottom: 16 }}>
                                ⚠ {error}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" disabled={creating} onClick={() => { setShowCreate(false); setError(''); }}>Cancel</button>
                            <button type="button" className="btn btn-primary" disabled={creating || !createForm.name.trim()} onClick={handleCreate}>
                                {creating ? 'Creating…' : 'Create Brand'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const [tab, setTab] = useState('General');
    const [savedFlash, setSavedFlash] = useState(false);
    const { t } = useTranslation();

    const settings = useAppStore(s => s.settings);
    const updateSettings = useAppStore(s => s.updateSettings);

    const save = () => {
        updateSettings({});
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1600);
    };

    const wh = settings.workingHours?.length
        ? settings.workingHours
        : DAYS.map((day, i) => ({ day, start: '10:00', end: i >= 5 ? '00:00' : '23:00', open: true }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('settings.title')}>
                {tab !== 'Brand' && (
                    <button type="button" className="btn btn-primary" onClick={save}>
                        {savedFlash ? '✓ Saved' : '💾 Save Changes'}
                    </button>
                )}
            </Topbar>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: 200, background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: 12 }}>
                    {TABS.map(t => (
                        <button
                            key={t}
                            type="button"
                            className={`nav-item ${tab === t ? 'active' : ''}`}
                            onClick={() => setTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto' }}>
                    <div className="page-body animate-in">
                        <div style={{ maxWidth: 640 }}>

                            {tab === 'General' && (
                                <>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>General Settings</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>Basic restaurant configuration</div>

                                    <div className="card card-lg" style={{ marginBottom: 20 }}>
                                        <Section title="Restaurant Details">
                                            <div className="form-group">
                                                <label className="form-label">Restaurant Name</label>
                                                <input className="form-input" value={settings.restaurantName} onChange={e => updateSettings({ general: { restaurantName: e.target.value } })} />
                                            </div>
                                            <div className="grid-2">
                                                <div className="form-group">
                                                    <label className="form-label">Contact Number</label>
                                                    <input className="form-input" value={settings.contactPhone} onChange={e => updateSettings({ general: { contactPhone: e.target.value } })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Contact Email</label>
                                                    <input className="form-input" type="email" value={settings.contactEmail} onChange={e => updateSettings({ general: { contactEmail: e.target.value } })} />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Currency</label>
                                                <select className="form-select" value={settings.currency} onChange={e => updateSettings({ general: { currency: e.target.value } })}>
                                                    <option value="USD">USD ($)</option>
                                                    <option value="UZS">UZS (so&apos;m)</option>
                                                    <option value="EUR">EUR (€)</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Timezone</label>
                                                <select className="form-select" value={settings.timezone} onChange={e => updateSettings({ general: { timezone: e.target.value } })}>
                                                    <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                                                    <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                                                </select>
                                            </div>
                                        </Section>
                                    </div>
                                </>
                            )}

                            {tab === 'Brand' && <BrandTab />}

                            {tab === 'Working Hours' && (
                                <>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Working Hours</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>Set opening and closing times</div>

                                    <div className="card card-lg">
                                        {wh.map((row, i) => (
                                            <div key={row.day} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < wh.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <div style={{ width: 100, fontSize: 14, fontWeight: 500 }}>{row.day}</div>
                                                <input type="time" className="form-input" value={row.start} style={{ width: 120 }}
                                                    onChange={e => {
                                                        const next = wh.map((r, j) => j === i ? { ...r, start: e.target.value } : r);
                                                        updateSettings({ workingHours: next });
                                                    }} />
                                                <span style={{ color: 'var(--text3)' }}>—</span>
                                                <input type="time" className="form-input" value={row.end} style={{ width: 120 }}
                                                    onChange={e => {
                                                        const next = wh.map((r, j) => j === i ? { ...r, end: e.target.value } : r);
                                                        updateSettings({ workingHours: next });
                                                    }} />
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginLeft: 'auto' }}>
                                                    <input type="checkbox" checked={row.open} style={{ accentColor: 'var(--red)' }}
                                                        onChange={e => {
                                                            const next = wh.map((r, j) => j === i ? { ...r, open: e.target.checked } : r);
                                                            updateSettings({ workingHours: next });
                                                        }} />
                                                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>Open</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {tab === 'Deposit & Fees' && (
                                <>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Deposit & Fees</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>Configure booking deposits and service charges</div>

                                    <div className="card card-lg">
                                        <ToggleRow label="Require Deposit" description="Guests must pay a deposit when booking" value={settings.deposit.requireDeposit} onChange={v => updateSettings({ deposit: { requireDeposit: v } })} />
                                        <div className="form-group" style={{ marginTop: 16 }}>
                                            <label className="form-label">Deposit Amount Per Person</label>
                                            <input className="form-input" type="number" value={settings.deposit.amountPerPerson} onChange={e => updateSettings({ deposit: { amountPerPerson: +e.target.value } })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Deposit Type</label>
                                            <select className="form-select" value={settings.deposit.depositType} onChange={e => updateSettings({ deposit: { depositType: e.target.value } })}>
                                                <option value="fixed">Fixed Amount</option>
                                                <option value="percent">Percentage of bill</option>
                                            </select>
                                        </div>

                                        <div className="divider" />

                                        <ToggleRow label="Service Fee" description="Add a service fee to all bookings" value={settings.deposit.serviceFee} onChange={v => updateSettings({ deposit: { serviceFee: v } })} />
                                        <div className="form-group" style={{ marginTop: 16 }}>
                                            <label className="form-label">Service Fee (%)</label>
                                            <input className="form-input" type="number" value={settings.deposit.serviceFeePercent} onChange={e => updateSettings({ deposit: { serviceFeePercent: +e.target.value } })} />
                                        </div>

                                        <div className="divider" />

                                        <ToggleRow label="Cancellation Policy" description="Allow guests to cancel without penalty within 24h" value={settings.deposit.cancellationPolicy} onChange={v => updateSettings({ deposit: { cancellationPolicy: v } })} />
                                        <div className="form-group" style={{ marginTop: 16 }}>
                                            <label className="form-label">Free Cancellation Window (hours)</label>
                                            <input className="form-input" type="number" value={settings.deposit.freeCancelHours} onChange={e => updateSettings({ deposit: { freeCancelHours: +e.target.value } })} />
                                        </div>
                                    </div>
                                </>
                            )}

                            {tab === 'Notifications' && (
                                <>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Notifications</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>Manage alerts and notification preferences</div>

                                    <div className="card card-lg">
                                        <ToggleRow label="New Booking Alert" description="Get notified when a new booking is made" value={settings.notificationPrefs.newBooking} onChange={v => updateSettings({ notificationPrefs: { newBooking: v } })} />
                                        <ToggleRow label="Cancellation Alert" description="Get notified when a booking is cancelled" value={settings.notificationPrefs.cancellation} onChange={v => updateSettings({ notificationPrefs: { cancellation: v } })} />
                                        <ToggleRow label="No-show Alert" description="Get notified when a guest doesn't arrive" value={settings.notificationPrefs.noShow} onChange={v => updateSettings({ notificationPrefs: { noShow: v } })} />
                                        <ToggleRow label="Email Notifications" description="Receive booking summaries via email" value={settings.notificationPrefs.email} onChange={v => updateSettings({ notificationPrefs: { email: v } })} />
                                        <ToggleRow label="SMS Notifications" description="Receive SMS alerts for critical events" value={settings.notificationPrefs.sms} onChange={v => updateSettings({ notificationPrefs: { sms: v } })} />
                                        <ToggleRow label="Daily Summary" description="Receive an end-of-day report" value={settings.notificationPrefs.dailySummary} onChange={v => updateSettings({ notificationPrefs: { dailySummary: v } })} />
                                    </div>
                                </>
                            )}

                            {tab === 'Integrations' && (
                                <>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Integrations</div>
                                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>Connect third-party services</div>

                                    <div className="card card-lg">
                                        {[
                                            { key: 'telegram', name: 'Telegram Bot', desc: 'Get booking alerts via Telegram', icon: '✈' },
                                            { key: 'whatsapp', name: 'WhatsApp Business', desc: 'Send confirmations via WhatsApp', icon: '💬' },
                                            { key: 'gcal', name: 'Google Calendar', desc: 'Sync bookings to Google Calendar', icon: '📅' },
                                            { key: 'payment', name: 'Payment Gateway', desc: 'Accept online deposits', icon: '💳' },
                                        ].map((s, i, arr) => (
                                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                                    {s.icon}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.desc}</div>
                                                </div>
                                                <span className={settings.integrations[s.key] ? 'badge badge-green' : 'badge badge-gray'}>
                                                    {settings.integrations[s.key] ? '● Connected' : '○ Not Connected'}
                                                </span>
                                                <button type="button" className={`btn btn-sm ${settings.integrations[s.key] ? 'btn-danger' : 'btn-secondary'}`}
                                                    onClick={() => updateSettings({ integrations: { [s.key]: !settings.integrations[s.key] } })}>
                                                    {settings.integrations[s.key] ? 'Disconnect' : 'Connect'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}