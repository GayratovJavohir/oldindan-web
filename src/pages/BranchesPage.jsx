import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore } from '../store/appStore';
import { api, getApiError } from '../services/api';
import { loadPartnerWorkspace } from '../services/partnerSync';
import { mapBranchFromApi } from '../services/mappers';
import { useAuth } from '../features/auth/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(name, maxLen = 50) {
    const s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = s || `item-${Date.now()}`;
    return base.slice(0, maxLen).replace(/-+$/g, '') || `item-${Date.now()}`;
}

function slugCandidate(base, attempt, maxLen = 50) {
    if (attempt === 0) return slugify(base, maxLen);
    const entropy = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const suffix = `-${attempt + 1}-${entropy}`.slice(0, 18);
    const headLen = Math.max(1, maxLen - suffix.length);
    return `${slugify(base, headLen)}${suffix}`;
}

function isSlugConflictError(err) {
    const msg = getApiError(err).toLowerCase();
    return msg.includes('slug') && (msg.includes('exist') || msg.includes('unique') || msg.includes('already'));
}

async function createBranchWithUniqueSlug(payload) {
    const baseSlug = payload.name;
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = slugCandidate(baseSlug, attempt, 50);
        try {
            return await api.createPartnerBranch({ ...payload, slug: candidate });
        } catch (err) {
            lastErr = err;
            if (!isSlugConflictError(err)) throw err;
        }
    }
    throw lastErr || new Error('Branch slug conflict');
}

async function createBrandWithUniqueSlug(name) {
    const cleanName = name.trim();
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = slugCandidate(cleanName, attempt, 50);
        const candidateName = attempt === 0
            ? cleanName
            : `${cleanName} ${Date.now().toString(36).slice(-4)}-${attempt + 1}`;
        try {
            return await api.createPartnerBrand({
                name: candidateName,
                slug: candidate,
                description: `${candidateName} brand`,
                logo: null,
            });
        } catch (err) {
            lastErr = err;
            const msg = getApiError(err).toLowerCase();
            const nameConflict = msg.includes('name') && (msg.includes('exist') || msg.includes('unique') || msg.includes('already'));
            if (!isSlugConflictError(err) && !nameConflict) throw err;
        }
    }
    throw lastErr || new Error('Brand conflict');
}

// ─── Leaflet loader util ─────────────────────────────────────────────────────

function loadLeaflet(onReady) {
    if (window.L) { onReady(window.L); return; }

    if (!document.querySelector('#leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }

    if (document.querySelector('#leaflet-js')) {
        // already loading — poll
        const t = setInterval(() => { if (window.L) { clearInterval(t); onReady(window.L); } }, 80);
        return () => clearInterval(t);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => onReady(window.L);
    document.head.appendChild(script);
}

async function reverseGeocode(lat, lng) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`,
            { headers: { 'User-Agent': 'RestaurantPOS/1.0' } }
        );
        const data = await res.json();
        return data.display_name || '';
    } catch {
        return '';
    }
}

// ─── MapPicker ───────────────────────────────────────────────────────────────
// Shows an interactive OpenStreetMap. Click or drag marker to pick a location.
// onPick({ lat, lng, address }) is called whenever location changes.

function MapPicker({ initialLat, initialLng, onPick }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onPickRef = useRef(onPick);
    onPickRef.current = onPick;

    const [geocoding, setGeocoding] = useState(false);
    const [hint, setHint] = useState(
        initialLat ? 'Drag the pin or click to move it' : 'Click on the map to set location'
    );

    const handlePick = useCallback(async (lat, lng) => {
        setGeocoding(true);
        setHint('Getting address…');
        const address = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setHint('Drag the pin or click to change location');
        onPickRef.current({ lat, lng, address });
    }, []);

    useEffect(() => {
        let cleanup;

        const init = (L) => {
            if (!containerRef.current || mapRef.current) return;

            const center = (initialLat && initialLng)
                ? [initialLat, initialLng]
                : [41.2995, 69.2401]; // Tashkent default
            const zoom = (initialLat && initialLng) ? 15 : 12;

            const map = L.map(containerRef.current).setView(center, zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);
            mapRef.current = map;

            const addMarker = (latLng) => {
                if (markerRef.current) {
                    markerRef.current.setLatLng(latLng);
                } else {
                    const m = L.marker(latLng, { draggable: true }).addTo(map);
                    m.on('dragend', (e) => {
                        const p = e.target.getLatLng();
                        handlePick(p.lat, p.lng);
                    });
                    markerRef.current = m;
                }
            };

            if (initialLat && initialLng) {
                addMarker([initialLat, initialLng]);
            }

            map.on('click', (e) => {
                addMarker(e.latlng);
                handlePick(e.latlng.lat, e.latlng.lng);
            });
        };

        cleanup = loadLeaflet(init);

        return () => {
            cleanup?.();
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                📍 Location on Map
                {geocoding && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                        · Getting address…
                    </span>
                )}
            </label>
            <div
                ref={containerRef}
                style={{
                    height: 280,
                    borderRadius: 8,
                    border: '1.5px solid var(--border)',
                    overflow: 'hidden',
                    cursor: 'crosshair',
                    position: 'relative',
                }}
            />
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5 }}>
                🗺 {hint}
            </div>
        </div>
    );
}

// ─── BranchModal ─────────────────────────────────────────────────────────────

function BranchModal({ onClose, branch = null, onSave, onDeactivate, setPageError }) {
    const settings = useAppStore(s => s.settings);

    const [form, setForm] = useState({
        name: branch?.name || '',
        address: branch?.address || '',
        status: branch?.status || 'active',
        brandId: branch?.brandId ?? '',
        lat: branch?.lat ?? branch?.latitude ?? null,
        lng: branch?.lng ?? branch?.longitude ?? null,
    });
    const [busy, setBusy] = useState(false);

    // Brand list for the create flow
    const [brands, setBrands] = useState([]);
    const [brandsLoading, setBrandsLoading] = useState(!branch);
    const [brandsError, setBrandsError] = useState('');
    const [showNewBrand, setShowNewBrand] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [creatingBrand, setCreatingBrand] = useState(false);

    const fetchBrands = useCallback(async () => {
        setBrandsLoading(true);
        setBrandsError('');
        try {
            const list = await api.getPartnerBrands();
            setBrands(list);
            if (list.length && !form.brandId) {
                setForm(f => ({ ...f, brandId: list[0].id }));
            }
        } catch (e) {
            setBrandsError(getApiError(e));
        } finally {
            setBrandsLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!branch) fetchBrands();
    }, [branch, fetchBrands]);

    const handleCreateBrand = async () => {
        if (!newBrandName.trim()) return;
        setCreatingBrand(true);
        setBrandsError('');
        try {
            const created = await createBrandWithUniqueSlug(
                newBrandName.trim() || settings?.restaurantName?.trim() || 'Main Brand'
            );
            await fetchBrands();
            setForm(f => ({ ...f, brandId: created.id }));
            setNewBrandName('');
            setShowNewBrand(false);
        } catch (e) {
            setBrandsError(getApiError(e));
        } finally {
            setCreatingBrand(false);
        }
    };

    const handleMapPick = useCallback(({ lat, lng, address }) => {
        setForm(f => ({
            ...f,
            lat,
            lng,
            // Only auto-fill address if it's empty or was previously map-filled
            address: address || f.address,
        }));
    }, []);

    const submit = async () => {
        if (!form.name.trim() || !form.address.trim()) return;
        if (!branch && !form.brandId) {
            setBrandsError('Please select or create a brand first.');
            return;
        }
        setBusy(true);
        setPageError('');
        try {
            await onSave(form);
            onClose();
        } catch {
            // errors surfaced via setPageError inside onSave
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto', width: 560 }}>
                <div className="modal-title">{branch ? 'Edit Branch' : 'Add New Branch'}</div>
                <div className="modal-sub">{branch ? 'Update branch information' : 'Create a new restaurant branch'}</div>

                {/* Brand selector — only shown when creating */}
                {!branch && (
                    <div className="form-group">
                        <label className="form-label">Brand *</label>
                        {brandsLoading ? (
                            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading brands…</div>
                        ) : (
                            <>
                                {brands.length > 0 && (
                                    <select
                                        className="form-select"
                                        value={form.brandId}
                                        onChange={e => setForm(f => ({ ...f, brandId: Number(e.target.value) || e.target.value }))}
                                    >
                                        {brands.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                )}

                                {!showNewBrand ? (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{ marginTop: 8 }}
                                        onClick={() => setShowNewBrand(true)}
                                    >
                                        + Create new brand
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <input
                                            className="form-input"
                                            placeholder="Brand name"
                                            value={newBrandName}
                                            autoFocus
                                            onChange={e => setNewBrandName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateBrand()}
                                            style={{ flex: 1 }}
                                        />
                                        <button type="button" className="btn btn-secondary btn-sm" disabled={creatingBrand || !newBrandName.trim()} onClick={handleCreateBrand}>
                                            {creatingBrand ? '…' : 'Create'}
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowNewBrand(false); setNewBrandName(''); }}>✕</button>
                                    </div>
                                )}

                                {brandsError && (
                                    <div style={{ fontSize: 12.5, color: 'var(--red-light)', marginTop: 6 }}>⚠ {brandsError}</div>
                                )}

                                {brands.length === 0 && !showNewBrand && (
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 6 }}>
                                        No brands found. Create one above, or go to Settings → Brand to manage brands.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Branch Name *</label>
                    <input
                        className="form-input"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Main Street Restaurant"
                    />
                </div>

                {/* Map picker — click to set coordinates, auto-fills address */}
                <MapPicker
                    initialLat={form.lat}
                    initialLng={form.lng}
                    onPick={handleMapPick}
                />

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Address *</span>
                        {form.lat && form.lng && (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 400 }}>
                                ✓ {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                            </span>
                        )}
                    </label>
                    <input
                        className="form-input"
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        placeholder="Auto-filled from map, or type manually"
                    />
                    {!form.lat && (
                        <div style={{ fontSize: 11.5, color: 'var(--yellow)', marginTop: 4 }}>
                            ⚠ No map location set. Pick a point on the map above for precise coordinates.
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    <div>
                        {branch && (
                            <button type="button" className="btn btn-danger" disabled={busy} onClick={async () => {
                                if (!confirm('Deactivate this branch on the server?')) return;
                                setBusy(true);
                                try {
                                    await onDeactivate(branch.id);
                                    onClose();
                                } finally {
                                    setBusy(false);
                                }
                            }}>
                                Deactivate
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || (!branch && (!form.brandId || brandsLoading))}
                            onClick={submit}
                        >
                            {busy ? 'Saving…' : (branch ? 'Save Changes' : 'Create Branch')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── BranchCard ──────────────────────────────────────────────────────────────

function BranchCard({ branch, onEdit, onOpen, onSchema }) {
    return (
        <div
            className="card"
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={onOpen}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
            <div style={{
                height: 120,
                background: 'var(--bg3)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                marginBottom: 16,
                border: '1px solid var(--border)',
            }}>🏢</div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 3 }}>{branch.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>📍 {branch.address}</div>
                    {(branch.lat || branch.latitude) && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                            🗺 {(branch.lat ?? branch.latitude)?.toFixed(4)}, {(branch.lng ?? branch.longitude)?.toFixed(4)}
                        </div>
                    )}
                </div>
                <span className={branch.status === 'active' ? 'badge badge-green' : 'badge badge-gray'}>
                    {branch.status}
                </span>
            </div>

            <div className="divider" style={{ margin: '12px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                    { label: 'Tables', value: branch.tables },
                    { label: 'Capacity', value: branch.capacity },
                    { label: "Today's", value: branch.todayBookings },
                ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={e => { e.stopPropagation(); onEdit(branch); }}
                >
                    ✎ Edit
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={e => { e.stopPropagation(); onSchema(); }}
                >
                    ⬡ Schema
                </button>
            </div>
        </div>
    );
}

// ─── BranchesPage ────────────────────────────────────────────────────────────

export default function BranchesPage() {
    const [showModal, setShowModal] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation();

    const branches = useAppStore(s => s.branches);
    const setBranches = useAppStore(s => s.setBranchesFromApi);

    if (user?.role !== 'owner') {
        return <Navigate to="/dashboard" replace />;
    }

    const syncBranches = async () => {
        const branchesRaw = await api.getPartnerBranches();
        const mappedBranches = branchesRaw.map(mapBranchFromApi);
        setBranches(mappedBranches);
        loadPartnerWorkspace().catch(() => { });
    };

    const handleSave = async (form) => {
        setErrorMessage('');
        try {
            if (editBranch) {
                await api.patchPartnerBranch(editBranch.id, {
                    name: form.name.trim(),
                    address: form.address.trim(),
                    is_active: form.status === 'active',
                    // Include coordinates only if picked
                    ...(form.lat != null && { latitude: form.lat }),
                    ...(form.lng != null && { longitude: form.lng }),
                });
            } else {
                const payload = {
                    brand: form.brandId,
                    name: form.name.trim(),
                    address: form.address.trim(),
                    is_active: form.status === 'active',
                    ...(form.lat != null && { latitude: form.lat }),
                    ...(form.lng != null && { longitude: form.lng }),
                };
                await createBranchWithUniqueSlug(payload);
            }
            await syncBranches();
            setShowModal(false);
        } catch (e) {
            console.error('[BranchesPage] handleSave failed:', e);
            setErrorMessage(getApiError(e));
            throw e;
        }
    };

    const handleDeactivate = async (id) => {
        setErrorMessage('');
        try {
            await api.patchPartnerBranch(id, { is_active: false });
            await syncBranches();
        } catch (e) {
            console.error('[BranchesPage] handleDeactivate failed:', e);
            setErrorMessage(getApiError(e));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('branches.title')} subtitle={`${branches.length} locations`}>
                <div className="search-box">
                    <input placeholder={t('common.search')} readOnly disabled style={{ opacity: 0.6 }} />
                </div>
                <button type="button" className="btn btn-primary" onClick={() => { setEditBranch(null); setShowModal(true); }}>
                    + {t('branches.addBranch')}
                </button>
            </Topbar>

            <div className="page-body animate-in">
                <div className="page-header">
                    <div>
                        <div className="page-title">{t('branches.title')}</div>
                        <div className="page-subtitle">{t('branches.subtitle')}</div>
                    </div>
                </div>

                {errorMessage && (
                    <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16, color: 'var(--red)', fontSize: 14 }}>
                        ⚠ {errorMessage}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
                    {[
                        { label: 'Total Branches', value: branches.length, icon: '🏢', color: 'var(--blue)' },
                        { label: 'Active', value: branches.filter(b => b.status === 'active').length, icon: '✓', color: 'var(--green)' },
                        { label: 'Total Tables', value: branches.reduce((s, b) => s + b.tables, 0), icon: '◫', color: 'var(--yellow)' },
                        { label: 'Today Bookings', value: branches.reduce((s, b) => s + b.todayBookings, 0), icon: '📋', color: 'var(--red)' },
                    ].map(s => (
                        <div key={s.label} style={{
                            flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: 12
                        }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid-3">
                    {branches.map(b => (
                        <BranchCard
                            key={b.id}
                            branch={b}
                            onEdit={br => { setEditBranch(br); setShowModal(true); }}
                            onOpen={() => navigate(`/branches/${b.id}`)}
                            onSchema={() => navigate(`/schema?branch=${b.id}`)}
                        />
                    ))}

                    <div
                        className="card"
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', border: '2px dashed var(--border2)', minHeight: 280, gap: 12,
                            transition: 'all 0.2s'
                        }}
                        onClick={() => { setEditBranch(null); setShowModal(true); }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-muted)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface)'; }}
                    >
                        <div style={{ fontSize: 36, opacity: 0.4 }}>+</div>
                        <div style={{ fontWeight: 600, color: 'var(--text2)' }}>Add New Branch</div>
                    </div>
                </div>
            </div>

            {showModal && (
                <BranchModal
                    branch={editBranch}
                    onClose={() => { setShowModal(false); setErrorMessage(''); }}
                    onSave={handleSave}
                    onDeactivate={handleDeactivate}
                    setPageError={setErrorMessage}
                />
            )}
        </div>
    );
}