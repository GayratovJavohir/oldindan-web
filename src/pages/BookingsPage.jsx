import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/Topbar';
import { useAppStore, todayISO } from '../store/appStore';
import { api, getApiError } from '../services/api';
import { mapBookingFromApi, mapUiActionToApiStatus, mapUiStatusToApi } from '../services/mappers';

const STATUS_BADGE = {
    confirmed: <span className="badge badge-green">● Confirmed</span>,
    pending: <span className="badge badge-yellow">◌ Pending</span>,
    cancelled: <span className="badge badge-red">✕ Cancelled</span>,
    'no-show': <span className="badge badge-gray">— No Show</span>,
    completed: <span className="badge badge-blue">✓ Completed</span>,
};

const STATUS_COLOR = {
    confirmed: '#22c55e', pending: '#f59e0b', cancelled: '#e8192c',
    'no-show': '#64748b', completed: '#3b82f6',
};

const STATUSES = ['all', 'confirmed', 'pending', 'completed', 'cancelled', 'no-show'];

function EditModal({ booking, branches, onClose, onSave }) {
    const [status, setStatus] = useState(booking.status);
    const [note, setNote] = useState(booking.note || '');
    const [busy, setBusy] = useState(false);
    const branchName = branches.find(b => b.id === booking.branchId)?.name ?? `Branch #${booking.branchId}`;

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
            <div className="modal" style={{ maxWidth: 440 }}>
                <div className="modal-title">Update Booking #{booking.id}</div>
                <div className="modal-sub">Change status or add a note</div>

                <div style={{ padding: '12px 0', fontSize: 13.5, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    <div style={{ fontWeight: 600 }}>{booking.guestName}</div>
                    <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 3 }}>{booking.phone}</div>
                    <div style={{ marginTop: 8, color: 'var(--text2)' }}>
                        {booking.date} · {booking.time} · {booking.table} · {branchName}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                        {STATUSES.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Note</label>
                    <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…" />
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                        setBusy(true);
                        try { await onSave(booking.id, { status, note }); onClose(); }
                        catch (e) { alert(getApiError(e)); }
                        finally { setBusy(false); }
                    }}>{busy ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}

export default function BookingsPage() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [date, setDate] = useState('');   // empty = all dates
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [editing, setEditing] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const { t } = useTranslation();

    const bookings = useAppStore(s => s.bookings);
    const branches = useAppStore(s => s.branches);
    const getBranchName = useAppStore(s => s.getBranchName);
    const setBookingsFromApi = useAppStore(s => s.setBookingsFromApi);

    const refreshBookings = useCallback(async () => {
        setRefreshing(true);
        try {
            const list = await api.getPartnerBookings();
            const mapped = list.map(mapBookingFromApi);
            setBookingsFromApi(mapped);
            return mapped;
        } finally {
            setRefreshing(false);
        }
    }, [setBookingsFromApi]);

    // Load on mount
    useEffect(() => {
        refreshBookings().catch(() => { });
    }, [refreshBookings]);

    const postStatus = async (id, action, note = '') => {
        await api.partnerBookingStatus(id, mapUiActionToApiStatus(action), note);
        const mapped = await refreshBookings();
        setSelectedBooking(prev => prev?.id === id ? (mapped.find(b => b.id === id) ?? null) : prev);
    };

    const handleSaveEdit = async (id, { status, note }) => {
        await api.partnerBookingStatus(id, mapUiStatusToApi(status), note || '');
        const mapped = await refreshBookings();
        setSelectedBooking(prev => prev?.id === id ? (mapped.find(b => b.id === id) ?? null) : prev);
    };

    // Filter
    const filtered = bookings.filter(b => {
        if (filter !== 'all' && b.status !== filter) return false;
        if (date && b.date !== date) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                b.guestName.toLowerCase().includes(q) ||
                (b.phone || '').includes(q) ||
                (b.table || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Summary counts
    const counts = STATUSES.slice(1).reduce((acc, s) => {
        acc[s] = bookings.filter(b => b.status === s).length;
        return acc;
    }, {});

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('bookings.title')} subtitle={`${bookings.length} total reservations`}>
                <div className="search-box">
                    <input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)}
                    style={{ width: 150, padding: '7px 12px', fontSize: 13 }}
                    title="Filter by date (clear to show all)" />
                {date && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDate('')} title="Clear date filter">✕ {t('common.all')}</button>
                )}
                <button className="btn btn-ghost btn-sm" disabled={refreshing} onClick={() => refreshBookings().catch(() => { })}>
                    {refreshing ? '⟳' : '↻'} {t('common.refresh', 'Refresh')}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/manual-booking')}>+ {t('bookings.newBooking')}</button>
            </Topbar>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Summary strip */}
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {STATUSES.map(s => (
                            <button key={s} type="button"
                                onClick={() => setFilter(s)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                    border: `1px solid ${filter === s ? (STATUS_COLOR[s] || 'var(--red)') : 'var(--border)'}`,
                                    background: filter === s ? (s === 'all' ? 'var(--red-muted)' : `${STATUS_COLOR[s]}18`) : 'transparent',
                                    color: filter === s ? (STATUS_COLOR[s] || 'var(--red-light)') : 'var(--text3)',
                                }}>
                                {s === 'all' ? `All (${bookings.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s] || 0})`}
                            </button>
                        ))}
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
                            {filtered.length} shown
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ flex: 1, overflow: 'auto' }} className="page-body">
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>#</th>
                                        <th>Guest</th>
                                        <th>Date & Time</th>
                                        <th>Table</th>
                                        <th>Guests</th>
                                        <th>Branch</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
                                            No bookings found
                                        </td></tr>
                                    )}
                                    {filtered.map(b => (
                                        <tr key={b.id}
                                            style={{ cursor: 'pointer', background: selectedBooking?.id === b.id ? 'var(--surface2)' : 'transparent' }}
                                            onClick={() => setSelectedBooking(sel => sel?.id === b.id ? null : b)}>
                                            <td style={{ color: 'var(--text3)', fontSize: 12 }}>#{b.id}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div className="avatar" style={{ background: `hsl(${Number(b.id) * 47}, 55%, 40%)`, fontSize: 11, width: 30, height: 30 }}>
                                                        {b.guestName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.guestName}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{b.date}</div>
                                                <div style={{ fontSize: 11, color: 'var(--red-light)', fontWeight: 700 }}>{b.time}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{b.table || '—'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.floor}</div>
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{b.guests}</td>
                                            <td style={{ fontSize: 12, color: 'var(--text2)' }}>{getBranchName(b.branchId)}</td>
                                            <td>{STATUS_BADGE[b.status] ?? <span className="badge badge-gray">{b.status}</span>}</td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: 5 }}>
                                                    {b.status === 'pending' && (
                                                        <button type="button" className="btn btn-secondary btn-sm"
                                                            onClick={() => postStatus(b.id, 'confirm').catch(e => alert(getApiError(e)))}>✓ Confirm</button>
                                                    )}
                                                    {b.status === 'confirmed' && (
                                                        <button type="button" className="btn btn-ghost btn-sm"
                                                            onClick={() => postStatus(b.id, 'check_in').catch(e => alert(getApiError(e)))}>⬤ Check-in</button>
                                                    )}
                                                    {['pending', 'confirmed'].includes(b.status) && (
                                                        <button type="button" className="btn btn-danger btn-sm"
                                                            onClick={() => { if (confirm('Cancel this booking?')) postStatus(b.id, 'cancel').catch(e => alert(getApiError(e))); }}>✕</button>
                                                    )}
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(b)}>✎</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right detail panel */}
                {selectedBooking && (
                    <div style={{ width: 300, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Booking #{selectedBooking.id}</div>
                            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedBooking(null)}>✕</button>
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                <div className="avatar" style={{ background: `hsl(${Number(selectedBooking.id) * 47}, 55%, 40%)`, width: 48, height: 48, fontSize: 16 }}>
                                    {selectedBooking.guestName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedBooking.guestName}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{selectedBooking.phone || '—'}</div>
                                </div>
                            </div>

                            {STATUS_BADGE[selectedBooking.status]}

                            <div className="divider" />

                            {[
                                { label: 'Date', value: selectedBooking.date },
                                { label: 'Time', value: selectedBooking.time },
                                { label: 'Table', value: `${selectedBooking.table || '—'} (${selectedBooking.floor || '—'})` },
                                { label: 'Guests', value: `${selectedBooking.guests} people` },
                                { label: 'Branch', value: getBranchName(selectedBooking.branchId) },
                            ].map(f => (
                                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text3)' }}>{f.label}</span>
                                    <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{f.value}</span>
                                </div>
                            ))}

                            {selectedBooking.note && (
                                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', fontStyle: 'italic' }}>
                                    📝 &quot;{selectedBooking.note}&quot;
                                </div>
                            )}

                            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button type="button" className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => setEditing(selectedBooking)}>
                                    ✎ Update status / note
                                </button>
                                {selectedBooking.status === 'pending' && (
                                    <button type="button" className="btn btn-primary" style={{ justifyContent: 'center' }}
                                        onClick={() => postStatus(selectedBooking.id, 'confirm').catch(e => alert(getApiError(e)))}>
                                        ✓ Confirm Booking
                                    </button>
                                )}
                                {selectedBooking.status === 'confirmed' && (
                                    <>
                                        <button type="button" className="btn btn-primary" style={{ justifyContent: 'center' }}
                                            onClick={() => postStatus(selectedBooking.id, 'check_in').catch(e => alert(getApiError(e)))}>
                                            ✓ Check-in Guest
                                        </button>
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}
                                            onClick={() => postStatus(selectedBooking.id, 'complete').catch(e => alert(getApiError(e)))}>
                                            Mark Completed
                                        </button>
                                    </>
                                )}
                                {['pending', 'confirmed'].includes(selectedBooking.status) && (
                                    <>
                                        <button type="button" className="btn btn-danger" style={{ justifyContent: 'center' }}
                                            onClick={() => { if (confirm('Cancel this booking?')) postStatus(selectedBooking.id, 'cancel').catch(e => alert(getApiError(e))); }}>
                                            ✕ Cancel Booking
                                        </button>
                                        <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center' }}
                                            onClick={() => { if (confirm('Mark as no-show?')) postStatus(selectedBooking.id, 'no_show').catch(e => alert(getApiError(e))); }}>
                                            No-show
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {editing && (
                <EditModal booking={editing} branches={branches}
                    onClose={() => setEditing(null)} onSave={handleSaveEdit} />
            )}
        </div>
    );
}