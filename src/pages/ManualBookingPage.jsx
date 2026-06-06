// ManualBookingPage.jsx
// Step 3 shows branch schema (Konva, read-only) — click a table to select it
// Available tables glow green, occupied=red (not selectable), reserved=yellow (not selectable)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Circle, Line, Text } from 'react-konva';
import Topbar from '../components/Topbar';
import { useAppStore, todayISO } from '../store/appStore';
import { api, getApiError } from '../services/api';
import { loadPartnerWorkspace } from '../services/partnerSync';
import { mapBookingFromApi } from '../services/mappers';


// ── Constants ──────────────────────────────────────────────────────────────────
const CANVAS_W = 1400;
const CANVAS_H = 800;

const TH = {
    canvasBg: '#16161a',
    gridMinor: 'rgba(255,255,255,0.03)',
    gridMajor: 'rgba(255,255,255,0.07)',
    available: { fill: 'rgba(34,197,94,0.18)', stroke: '#22c55e' },
    occupied: { fill: 'rgba(232,25,44,0.2)', stroke: '#e8192c' },
    reserved: { fill: 'rgba(245,158,11,0.16)', stroke: '#f59e0b' },
    selected: { fill: 'rgba(6,182,212,0.2)', stroke: '#06b6d4' },
    wall: { fill: 'rgba(100,100,110,0.8)', stroke: '#78716c' },
    neutral: { fill: 'rgba(80,80,90,0.4)', stroke: '#6b7280' },
    seatFill: 'rgba(255,255,255,0.12)',
    seatStroke: 'rgba(255,255,255,0.06)',
    tableMeta: 'rgba(255,255,255,0.4)',
    textDim: 'rgba(255,255,255,0.25)',
    entrance: '#f59e0b',
    canvasBorder: 'rgba(255,255,255,0.06)',
};

// ── API → canvas object ────────────────────────────────────────────────────────
// tableByLayoutItem: { layoutItemId → tableId } — fetched from Tables API
function apiItemToObj(item, tableByLayoutItem = {}) {
    const visual = item.meta?.visual_type || fallbackType(item.type, item.shape);
    return {
        id: String(item.id),
        type: visual,
        x: item.x,
        y: item.y,
        w: item.width,
        h: item.height,
        rotation: item.rotation || 0,
        label: item.meta?.label || item.name || '',
        zone: item.meta?.zone_key || 'NONE',
        _apiId: item.id,                // LayoutItem id
        _floorId: item.floor,
        _zoneId: item.zone,
        _tableApiId: tableByLayoutItem[item.id] ?? null,  // real Table id for booking
    };
}

function fallbackType(t, s) {
    if (t === 'table' && s === 'round') return 'table_round_4';
    if (t === 'table') return 'table_rect_4';
    if (t === 'wall') return 'wall';
    if (t === 'entrance') return 'entrance';
    if (t === 'wc') return 'wc_rect';
    if (t === 'cashier') return 'cashier';
    return 'stage';
}

const isTableType = type => type && type.startsWith('table_');

// ── Grid ──────────────────────────────────────────────────────────────────────
function GridLayer() {
    const lines = [];
    for (let x = 0; x <= CANVAS_W; x += 20) {
        const m = x % 100 === 0;
        lines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke={m ? TH.gridMajor : TH.gridMinor} strokeWidth={1} listening={false} />);
    }
    for (let y = 0; y <= CANVAS_H; y += 20) {
        const m = y % 100 === 0;
        lines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke={m ? TH.gridMajor : TH.gridMinor} strokeWidth={1} listening={false} />);
    }
    return <>{lines}</>;
}

// ── Shape renderer ─────────────────────────────────────────────────────────────
function renderShape(obj, liveStatus, isSelected) {
    const { w, h, type, label } = obj;
    const s = isSelected ? TH.selected : (TH[liveStatus] || TH.available);

    if (type.startsWith('table_round')) {
        const seats = parseInt(type.split('_').pop()) || 4;
        const cx = w / 2, cy = h / 2;
        const tableR = Math.min(cx, cy) - 10;
        const ring = tableR + 14;
        const seatEls = [];
        for (let i = 0; i < seats; i++) {
            const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
            seatEls.push(<Circle key={i} x={cx + Math.cos(a) * ring} y={cy + Math.sin(a) * ring} radius={8} fill={TH.seatFill} stroke={TH.seatStroke} strokeWidth={1} />);
        }
        return (
            <Group>
                {seatEls}
                <Circle x={cx} y={cy} radius={tableR} fill={s.fill} stroke={s.stroke} strokeWidth={isSelected ? 3 : 2.5}
                    shadowColor={s.stroke} shadowBlur={isSelected ? 16 : (liveStatus === 'available' ? 8 : 6)} shadowOpacity={0.6} />
                <Text x={0} y={cy - 9} width={w} text={label} fontSize={12} fontStyle="bold" fill={s.stroke} align="center" />
                <Text x={0} y={cy + 3} width={w} text={`${seats}p`} fontSize={9} fill={TH.tableMeta} align="center" />
            </Group>
        );
    }

    if (type.startsWith('table_rect')) {
        const seats = parseInt(type.split('_').pop()) || 4;
        const cW = 18, cH = 11, gap = 4;
        const top = Math.ceil(seats / 2), bot = Math.floor(seats / 2);
        const chairEls = [];
        for (let i = 0; i < top; i++) chairEls.push(<Rect key={`ct${i}`} x={w / (top + 1) * (i + 1) - cW / 2} y={-cH - gap} width={cW} height={cH} cornerRadius={3} fill={TH.seatFill} stroke={TH.seatStroke} strokeWidth={1} />);
        for (let i = 0; i < bot; i++) chairEls.push(<Rect key={`cb${i}`} x={w / (bot + 1) * (i + 1) - cW / 2} y={h + gap} width={cW} height={cH} cornerRadius={3} fill={TH.seatFill} stroke={TH.seatStroke} strokeWidth={1} />);
        return (
            <Group>
                {chairEls}
                <Rect x={0} y={0} width={w} height={h} cornerRadius={6} fill={s.fill} stroke={s.stroke} strokeWidth={isSelected ? 3 : 2.5}
                    shadowColor={s.stroke} shadowBlur={isSelected ? 16 : (liveStatus === 'available' ? 8 : 6)} shadowOpacity={0.6} />
                <Text x={0} y={h / 2 - 9} width={w} text={label} fontSize={12} fontStyle="bold" fill={s.stroke} align="center" />
                <Text x={0} y={h / 2 + 3} width={w} text={`${seats}p`} fontSize={9} fill={TH.tableMeta} align="center" />
            </Group>
        );
    }

    if (type === 'wall' || type === 'wall_v') return <Rect x={0} y={0} width={w} height={h} fill={TH.wall.fill} stroke={TH.wall.stroke} strokeWidth={1} />;
    if (type === 'entrance') return (
        <Group>
            <Rect x={0} y={0} width={w} height={h} cornerRadius={6} fill={`${TH.entrance}18`} stroke={TH.entrance} strokeWidth={2} dash={[6, 3]} />
            <Text x={0} y={h / 2 - 7} width={w} text="ENTRANCE" fontSize={9} fontStyle="bold" fill={TH.entrance} align="center" />
        </Group>
    );

    const lbl = { bar_counter: 'BAR', cashier: 'CASHIER', kids: 'KIDS', stage: 'STAGE', sofa: 'SOFA', stairs: 'STAIRS', wc_rect: 'WC' };
    return (
        <Group>
            <Rect x={0} y={0} width={w} height={h} cornerRadius={4} fill={TH.neutral.fill} stroke={TH.neutral.stroke} strokeWidth={1} />
            <Text x={0} y={h / 2 - 6} width={w} text={lbl[type] || type.replace(/_/g, ' ').toUpperCase()} fontSize={9} fontStyle="bold" fill={TH.neutral.stroke} align="center" />
        </Group>
    );
}

// ── Canvas item ────────────────────────────────────────────────────────────────
function SchemaItem({ obj, liveStatus, isSelected, onSelect }) {
    const isTable = isTableType(obj.type);
    const isSelectable = isTable && liveStatus === 'available';

    return (
        <Group
            x={obj.x} y={obj.y} width={obj.w} height={obj.h} rotation={obj.rotation || 0}
            onClick={e => { if (isSelectable) { e.cancelBubble = true; onSelect(obj); } }}
            onTap={e => { if (isSelectable) { e.cancelBubble = true; onSelect(obj); } }}
            onMouseEnter={e => { e.target.getStage().container().style.cursor = isSelectable ? 'pointer' : 'grab'; }}
            onMouseLeave={e => { e.target.getStage().container().style.cursor = 'grab'; }}
            opacity={isTable && !isSelectable && !isSelected ? 0.7 : 1}
        >
            {renderShape(obj, liveStatus, isSelected)}
            {/* Lock icon for occupied/reserved tables */}
            {isTable && liveStatus !== 'available' && (
                <Text x={obj.w / 2 - 8} y={-18} text={liveStatus === 'occupied' ? '🔴' : '🟡'} fontSize={13} />
            )}
        </Group>
    );
}

// ── Schema picker modal ────────────────────────────────────────────────────────
function SchemaPickerModal({ branchId, date, time, guestCount, selectedTable, onSelect, onClose }) {
    const [floors, setFloors] = useState([]);
    const [activeFloorId, setActiveFloorId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [scale, setScale] = useState(0.6);
    const [pos, setPos] = useState({ x: 10, y: 10 });

    const stageRef = useRef(null);
    const containerRef = useRef(null);
    const [stageSize, setStageSize] = useState({ w: 800, h: 500 });

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Load floors + items + tables (need real Table ids for booking)
    useEffect(() => {
        if (!branchId) return;
        setLoading(true);

        const doLoad = async () => {
            // Partner endpoint filtered by branch, fallback to public
            let allFloors = [];
            try {
                allFloors = await api.getPartnerFloors();
                allFloors = allFloors.filter(f =>
                    String(f.branch ?? f.branch_id ?? '') === String(branchId)
                );
            } catch (_) {
                try { allFloors = await api.getPublicFloors(branchId); } catch (_2) { }
            }

            return Promise.all(allFloors.map(async f => {
                let items = [];
                try { items = await api.getPartnerLayoutItems({ floor_id: f.id }); } catch (_) { }

                // Build layoutItemId → tableId map for real Table ids
                let tablesList = [];
                try {
                    tablesList = await api.getPartnerTables({ branch_id: branchId, floor_id: f.id });
                } catch (_) { }

                const tableByLayoutItem = {};
                for (const t of tablesList) {
                    const liId = t.layout_item ?? t.layout_item_id;
                    if (liId != null) tableByLayoutItem[liId] = t.id;
                }

                return {
                    id: f.id,
                    name: f.name,
                    apiFloorId: f.id,
                    objects: items.map(item => apiItemToObj(item, tableByLayoutItem)),
                };
            }));
        };

        doLoad()
            .then(lf => {
                setFloors(lf);
                setActiveFloorId(lf[0]?.id ?? null);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [branchId]);

    // Load bookings for date overlap check
    useEffect(() => {
        api.getPartnerBookings()
            .then(list => setBookings(list.map(b => ({
                tableId: b.table_id ?? b.table,
                tableName: b.table_name ?? b.table?.name ?? String(b.table ?? ''),
                status: b.status,
                date: b.booking_start?.slice(0, 10) ?? b.date,
            }))))
            .catch(() => { });
    }, []);

    const activeFloor = floors.find(f => f.id === activeFloorId);
    const objects = activeFloor?.objects || [];

    const getLiveStatus = useCallback((obj) => {
        if (!isTableType(obj.type)) return null;
        const b = bookings.find(bk =>
            bk.date === date &&
            bk.tableName === obj.label &&
            !['cancelled', 'completed', 'no-show'].includes(bk.status)
        );
        if (!b) return 'available';
        if (b.status === 'confirmed' || b.status === 'checked_in') return 'occupied';
        if (b.status === 'pending') return 'reserved';
        return 'available';
    }, [bookings, date]);

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const pt = stage.getPointerPosition();
        const dir = e.evt.deltaY < 0 ? 1 : -1;
        const ns = Math.min(3, Math.max(0.2, scale * (1 + dir * 0.1)));
        const mp = { x: (pt.x - pos.x) / scale, y: (pt.y - pos.y) / scale };
        setScale(ns);
        setPos({ x: pt.x - mp.x * ns, y: pt.y - mp.y * ns });
    };

    const availableCount = objects.filter(o => isTableType(o.type) && getLiveStatus(o) === 'available').length;

    return (
        <div className="modal-overlay" style={{ alignItems: 'stretch', padding: 0 }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ width: '95vw', maxWidth: 1100, height: '90vh', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                {/* Header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Select a Table from Floor Plan</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                            {date} · {time} · {guestCount} guests · <span style={{ color: '#22c55e' }}>{availableCount} tables available</span>
                        </div>
                    </div>
                    {/* Floor tabs */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        {floors.map(f => (
                            <button key={f.id} type="button" className={`tab ${activeFloorId === f.id ? 'active' : ''}`}
                                onClick={() => { setActiveFloorId(f.id); }}>
                                {f.name}
                            </button>
                        ))}
                    </div>
                    {/* Zoom */}
                    <div style={{ display: 'flex', gap: 3 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.max(0.2, s / 1.2))}>−</button>
                        <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', width: 36, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.min(3, s * 1.2))}>+</button>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
                </div>

                {/* Legend */}
                <div style={{ padding: '6px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 12 }}>
                    {[['#22c55e', 'Available (clickable)'], ['#e8192c', 'Occupied'], ['#f59e0b', 'Reserved'], ['#06b6d4', 'Selected']].map(([c, l]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                            <span style={{ color: 'var(--text2)' }}>{l}</span>
                        </div>
                    ))}
                </div>

                {/* Canvas */}
                <div ref={containerRef} style={{ flex: 1, background: TH.canvasBg, overflow: 'hidden' }}>
                    {loading && <div style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', paddingTop: 80 }}>Loading floor plan…</div>}
                    {!loading && floors.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', paddingTop: 80 }}>No schema for this branch yet.</div>}
                    {!loading && floors.length > 0 && (
                        <Stage ref={stageRef}
                            width={stageSize.w} height={stageSize.h}
                            scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
                            draggable onWheel={handleWheel}
                            onDragEnd={e => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
                            style={{ cursor: 'grab' }}>
                            <Layer listening={false}>
                                <GridLayer />
                                <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="transparent" stroke={TH.canvasBorder} strokeWidth={1} listening={false} />
                                <Text x={18} y={20} text={activeFloor?.name?.toUpperCase() || ''} fontSize={11} fontStyle="700" fill={TH.textDim} letterSpacing={2} listening={false} />
                                <Line points={[CANVAS_W / 2 - 80, CANVAS_H - 4, CANVAS_W / 2 + 80, CANVAS_H - 4]} stroke={TH.entrance} strokeWidth={4} listening={false} />
                                <Text x={CANVAS_W / 2 - 80} y={CANVAS_H - 18} width={160} text="ENTRANCE" fontSize={9} fontStyle="700" fill={TH.entrance} align="center" letterSpacing={2} listening={false} />
                            </Layer>
                            <Layer>
                                {objects.map(obj => {
                                    const liveStatus = isTableType(obj.type) ? getLiveStatus(obj) : null;
                                    const isSelected = selectedTable?._apiId === obj._apiId;
                                    return (
                                        <SchemaItem key={obj.id} obj={obj}
                                            liveStatus={liveStatus}
                                            isSelected={isSelected}
                                            onSelect={o => onSelect({ ...o, floorApiId: activeFloor?.apiFloorId })}
                                        />
                                    );
                                })}
                            </Layer>
                        </Stage>
                    )}
                </div>

                {/* Footer: selected table info + confirm */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {selectedTable ? (
                        <>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: '#06b6d4' }}>{selectedTable.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Zone: {selectedTable.zone || '—'} · Floor: {activeFloor?.name}</div>
                            </div>
                            <button type="button" className="btn btn-primary" onClick={onClose}>
                                ✓ Confirm Table Selection
                            </button>
                        </>
                    ) : (
                        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Click on a <span style={{ color: '#22c55e' }}>green (available)</span> table to select it</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ManualBookingPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        guests: 2,
        children: 0,
        date: todayISO(),
        time: '19:00',
        note: '',
        branchId: null,
        // Selected table from schema picker
        selectedObj: null,  // full canvas object
        floorApiId: null,  // API floor id
    });
    const [submitting, setSubmitting] = useState(false);
    const [showSchemaPicker, setShowSchemaPicker] = useState(false);

    const branches = useAppStore(s => s.branches);

    // Default to first branch
    useEffect(() => {
        if (!form.branchId && branches.length) {
            setForm(f => ({ ...f, branchId: branches[0].id }));
        }
    }, [branches]); // eslint-disable-line react-hooks/exhaustive-deps

    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const submit = async () => {
        if (!form.selectedObj) return;

        const tableId = form.selectedObj._tableApiId;
        if (!tableId) {
            alert('Bu stol uchun Table yozuvi topilmadi. Avval sxemani saqlang (Schema Builder → Save Layout).');
            return;
        }

        setSubmitting(true);
        try {
            const start = new Date(`${form.date}T${form.time}:00`);
            const end = new Date(start.getTime() + 90 * 60 * 1000);

            const payload = {
                branch: Number(form.branchId),
                floor: Number(form.floorApiId),
                table: Number(tableId),
                guest_name: String(form.name).trim(),
                guest_phone: String(form.phone).trim(),
                guest_count: Number(form.guests),
                children_count: Number(form.children),
                booking_start: start.toISOString(),
                booking_end: end.toISOString(),
                special_request: form.note || '',
            };

            console.log('[ManualBooking] payload:', payload);
            await api.partnerManualBooking(payload);

            // Refresh workspace then redirect
            try { await import('../services/partnerSync').then(m => m.loadPartnerWorkspace()); } catch (_) { }
            navigate('/bookings');
        } catch (e) {
            console.log('STATUS:', e.response?.status);
            console.log('DATA:', e.response?.data);
            const msg = typeof e.response?.data === 'object'
                ? JSON.stringify(e.response.data)
                : (e.response?.data ?? e.message);
            alert('Booking xatosi: ' + msg);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedBranch = branches.find(b => b.id === form.branchId);

    const STEPS = [
        { n: 1, label: 'Guest Info' },
        { n: 2, label: 'Date & Time' },
        { n: 3, label: 'Select Table' },
        { n: 4, label: 'Confirm' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('bookings.newBooking', 'Manual Booking')} subtitle={t('manualBooking.subtitle', 'Walk-in or phone reservation')}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bookings')}>← {t('common.back', 'Back')}</button>
            </Topbar>

            <div className="page-body animate-in">
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
                        {STEPS.map((s, i) => (
                            <span key={s.n} style={{ display: 'contents' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                                    onClick={() => step > s.n && setStep(s.n)}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: step >= s.n ? 'var(--red)' : 'var(--surface2)',
                                        color: step >= s.n ? 'white' : 'var(--text3)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 14,
                                        cursor: step > s.n ? 'pointer' : 'default',
                                        boxShadow: step === s.n ? 'var(--shadow-red)' : 'none',
                                    }}>
                                        {step > s.n ? '✓' : s.n}
                                    </div>
                                    <div style={{ fontSize: 11, color: step >= s.n ? 'var(--text)' : 'var(--text3)', fontWeight: step === s.n ? 700 : 400 }}>
                                        {s.label}
                                    </div>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div style={{ flex: 1, height: 2, marginBottom: 22, background: step > s.n ? 'var(--red)' : 'var(--border)', transition: 'all 0.3s' }} />
                                )}
                            </span>
                        ))}
                    </div>

                    {/* ── Step 1: Guest Info ── */}
                    {step === 1 && (
                        <div className="card card-lg animate-in">
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20 }}>Guest Information</div>

                            <div className="form-group">
                                <label className="form-label">Branch *</label>
                                <select className="form-select" value={form.branchId || ''} onChange={e => update('branchId', Number(e.target.value))}>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Guest Name</label>
                                    <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="John Smith" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+998 90 123 45 67" />
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Guests (adults)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => update('guests', Math.max(1, form.guests - 1))}>−</button>
                                        <span style={{ fontWeight: 800, fontSize: 18, minWidth: 30, textAlign: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>{form.guests}</span>
                                        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => update('guests', form.guests + 1)}>+</button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Children</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => update('children', Math.max(0, form.children - 1))}>−</button>
                                        <span style={{ fontWeight: 800, fontSize: 18, minWidth: 30, textAlign: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>{form.children}</span>
                                        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => update('children', form.children + 1)}>+</button>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Special Request</label>
                                <input className="form-input" value={form.note} onChange={e => update('note', e.target.value)} placeholder="Window table, birthday, allergies…" />
                            </div>

                            <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep(2)}>
                                Next: Date & Time →
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Date & Time ── */}
                    {step === 2 && (
                        <div className="card card-lg animate-in">
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 20 }}>Date & Time</div>

                            <div className="grid-2" style={{ marginBottom: 20 }}>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" value={form.date} onChange={e => update('date', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <select className="form-select" value={form.time} onChange={e => update('time', e.target.value)}>
                                        {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'].map(t => (
                                            <option key={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div className="form-label" style={{ marginBottom: 10 }}>Quick Select</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {['18:00', '19:00', '19:30', '20:00', '20:30', '21:00'].map(t => (
                                        <button key={t} type="button" onClick={() => update('time', t)}
                                            style={{
                                                padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                border: `1px solid ${form.time === t ? 'var(--red)' : 'var(--border)'}`,
                                                background: form.time === t ? 'var(--red-muted)' : 'var(--surface2)',
                                                color: form.time === t ? 'var(--red-light)' : 'var(--text2)',
                                            }}>{t}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" className="btn btn-ghost btn-lg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Back</button>
                                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>Next: Select Table →</button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Select Table via Schema ── */}
                    {step === 3 && (
                        <div className="card card-lg animate-in">
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Select Table</div>
                            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 20 }}>
                                Choose from the floor plan for {form.guests} guest{form.guests > 1 ? 's' : ''} · {form.date} at {form.time}
                            </div>

                            {/* Selected table preview */}
                            {form.selectedObj ? (
                                <div style={{ background: 'rgba(6,182,212,0.1)', border: '1.5px solid #06b6d4', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: 26 }}>◫</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#06b6d4' }}>{form.selectedObj.label}</div>
                                        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Zone: {form.selectedObj.zone || '—'} · {selectedBranch?.name}</div>
                                    </div>
                                    <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓ Selected</span>
                                </div>
                            ) : (
                                <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text3)' }}>
                                    No table selected yet. Open the floor plan to pick one.
                                </div>
                            )}

                            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }}
                                onClick={() => setShowSchemaPicker(true)}>
                                🗺 Open Floor Plan to Select Table
                            </button>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" className="btn btn-ghost btn-lg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>← Back</button>
                                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2, justifyContent: 'center' }}
                                    onClick={() => setStep(4)} disabled={!form.selectedObj}>
                                    Next: Confirm →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Confirm ── */}
                    {step === 4 && (
                        <div className="card card-lg animate-in">
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Confirm Booking</div>
                            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 20 }}>Review and confirm the reservation</div>

                            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
                                {[
                                    { label: '🏢 Branch', value: selectedBranch?.name || '—' },
                                    { label: '👤 Guest', value: form.name || '(walk-in)' },
                                    { label: '📱 Phone', value: form.phone || '—' },
                                    { label: '📅 Date', value: form.date },
                                    { label: '🕐 Time', value: form.time },
                                    { label: '👥 Guests', value: `${form.guests} adults${form.children ? `, ${form.children} children` : ''}` },
                                    { label: '◫ Table', value: form.selectedObj?.label || '—' },
                                    { label: '📍 Zone', value: form.selectedObj?.zone || '—' },
                                    form.note && { label: '📝 Note', value: form.note },
                                ].filter(Boolean).map(f => (
                                    <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                                        <span style={{ color: 'var(--text3)' }}>{f.label}</span>
                                        <span style={{ fontWeight: 600 }}>{f.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" className="btn btn-ghost btn-lg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>← Back</button>
                                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2, justifyContent: 'center' }} onClick={submit} disabled={submitting}>
                                    {submitting ? '⏳ Creating…' : '✓ Create Booking'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Schema picker modal */}
            {showSchemaPicker && form.branchId && (
                <SchemaPickerModal
                    branchId={form.branchId}
                    date={form.date}
                    time={form.time}
                    guestCount={form.guests}
                    selectedTable={form.selectedObj}
                    onSelect={obj => {
                        update('selectedObj', obj);
                        update('floorApiId', obj.floorApiId);
                    }}
                    onClose={() => setShowSchemaPicker(false)}
                />
            )}
        </div>
    );
}