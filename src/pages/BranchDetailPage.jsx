import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore, todayISO } from '../store/appStore';
import { api, getApiError } from '../services/api';
import { mapBranchFromApi } from '../services/mappers';

const STATUS_BADGE = {
    confirmed: <span className="badge badge-green">● Confirmed</span>,
    pending: <span className="badge badge-yellow">◌ Pending</span>,
    cancelled: <span className="badge badge-red">✕ Cancelled</span>,
    'no-show': <span className="badge badge-gray">— No Show</span>,
    completed: <span className="badge badge-blue">✓ Completed</span>,
};

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

// ─── BranchMap ───────────────────────────────────────────────────────────────
// readOnly=true  → just shows a pin, no interaction
// readOnly=false → click / drag marker to pick new location

function BranchMap({ lat, lng, readOnly = true, onPick }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onPickRef = useRef(onPick);
    onPickRef.current = onPick;

    const [geocoding, setGeocoding] = useState(false);

    useEffect(() => {
        let cleanup;

        const init = (L) => {
            if (!containerRef.current || mapRef.current) return;

            const center = (lat && lng) ? [lat, lng] : [41.2995, 69.2401];
            const zoom = (lat && lng) ? 15 : 12;

            const map = L.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: !readOnly,
                dragging: true,
            }).setView(center, zoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);

            mapRef.current = map;

            if (lat && lng) {
                const m = L.marker([lat, lng], { draggable: !readOnly }).addTo(map);
                markerRef.current = m;

                if (!readOnly) {
                    m.on('dragend', async (e) => {
                        const pos = e.target.getLatLng();
                        setGeocoding(true);
                        const address = await reverseGeocode(pos.lat, pos.lng);
                        setGeocoding(false);
                        onPickRef.current({ lat: pos.lat, lng: pos.lng, address });
                    });
                }
            }

            if (!readOnly) {
                map.on('click', async (e) => {
                    const { lat: clat, lng: clng } = e.latlng;
                    if (markerRef.current) {
                        markerRef.current.setLatLng(e.latlng);
                    } else {
                        const m = L.marker(e.latlng, { draggable: true }).addTo(map);
                        m.on('dragend', async (de) => {
                            const pos = de.target.getLatLng();
                            setGeocoding(true);
                            const address = await reverseGeocode(pos.lat, pos.lng);
                            setGeocoding(false);
                            onPickRef.current({ lat: pos.lat, lng: pos.lng, address });
                        });
                        markerRef.current = m;
                    }
                    setGeocoding(true);
                    const address = await reverseGeocode(clat, clng);
                    setGeocoding(false);
                    onPickRef.current({ lat: clat, lng: clng, address });
                });
            }
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
        <div style={{ position: 'relative' }}>
            <div
                ref={containerRef}
                style={{
                    height: 320,
                    borderRadius: 10,
                    border: '1.5px solid var(--border)',
                    overflow: 'hidden',
                    cursor: readOnly ? 'default' : 'crosshair',
                }}
            />
            {geocoding && (
                <div style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '4px 14px', fontSize: 12, color: 'var(--text2)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000,
                }}>
                    📍 Getting address…
                </div>
            )}
        </div>
    );
}

// ─── LocationCard ─────────────────────────────────────────────────────────────
// Shows map + handles edit mode with Save / Cancel

function LocationCard({ branch, onLocationSaved }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState({
        lat: branch.lat ?? branch.latitude ?? null,
        lng: branch.lng ?? branch.longitude ?? null,
        address: branch.address || '',
    });

    const branchLat = branch.lat ?? branch.latitude;
    const branchLng = branch.lng ?? branch.longitude;
    const hasLocation = Boolean(branchLat && branchLng);

    const handlePick = useCallback(({ lat, lng, address }) => {
        setDraft(d => ({ lat, lng, address: address || d.address }));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await api.patchPartnerBranch(branch.id, {
                latitude: draft.lat,
                longitude: draft.lng,
                address: draft.address.trim(),
            });
            onLocationSaved({ lat: draft.lat, lng: draft.lng, address: draft.address });
            setEditing(false);
        } catch (e) {
            setError(getApiError(e));
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraft({
            lat: branchLat,
            lng: branchLng,
            address: branch.address || '',
        });
        setEditing(false);
        setError('');
    };

    return (
        <div className="card" style={{ marginBottom: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>
                        📍 Location
                    </div>
                    {hasLocation && !editing && (
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {branchLat.toFixed(5)}, {branchLng.toFixed(5)}
                        </div>
                    )}
                </div>
                {!editing ? (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(true)}
                    >
                        ✎ {hasLocation ? 'Edit Location' : 'Set Location'}
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={handleCancel}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={saving || !draft.lat}
                            onClick={handleSave}
                        >
                            {saving ? 'Saving…' : '✓ Save Location'}
                        </button>
                    </div>
                )}
            </div>

            {/* Edit mode: editable address + instructions */}
            {editing && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6 }}>
                        🗺 Click anywhere on the map or drag the pin to set the location. Address will auto-fill.
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            className="form-input"
                            style={{ flex: 1, fontSize: 13 }}
                            value={draft.address}
                            onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                            placeholder="Address (auto-filled from map)"
                        />
                        {draft.lat && (
                            <span style={{ fontSize: 11, color: 'var(--green)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                ✓ {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Map */}
            {(hasLocation || editing) ? (
                <BranchMap
                    key={editing ? 'edit' : 'view'} // remount on mode change
                    lat={editing ? (draft.lat ?? branchLat) : branchLat}
                    lng={editing ? (draft.lng ?? branchLng) : branchLng}
                    readOnly={!editing}
                    onPick={handlePick}
                />
            ) : (
                <div style={{
                    height: 200, borderRadius: 10, border: '1.5px dashed var(--border)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 8, color: 'var(--text3)',
                }}>
                    <div style={{ fontSize: 32 }}>🗺</div>
                    <div style={{ fontSize: 13 }}>No location set yet</div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                        Set Location on Map
                    </button>
                </div>
            )}

            {/* Google Maps link */}
            {hasLocation && !editing && (
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <a
                        href={`https://www.google.com/maps?q=${branchLat},${branchLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}
                    >
                        Open in Google Maps ↗
                    </a>
                </div>
            )}

            {error && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--red)' }}>⚠ {error}</div>
            )}
        </div>
    );
}

// ─── BranchDetailPage ─────────────────────────────────────────────────────────

export default function BranchDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const today = todayISO();

    const branches = useAppStore(s => s.branches);
    const setBranches = useAppStore(s => s.setBranchesFromApi);
    const tables = useAppStore(s => s.tables);
    const bookings = useAppStore(s => s.bookings);
    const floors = useAppStore(s => s.floors);

    // Local branch state so LocationCard can update without full reload
    const [localBranch, setLocalBranch] = useState(null);

    useEffect(() => {
        const found = branches.find(b => String(b.id) === String(id));
        if (!found) { setLocalBranch(null); return; }
        // Normalize coordinate fields — API may return latitude/longitude or lat/lng
        setLocalBranch({
            ...found,
            lat: found.lat ?? found.latitude ?? null,
            lng: found.lng ?? found.longitude ?? null,
        });
    }, [branches, id]);

    const branch = localBranch;

    const branchTables = useMemo(() => tables.filter(t => t.branchId === branch?.id), [tables, branch]);
    const branchBookings = useMemo(() => bookings.filter(b => b.branchId === branch?.id), [bookings, branch]);
    const todayBookings = useMemo(() => branchBookings.filter(b => b.date === today && !['cancelled', 'no-show'].includes(b.status)), [branchBookings, today]);
    const branchFloors = useMemo(() => floors.filter(f => f.branchId === branch?.id), [floors, branch]);

    const tableCounts = useMemo(() => ({
        available: branchTables.filter(t => t.status === 'available').length,
        reserved: branchTables.filter(t => t.status === 'reserved').length,
        occupied: branchTables.filter(t => t.status === 'occupied').length,
    }), [branchTables]);

    // Called after location edit saved — patch local state immediately
    const handleLocationSaved = useCallback(({ lat, lng, address }) => {
        setLocalBranch(prev => prev ? { ...prev, lat, lng, latitude: lat, longitude: lng, address } : prev);
    }, []);

    if (!branch) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Topbar title="Branch Detail">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/branches')}>← Back</button>
                </Topbar>
                <div className="empty-state">
                    <div className="empty-state-icon">🏢</div>
                    <div className="empty-state-title">Branch not found</div>
                    <div className="empty-state-sub">This branch may have been removed or the ID is incorrect.</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={branch.name} subtitle={branch.address}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/branches')}>← {t('branches.title')}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/tables?branch=${branch.id}`)}>🗺 {t('nav.tableView')}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/schema?branch=${branch.id}`)}>⬡ {t('schema.title')}</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/manual-booking')}>+ {t('bookings.newBooking')}</button>
            </Topbar>

            <div className="page-body animate-in">
                {/* Status + quick stats */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: "Today's Bookings", value: todayBookings.length, icon: '📋', color: 'var(--red)' },
                        { label: 'Total Tables', value: branchTables.length, icon: '◫', color: 'var(--blue)' },
                        { label: 'Available Now', value: tableCounts.available, icon: '✓', color: 'var(--green)' },
                        { label: 'Total Floors', value: branchFloors.length, icon: '⊞', color: 'var(--yellow)' },
                    ].map(s => (
                        <div key={s.label} style={{ flex: 1, minWidth: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                    {/* Table status breakdown */}
                    <div className="card">
                        <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 16 }}>Table Status</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Available', count: tableCounts.available, color: '#22c55e' },
                                { label: 'Reserved', count: tableCounts.reserved, color: '#f59e0b' },
                                { label: 'Occupied', count: tableCounts.occupied, color: '#e8192c' },
                            ].map(s => (
                                <div key={s.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                        <span style={{ color: 'var(--text2)' }}>{s.label}</span>
                                        <span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${branchTables.length ? (s.count / branchTables.length * 100) : 0}%`, transition: 'width 0.5s' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => navigate(`/tables?branch=${branch.id}`)}>
                                View Live Floor Plan →
                            </button>
                        </div>
                    </div>

                    {/* Branch info */}
                    <div className="card">
                        <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 16 }}>Branch Info</div>
                        {[
                            { label: 'Status', value: branch.status },
                            { label: 'Address', value: branch.address || '—' },
                            { label: 'Floors', value: branchFloors.map(f => f.name).join(', ') || '—' },
                            { label: 'Capacity', value: `${branchTables.reduce((s, t) => s + (t.seats || 0), 0)} seats` },
                            { label: 'Total Bookings', value: branchBookings.length },
                            {
                                label: 'Coordinates',
                                value: (branch.lat ?? branch.latitude)
                                    ? `${(branch.lat ?? branch.latitude).toFixed(5)}, ${(branch.lng ?? branch.longitude).toFixed(5)}`
                                    : '—',
                            },
                        ].map(f => (
                            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                                <span style={{ color: 'var(--text3)' }}>{f.label}</span>
                                <span style={{ fontWeight: 600 }}>
                                    {f.label === 'Status' ? (
                                        <span className={branch.status === 'active' ? 'badge badge-green' : 'badge badge-gray'}>{branch.status}</span>
                                    ) : f.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Location Map Card ── */}
                <LocationCard
                    branch={branch}
                    onLocationSaved={handleLocationSaved}
                />

                {/* Today's bookings */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Today's Bookings</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{today}</div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/bookings')}>View All →</button>
                    </div>

                    {todayBookings.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: '24px 0' }}>
                            No bookings for today
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Guest</th><th>Time</th><th>Table</th><th>Guests</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {todayBookings.map(b => (
                                        <tr key={b.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{b.guestName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.phone}</div>
                                            </td>
                                            <td style={{ fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{b.time}</td>
                                            <td>{b.table || '—'}</td>
                                            <td>{b.guests}</td>
                                            <td>{STATUS_BADGE[b.status]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Tables list */}
                <div className="card" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Tables ({branchTables.length})</div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/schema?branch=${branch.id}`)}>⬡ Edit Schema →</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                        {branchTables.map(t => {
                            const color = t.status === 'available' ? '#22c55e' : t.status === 'occupied' ? '#e8192c' : '#f59e0b';
                            return (
                                <div key={t.id} style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${color}33`, background: `${color}0a`, textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color, fontFamily: "'Space Grotesk', sans-serif" }}>{t.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>👥 {t.seats} seats</div>
                                    <div style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600 }}>{t.status}</div>
                                </div>
                            );
                        })}
                        {branchTables.length === 0 && (
                            <div style={{ gridColumn: '1/-1', color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                                No tables yet. <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/schema?branch=${branch.id}`)}>Create schema →</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}