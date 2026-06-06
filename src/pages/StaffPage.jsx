import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore } from '../store/appStore';

/* ═══════════════════════════════════════════════════════════════
   URL konstantalari
═══════════════════════════════════════════════════════════════ */
const ROLE_ENDPOINTS = {
    owner: '/api/accounts/partner/create-owner/',
    manager: '/api/accounts/partner/create-manager/',
    receptionist: '/api/accounts/partner/create-receptionist/',
};

const BRANCH_STAFF_LIST_URL = '/api/staff/partner/staff/';
const BRANCH_STAFF_CREATE_URL = '/api/staff/partner/staff/create/';
const BRANCH_STAFF_DETAIL_URL = (pk) => `/api/staff/partner/staff/${pk}/`;

const FORM_ROLES = [
    { value: 'owner', label: '👑 Owner' },
    { value: 'manager', label: '⚙️ Manager' },
    { value: 'receptionist', label: '🎧 Receptionist' },
];

const ROLE_BADGE = {
    owner: <span className="badge" style={{ background: 'rgba(232,25,44,0.12)', color: 'var(--red-light)' }}>👑 Owner</span>,
    manager: <span className="badge badge-blue">⚙️ Manager</span>,
    receptionist: <span className="badge badge-green">🎧 Reception</span>,
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('uz-UZ') : '—';

/* ═══════════════════════════════════════════════════════════════
   API
═══════════════════════════════════════════════════════════════ */
async function apiCreateUser(role, payload, token) {
    const res = await fetch(ROLE_ENDPOINTS[role], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data?.detail || 'Server xatosi'); e.fieldErrors = data; throw e; }
    return data;
}

async function apiCreateBranchStaff(payload, token) {
    const res = await fetch(BRANCH_STAFF_CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data?.detail || 'Xatolik'); e.fieldErrors = data; throw e; }
    return data;
}

async function apiFetchBranchStaff(token) {
    const res = await fetch(BRANCH_STAFF_LIST_URL, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Staff ro'yxati yuklanmadi");
    const data = await res.json();
    return Array.isArray(data) ? data : (data.results || []);
}

async function apiUpdateBranchStaff(pk, payload, token) {
    const res = await fetch(BRANCH_STAFF_DETAIL_URL(pk), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data?.detail || 'Yangilashda xatolik'); e.fieldErrors = data; throw e; }
    return data;
}

/* ═══════════════════════════════════════════════════════════════
   Kichik komponentlar
═══════════════════════════════════════════════════════════════ */
function Field({ label, error, children }) {
    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            {children}
            {error && (
                <span style={{ fontSize: 11.5, color: 'var(--red, #e8192c)', marginTop: 3, display: 'block' }}>
                    {Array.isArray(error) ? error[0] : error}
                </span>
            )}
        </div>
    );
}

function StatusToggle({ label = 'Status', value, onChange }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label className="form-label">{label}</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {[{ val: true, label: '● Active' }, { val: false, label: '○ Inactive' }].map(opt => (
                    <label key={String(opt.val)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius)',
                        border: `1.5px solid ${value === opt.val ? 'var(--blue,#2d6adf)' : 'var(--border)'}`,
                        background: value === opt.val ? 'rgba(45,106,223,0.08)' : 'transparent',
                        cursor: 'pointer', fontSize: 13,
                        color: value === opt.val ? 'var(--blue,#2d6adf)' : 'var(--text2)',
                        transition: 'all .15s', userSelect: 'none',
                    }}>
                        <input type="radio" style={{ display: 'none' }} checked={value === opt.val} onChange={() => onChange(opt.val)} />
                        {opt.label}
                    </label>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════ */
function StepIndicator({ step }) {
    const steps = ['User yaratish', 'Branchga biriktirish'];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
            {steps.map((label, i) => {
                const idx = i + 1;
                const done = step > idx;
                const active = step === idx;
                const color = done ? 'var(--green, #22c55e)' : active ? 'var(--blue, #2d6adf)' : 'var(--border)';
                const textCol = done || active ? '#fff' : 'var(--text3)';
                return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: color, color: textCol,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 13, transition: 'all .2s',
                                border: `2px solid ${color}`,
                            }}>
                                {done ? '✓' : idx}
                            </div>
                            <span style={{ fontSize: 11, color: active ? 'var(--blue,#2d6adf)' : 'var(--text3)', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, margin: '-14px 8px 0',
                                background: done ? 'var(--green, #22c55e)' : 'var(--border)',
                                transition: 'background .3s',
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   2 QADAM LI MODAL
   Qadam 1: User yaratish
   Qadam 2: Yaratilgan user auto-tanlanadi, branch + rol tanlanadi
═══════════════════════════════════════════════════════════════ */
function AddStaffModal({ branches, token, onClose, onDone }) {
    const [step, setStep] = useState(1);

    /* ── Qadam 1 holati ── */
    const [userForm, setUserForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_repeat: '',
        role: 'manager',
        is_active: true,
    });
    const [userErrors, setUserErrors] = useState({});
    const [userBusy, setUserBusy] = useState(false);

    /* Qadam 1 tugaganda saqlangan user */
    const [createdUser, setCreatedUser] = useState(null);

    /* ── Qadam 2 holati ── */
    const [assignForm, setAssignForm] = useState({
        branch: branches[0]?.id || '',
        role: 'manager',
        is_active: true,
    });
    const [assignErrors, setAssignErrors] = useState({});
    const [assignBusy, setAssignBusy] = useState(false);

    /* ─── Setterlar ─── */
    const setU = (key, val) => {
        setUserForm(f => ({ ...f, [key]: val }));
        setUserErrors(e => ({ ...e, [key]: undefined }));
    };
    const setA = (key, val) => {
        setAssignForm(f => ({ ...f, [key]: val }));
        setAssignErrors(e => ({ ...e, [key]: undefined }));
    };

    /* ─── Validatsiya (qadam 1) ─── */
    const validateUser = () => {
        const errs = {};
        if (!userForm.first_name.trim()) errs.first_name = 'Ism kiritilishi shart';
        if (!userForm.last_name.trim()) errs.last_name = 'Familiya kiritilishi shart';
        if (!userForm.email.trim()) errs.email = 'Email kiritilishi shart';
        if (!userForm.password) errs.password = 'Parol kiritilishi shart';
        else if (userForm.password.length < 6) errs.password = 'Parol kamida 6 ta belgi';
        if (userForm.password !== userForm.password_repeat)
            errs.password_repeat = 'Parollar mos emas';
        return errs;
    };

    /* ─── Qadam 1: User yaratish → Keyingisi ─── */
    const handleCreateUser = async () => {
        const errs = validateUser();
        if (Object.keys(errs).length) { setUserErrors(errs); return; }
        setUserBusy(true);
        try {
            const user = await apiCreateUser(userForm.role, {
                first_name: userForm.first_name.trim(),
                last_name: userForm.last_name.trim(),
                email: userForm.email.trim(),
                phone: userForm.phone.trim() || null,
                password: userForm.password,
                is_active: userForm.is_active,
            }, token);
            setCreatedUser(user);
            /* Rol'ni user bilan sinxron qilamiz */
            setAssignForm(f => ({ ...f, role: user.role || userForm.role }));
            setStep(2);
        } catch (e) {
            if (e.fieldErrors && typeof e.fieldErrors === 'object') setUserErrors(e.fieldErrors);
            else alert(e.message || 'Xatolik');
        } finally { setUserBusy(false); }
    };

    /* ─── Qadam 2: Branchga biriktirish ─── */
    const handleAssign = async () => {
        if (!assignForm.branch) { setAssignErrors({ branch: 'Branch tanlanishi shart' }); return; }
        setAssignBusy(true);
        try {
            const record = await apiCreateBranchStaff({
                user: createdUser.id,
                branch: Number(assignForm.branch),
                role: assignForm.role,
                is_active: assignForm.is_active,
            }, token);
            onDone(record, createdUser);
            onClose();
        } catch (e) {
            if (e.fieldErrors && typeof e.fieldErrors === 'object') setAssignErrors(e.fieldErrors);
            else alert(e.message || 'Xatolik');
        } finally { setAssignBusy(false); }
    };

    const busy = userBusy || assignBusy;

    /* ─── Yaratilgan user kartochkasi (qadam 2 da) ─── */
    const UserCard = () => {
        if (!createdUser) return null;
        const fname = createdUser.first_name || '';
        const lname = createdUser.last_name || '';
        const initials = ((fname[0] || '') + (lname[0] || '')).toUpperCase() || '?';
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', marginBottom: 20,
                background: 'rgba(45,106,223,0.06)',
                border: '1.5px solid var(--blue, #2d6adf)',
                borderRadius: 'var(--radius)',
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `hsl(${(createdUser.id || 1) * 71 % 360}, 55%, 40%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {`${fname} ${lname}`.trim() || 'Nomsiz'}
                        <span style={{ marginLeft: 8 }}>
                            {ROLE_BADGE[createdUser.role] ?? null}
                        </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {createdUser.email}
                        {createdUser.phone ? ` · ${createdUser.phone}` : ''}
                    </div>
                </div>
                <span style={{
                    fontSize: 11, color: 'var(--blue, #2d6adf)',
                    background: 'rgba(45,106,223,0.1)',
                    padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                }}>
                    ✓ Yaratildi
                </span>
            </div>
        );
    };

    return (
        <div
            className="modal-overlay"
            onClick={e => e.target === e.currentTarget && !busy && onClose()}
        >
            <div className="modal" style={{ maxWidth: 520, width: '100%' }}>

                {/* Sarlavha */}
                <div className="modal-title">
                    {step === 1 ? 'Yangi xodim qo\'shish' : 'Branchga biriktirish'}
                </div>

                {/* Step indicator */}
                <StepIndicator step={step} />

                {/* ══ QADAM 1: User ma'lumotlari ══ */}
                {step === 1 && (
                    <>
                        <div className="grid-2">
                            <Field label="Ism *" error={userErrors.first_name}>
                                <input
                                    className={`form-input${userErrors.first_name ? ' is-invalid' : ''}`}
                                    value={userForm.first_name}
                                    onChange={e => setU('first_name', e.target.value)}
                                    placeholder="Ism"
                                    disabled={userBusy}
                                />
                            </Field>
                            <Field label="Familiya *" error={userErrors.last_name}>
                                <input
                                    className={`form-input${userErrors.last_name ? ' is-invalid' : ''}`}
                                    value={userForm.last_name}
                                    onChange={e => setU('last_name', e.target.value)}
                                    placeholder="Familiya"
                                    disabled={userBusy}
                                />
                            </Field>
                        </div>

                        <div className="grid-2">
                            <Field label="Email *" error={userErrors.email}>
                                <input
                                    className={`form-input${userErrors.email ? ' is-invalid' : ''}`}
                                    type="email"
                                    value={userForm.email}
                                    onChange={e => setU('email', e.target.value)}
                                    placeholder="example@mail.com"
                                    disabled={userBusy}
                                />
                            </Field>
                            <Field label="Telefon" error={userErrors.phone}>
                                <input
                                    className="form-input"
                                    type="tel"
                                    value={userForm.phone}
                                    onChange={e => setU('phone', e.target.value)}
                                    placeholder="+998901234567"
                                    disabled={userBusy}
                                />
                            </Field>
                        </div>

                        <div className="grid-2">
                            <Field label="Parol *" error={userErrors.password}>
                                <input
                                    className={`form-input${userErrors.password ? ' is-invalid' : ''}`}
                                    type="password"
                                    value={userForm.password}
                                    onChange={e => setU('password', e.target.value)}
                                    placeholder="Kamida 6 ta belgi"
                                    disabled={userBusy}
                                />
                            </Field>
                            <Field label="Parolni tasdiqlang *" error={userErrors.password_repeat}>
                                <input
                                    className={`form-input${userErrors.password_repeat ? ' is-invalid' : ''}`}
                                    type="password"
                                    value={userForm.password_repeat}
                                    onChange={e => setU('password_repeat', e.target.value)}
                                    placeholder="Qayta kiriting"
                                    disabled={userBusy}
                                />
                            </Field>
                        </div>

                        <Field label="Rol" error={userErrors.role}>
                            <select
                                className="form-select"
                                value={userForm.role}
                                onChange={e => setU('role', e.target.value)}
                                disabled={userBusy}
                            >
                                {FORM_ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </Field>

                        <StatusToggle
                            label="Holat (is_active)"
                            value={userForm.is_active}
                            onChange={v => setU('is_active', v)}
                        />

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={userBusy}
                                onClick={onClose}
                            >
                                Bekor qilish
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={userBusy}
                                onClick={handleCreateUser}
                            >
                                {userBusy ? 'Yaratilmoqda…' : 'Keyingisi →'}
                            </button>
                        </div>
                    </>
                )}

                {/* ══ QADAM 2: Branch + Rol ══ */}
                {step === 2 && (
                    <>
                        {/* Auto-tanlangan user (o'zgartirib bo'lmaydi) */}
                        <div style={{ marginBottom: 6 }}>
                            <label className="form-label">Xodim (avtomatik tanlangan)</label>
                        </div>
                        <UserCard />

                        <div className="grid-2">
                            <Field label="Branch *" error={assignErrors.branch}>
                                <select
                                    className={`form-select${assignErrors.branch ? ' is-invalid' : ''}`}
                                    value={assignForm.branch}
                                    onChange={e => setA('branch', e.target.value)}
                                    disabled={assignBusy}
                                >
                                    <option value="">— Branch tanlang —</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Rol" error={assignErrors.role}>
                                <select
                                    className="form-select"
                                    value={assignForm.role}
                                    onChange={e => setA('role', e.target.value)}
                                    disabled={assignBusy}
                                >
                                    {FORM_ROLES.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>

                        <StatusToggle
                            label="Holat (is_active)"
                            value={assignForm.is_active}
                            onChange={v => setA('is_active', v)}
                        />

                        <div className="modal-footer">
                            {/* Orqaga — faqat bekor qilish, user allaqachon yaratildi */}
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={assignBusy}
                                onClick={onClose}
                            >
                                Yopish
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={assignBusy}
                                onClick={handleAssign}
                            >
                                {assignBusy ? 'Saqlanmoqda…' : '✓ Branchga biriktirish'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   TAHRIRLASH MODALI  (BranchStaff — faqat role + is_active)
   PATCH /api/staff/partner/staff/<pk>/
═══════════════════════════════════════════════════════════════ */
function EditBranchStaffModal({ record, token, onClose, onSaved }) {
    const [form, setForm] = useState({
        role: record.role || 'manager',
        is_active: record.is_active ?? true,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setBusy(true); setError('');
        try {
            const updated = await apiUpdateBranchStaff(record.id, form, token);
            onSaved({ ...record, role: updated.role ?? form.role, is_active: updated.is_active ?? form.is_active });
            onClose();
        } catch (e) { setError(e.message || 'Xatolik'); }
        finally { setBusy(false); }
    };

    const fname = record.user?.first_name || '';
    const lname = record.user?.last_name || '';
    const fullName = `${fname} ${lname}`.trim() || 'Nomsiz';

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
            <div className="modal" style={{ maxWidth: 400, width: '100%' }}>
                <div className="modal-title">Staff tahrirlash</div>
                <div className="modal-sub">
                    {fullName} · <em>{record.branch?.name || '—'}</em>
                </div>

                {error && (
                    <div style={{
                        color: 'var(--red)', fontSize: 13, marginBottom: 12,
                        padding: '8px 12px', background: 'rgba(232,25,44,0.08)',
                        borderRadius: 'var(--radius)',
                    }}>
                        {error}
                    </div>
                )}

                <Field label="Rol">
                    <select
                        className="form-select"
                        value={form.role}
                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                        disabled={busy}
                    >
                        {FORM_ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </Field>

                <StatusToggle
                    label="Holat (is_active)"
                    value={form.is_active}
                    onChange={v => setForm(f => ({ ...f, is_active: v }))}
                />

                <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
                        Bekor qilish
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
                        {busy ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function StaffPage() {
    const { t } = useTranslation();
    const token = localStorage.getItem('rp_access');
    const branches = useAppStore(s => s.branches);

    /* BranchStaff ro'yxati */
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    /* Modal holatlari */
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);

    /* Filtrlar */
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');

    /* ── Ma'lumot yuklash ── */
    const load = async () => {
        setLoading(true); setFetchError('');
        try {
            setRecords(await apiFetchBranchStaff(token));
        } catch (e) { setFetchError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (token) load(); }, []); // eslint-disable-line

    /* ── Branch ro'yxati (backenddan) ── */
    const branchList = useMemo(() => {
        const seen = new Map();
        records.forEach(r => {
            if (r.branch?.id && !seen.has(r.branch.id)) seen.set(r.branch.id, r.branch);
        });
        return [...seen.values()];
    }, [records]);

    /* ── Filtr ── */
    const filtered = useMemo(() => records.filter(r => {
        if (roleFilter !== 'all' && r.role !== roleFilter) return false;
        if (branchFilter !== 'all' && String(r.branch?.id) !== branchFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                ((r.user?.first_name || '') + ' ' + (r.user?.last_name || '')).toLowerCase().includes(q) ||
                (r.user?.email || '').toLowerCase().includes(q) ||
                (r.user?.phone || '').toLowerCase().includes(q)
            );
        }
        return true;
    }), [records, roleFilter, branchFilter, search]);

    /* ── Statistika ── */
    const counts = useMemo(() => ({
        total: records.length,
        active: records.filter(r => r.is_active).length,
        branches: branchList.length,
    }), [records, branchList]);

    /* ── Handlers ── */
    const handleToggleActive = async (r) => {
        try {
            await apiUpdateBranchStaff(r.id, { is_active: !r.is_active }, token);
            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
        } catch (e) { alert(e.message); }
    };

    /* AddStaffModal tugaganda yangi record qo'shamiz */
    const handleDone = (branchStaffRecord) => {
        setRecords(prev => [branchStaffRecord, ...prev]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar
                title={t('staff.title')}
                subtitle={`${counts.active} faol xodim`}
            >
                {/* Topbar ichida toolbar */}
                <div className="search-box" style={{ minWidth: 200 }}>
                    <input
                        placeholder="Ism, email yoki telefon..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="form-select"
                    style={{ width: 160 }}
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                >
                    <option value="all">Barcha rollar</option>
                    {['owner', 'manager', 'receptionist'].map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                </select>
                <select
                    className="form-select"
                    style={{ width: 190 }}
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                >
                    <option value="all">Barcha branchlar</option>
                    {branchList.map(b => (
                        <option key={b.id} value={String(b.id)}>
                            {b.brand_name ? `${b.brand_name} — ` : ''}{b.name}
                        </option>
                    ))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={load} title="Yangilash">
                    ↻
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAdd(true)}
                >
                    + Xodim qo'shish
                </button>
            </Topbar>

            <div className="page-body animate-in">

                {/* ── Statistika ── */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Jami xodim', value: counts.total, icon: '👥', color: 'var(--blue)' },
                        { label: 'Faol', value: counts.active, icon: '✓', color: 'var(--green)' },
                        { label: 'Branchlar', value: counts.branches, icon: '🏪', color: 'var(--yellow)' },
                    ].map(s => (
                        <div key={s.label} style={{
                            flex: 1, minWidth: 120,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 10,
                                background: `${s.color}1a`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                            }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Xato ── */}
                {fetchError && (
                    <div style={{
                        color: 'var(--red)', padding: '10px 14px', marginBottom: 14,
                        background: 'rgba(232,25,44,0.08)', borderRadius: 'var(--radius)', fontSize: 13,
                    }}>
                        ⚠ {fetchError}
                    </div>
                )}

                {/* ── Jadval ── */}
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Xodim</th>
                                    <th>Rol</th>
                                    <th>Branch</th>
                                    <th>Brand</th>
                                    <th>Status</th>
                                    <th>Biriktirilgan</th>
                                    <th>Amallar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 52, color: 'var(--text3)' }}>
                                            Yuklanmoqda…
                                        </td>
                                    </tr>
                                )}
                                {!loading && filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 52, color: 'var(--text3)', fontSize: 14 }}>
                                            {records.length === 0
                                                ? 'Hali xodimlar qo\'shilmagan'
                                                : 'Qidiruv bo\'yicha xodim topilmadi'}
                                        </td>
                                    </tr>
                                )}
                                {!loading && filtered.map(r => {
                                    const fname = r.user?.first_name || '';
                                    const lname = r.user?.last_name || '';
                                    const fullName = `${fname} ${lname}`.trim() || 'Nomsiz';
                                    const initials = ((fname[0] || '') + (lname[0] || '')).toUpperCase() || '?';
                                    const contact = r.user?.phone
                                        ? `${r.user.phone}${r.user.email ? ' · ' + r.user.email : ''}`
                                        : (r.user?.email || '—');

                                    return (
                                        <tr key={r.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: '50%',
                                                        background: `hsl(${(r.id || 1) * 71 % 360}, 55%, 40%)`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                                                    }}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{fullName}</div>
                                                        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{contact}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {ROLE_BADGE[r.role] ?? (
                                                    <span className="badge badge-gray">{r.role}</span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: 13.5, color: 'var(--text2)' }}>
                                                {r.branch?.name || '—'}
                                            </td>
                                            <td style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                                                {r.branch?.brand_name || '—'}
                                            </td>
                                            <td>
                                                <span className={r.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                                                    {r.is_active ? '● Faol' : '○ Nofaol'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                                                {formatDate(r.created_at)}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setEditing(r)}
                                                    >
                                                        ✎ Tahrir
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleToggleActive(r)}
                                                    >
                                                        {r.is_active ? 'Nofaol' : 'Faollashtir'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── 2 qadamli modal ── */}
            {showAdd && (
                <AddStaffModal
                    branches={branches}
                    token={token}
                    onClose={() => setShowAdd(false)}
                    onDone={handleDone}
                />
            )}

            {/* ── Tahrirlash modali ── */}
            {editing && (
                <EditBranchStaffModal
                    record={editing}
                    token={token}
                    onClose={() => setEditing(null)}
                    onSaved={(updated) => {
                        setRecords(prev => prev.map(x => x.id === updated.id ? updated : x));
                        setEditing(null);
                    }}
                />
            )}
        </div>
    );
}