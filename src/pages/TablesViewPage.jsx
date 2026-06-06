// TablesViewPage.jsx
// Branch tanlash → shu branchning Konva sxemasi (read-only, drag/zoom)
// Tablelarni bosib o'ng panelda booking ma'lumotini ko'rish
// Statuslar: available=yashil, occupied/confirmed=qizil, reserved/pending=sariq

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Circle, Line, Text } from 'react-konva';
import Topbar from '../components/Topbar';
import { useAppStore, todayISO } from '../store/appStore';
import { api, getApiError } from '../services/api';
import { mapBookingFromApi, mapUiActionToApiStatus } from '../services/mappers';

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_W = 1400;
const CANVAS_H = 800;

const STATUS_COLOR = {
    available: '#22c55e',
    occupied: '#e8192c',
    reserved: '#f59e0b',
    disabled: '#4a4a5a',
};
const STATUS_LABEL = {
    available: 'Available',
    occupied: 'Occupied',
    reserved: 'Reserved',
    disabled: 'Disabled',
};

// Dark theme for read-only canvas
const TH = {
    canvasBg: '#16161a',
    gridMinor: 'rgba(255,255,255,0.03)',
    gridMajor: 'rgba(255,255,255,0.07)',
    available: { fill: 'rgba(34,197,94,0.15)', stroke: '#22c55e' },
    occupied: { fill: 'rgba(232,25,44,0.22)', stroke: '#e8192c' },
    reserved: { fill: 'rgba(245,158,11,0.18)', stroke: '#f59e0b' },
    disabled: { fill: 'rgba(60,60,70,0.3)', stroke: '#4a4a5a' },
    wall: { fill: 'rgba(100,100,110,0.8)', stroke: '#78716c' },
    facility: { fill: 'rgba(139,92,246,0.15)', stroke: '#a78bfa' },
    neutral: { fill: 'rgba(80,80,90,0.4)', stroke: '#6b7280' },
    seatFill: 'rgba(255,255,255,0.13)',
    seatStroke: 'rgba(255,255,255,0.06)',
    tableMeta: 'rgba(255,255,255,0.4)',
    textDim: 'rgba(255,255,255,0.25)',
    selStroke: '#06b6d4',
    entrance: '#f59e0b',
    canvasBorder: 'rgba(255,255,255,0.06)',
};

// ── API → canvas object mapper ─────────────────────────────────────────────────
function apiItemToObj(item) {
    const visual = item.meta?.visual_type || fallbackVisualType(item.type, item.shape);
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
        status: item.meta?.status || 'available',
        _apiId: item.id,
    };
}

function fallbackVisualType(apiType, apiShape) {
    if (apiType === 'table' && apiShape === 'round') return 'table_round_4';
    if (apiType === 'table') return 'table_rect_4';
    if (apiType === 'wall') return 'wall';
    if (apiType === 'entrance') return 'entrance';
    if (apiType === 'wc') return 'wc_rect';
    if (apiType === 'cashier') return 'cashier';
    if (apiType === 'kids_area') return 'kids';
    return 'stage';
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function GridLayer() {
    const lines = [];
    const GRID = 20;
    for (let x = 0; x <= CANVAS_W; x += GRID) {
        const m = x % 100 === 0;
        lines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke={m ? TH.gridMajor : TH.gridMinor} strokeWidth={1} listening={false} />);
    }
    for (let y = 0; y <= CANVAS_H; y += GRID) {
        const m = y % 100 === 0;
        lines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke={m ? TH.gridMajor : TH.gridMinor} strokeWidth={1} listening={false} />);
    }
    return <>{lines}</>;
}

// ── Shape renderer (read-only) ─────────────────────────────────────────────────
function renderShape(obj, liveStatus) {
    const status = liveStatus || obj.status || 'available';
    const s = TH[status] || TH.available;
    const { w, h, type, label } = obj;

    // Round tables
    if (type.startsWith('table_round')) {
        const seats = parseInt(type.split('_').pop()) || 4;
        const cx = w / 2, cy = h / 2;
        const tableR = Math.min(cx, cy) - 10;
        const ring = tableR + 14;
        const seatEls = [];
        for (let i = 0; i < seats; i++) {
            const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
            seatEls.push(
                <Circle key={i} x={cx + Math.cos(a) * ring} y={cy + Math.sin(a) * ring}
                    radius={8} fill={TH.seatFill} stroke={TH.seatStroke} strokeWidth={1} />
            );
        }
        return (
            <Group>
                {seatEls}
                <Circle x={cx} y={cy} radius={tableR} fill={s.fill} stroke={s.stroke} strokeWidth={2.5}
                    shadowColor={s.stroke} shadowBlur={status !== 'available' ? 10 : 4} shadowOpacity={0.5} />
                <Text x={0} y={cy - 9} width={w} text={label} fontSize={12} fontStyle="bold" fill={s.stroke} align="center" />
                <Text x={0} y={cy + 3} width={w} text={`${seats}p`} fontSize={9} fill={TH.tableMeta} align="center" />
            </Group>
        );
    }

    // Rect tables
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
                <Rect x={0} y={0} width={w} height={h} cornerRadius={6} fill={s.fill} stroke={s.stroke} strokeWidth={2.5}
                    shadowColor={s.stroke} shadowBlur={status !== 'available' ? 10 : 4} shadowOpacity={0.5} />
                <Text x={0} y={h / 2 - 9} width={w} text={label} fontSize={12} fontStyle="bold" fill={s.stroke} align="center" />
                <Text x={0} y={h / 2 + 3} width={w} text={`${seats}p`} fontSize={9} fill={TH.tableMeta} align="center" />
            </Group>
        );
    }

    // Walls
    if (type === 'wall' || type === 'wall_v') {
        return <Rect x={0} y={0} width={w} height={h} fill={TH.wall.fill} stroke={TH.wall.stroke} strokeWidth={1} />;
    }

    // Entrance
    if (type === 'entrance') {
        return (
            <Group>
                <Rect x={0} y={0} width={w} height={h} cornerRadius={6} fill={`${TH.entrance}18`} stroke={TH.entrance} strokeWidth={2} dash={[6, 3]} />
                <Text x={0} y={h / 2 - 7} width={w} text="ENTRANCE" fontSize={9} fontStyle="bold" fill={TH.entrance} align="center" letterSpacing={1.5} />
            </Group>
        );
    }

    // WC
    if (type === 'wc_rect') {
        return (
            <Group>
                <Rect x={0} y={0} width={w} height={h} fill={TH.facility.fill} stroke={TH.facility.stroke} strokeWidth={2} cornerRadius={4} />
                <Text x={0} y={h / 2 - 8} width={w} text="WC" fontSize={14} fontStyle="bold" fill={TH.facility.stroke} align="center" />
            </Group>
        );
    }

    // Bar counter / cashier / kids / stage / sofa / stairs
    const labels = { bar_counter: 'BAR', cashier: 'CASHIER', kids: 'KIDS', stage: 'STAGE', sofa: 'SOFA', stairs: 'STAIRS' };
    return (
        <Group>
            <Rect x={0} y={0} width={w} height={h} cornerRadius={4} fill={TH.neutral.fill} stroke={TH.neutral.stroke} strokeWidth={1} />
            <Text x={0} y={h / 2 - 6} width={w} text={labels[type] || type.replace(/_/g, ' ').toUpperCase()} fontSize={9} fontStyle="bold" fill={TH.neutral.stroke} align="center" />
        </Group>
    );
}

// ── Canvas item component ──────────────────────────────────────────────────────
function SchemaItem({ obj, liveStatus, selected, onSelect }) {
    const isTable = obj.type.startsWith('table_');
    return (
        <Group
            x={obj.x} y={obj.y}
            width={obj.w} height={obj.h}
            rotation={obj.rotation || 0}
            onClick={e => { if (isTable) { e.cancelBubble = true; onSelect(obj); } }}
            onTap={e => { if (isTable) { e.cancelBubble = true; onSelect(obj); } }}
            onMouseEnter={e => { e.target.getStage().container().style.cursor = isTable ? 'pointer' : 'grab'; }}
            onMouseLeave={e => { e.target.getStage().container().style.cursor = 'grab'; }}
        >
            {renderShape(obj, isTable ? liveStatus : null)}
            {selected && isTable && (
                <Rect x={-5} y={-5} width={obj.w + 10} height={obj.h + 10} cornerRadius={8}
                    fill="transparent" stroke={TH.selStroke} strokeWidth={2.5} dash={[5, 4]} />
            )}
        </Group>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TablesViewPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();

    const branches = useAppStore(s => s.branches);
    const storeBookings = useAppStore(s => s.bookings);
    const setBookingsFromApi = useAppStore(s => s.setBookingsFromApi);

    // Branch selection
    const branchIdFromUrl = searchParams.get('branch');
    const activeBranchId = branchIdFromUrl
        ? (Number(branchIdFromUrl) || branchIdFromUrl)
        : branches[0]?.id;
    const activeBranch = branches.find(b => String(b.id) === String(activeBranchId));

    const [floors, setFloors] = useState([]);
    const [activeFloorId, setActiveFloorId] = useState(null);
    const [selectedObj, setSelectedObj] = useState(null);
    const [viewDate, setViewDate] = useState(todayISO());
    const [scale, setScale] = useState(0.75);
    const [pos, setPos] = useState({ x: 10, y: 10 });
    const [loading, setLoading] = useState(false);

    const containerRef = useRef(null);
    const stageRef = useRef(null);
    const [stageSize, setStageSize] = useState({ w: 900, h: 600 });

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Load schema floors + items when branch changes (filtered by branch)
    useEffect(() => {
        if (!activeBranchId) return;
        setLoading(true);
        setFloors([]); setSelectedObj(null);

        const doLoad = async () => {
            // Helper: branch field may be a plain number OR a nested object {id, name}
            const getBranchId = f => {
                const b = f.branch ?? f.branch_id;
                if (b == null) return '';
                if (typeof b === 'object') return String(b.id ?? '');
                return String(b);
            };

            let allFloors = [];
            try {
                const raw = await api.getPartnerFloors();
                const filtered = raw.filter(f => getBranchId(f) === String(activeBranchId));
                // If partner endpoint returned nothing for this branch, fall through to public
                if (filtered.length > 0) {
                    allFloors = filtered;
                } else {
                    throw new Error('empty');
                }
            } catch (_) {
                try { allFloors = await api.getPublicFloors(activeBranchId); } catch (_2) { }
            }

            return Promise.all(allFloors.map(async f => {
                let items = [];
                try { items = await api.getPartnerLayoutItems({ floor_id: f.id }); } catch (_) { }
                return { id: f.id, name: f.name, objects: items.map(apiItemToObj) };
            }));
        };

        doLoad()
            .then(lf => {
                setFloors(lf);
                setActiveFloorId(lf[0]?.id ?? null);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [activeBranchId]);

    // Load bookings for the selected date
    const refreshBookings = useCallback(async () => {
        try {
            const list = await api.getPartnerBookings();
            setBookingsFromApi(list.map(mapBookingFromApi));
        } catch (_) { }
    }, [setBookingsFromApi]);

    useEffect(() => { refreshBookings(); }, [refreshBookings]);

    const postBookingStatus = async (id, action) => {
        try {
            await api.partnerBookingStatus(id, mapUiActionToApiStatus(action), '');
            await refreshBookings();
        } catch (e) { alert(getApiError(e)); }
    };

    const activeFloor = floors.find(f => f.id === activeFloorId);
    const objects = activeFloor?.objects || [];

    // Booking for a table object on the selected date
    const getBookingForObj = (obj) => {
        if (!obj.type.startsWith('table_')) return null;
        return storeBookings.find(b =>
            b.date === viewDate &&
            b.branchId === activeBranchId &&
            b.table === obj.label &&
            !['cancelled', 'completed', 'no-show'].includes(b.status)
        ) ?? null;
    };

    // Derive live status from bookings
    const getLiveStatus = (obj) => {
        if (!obj.type.startsWith('table_')) return obj.status;
        const b = getBookingForObj(obj);
        if (!b) return 'available';
        if (b.status === 'confirmed') return 'occupied';
        if (b.status === 'pending') return 'reserved';
        return 'available';
    };

    // Counts for this floor
    const counts = {
        available: objects.filter(o => o.type.startsWith('table_') && getLiveStatus(o) === 'available').length,
        occupied: objects.filter(o => o.type.startsWith('table_') && getLiveStatus(o) === 'occupied').length,
        reserved: objects.filter(o => o.type.startsWith('table_') && getLiveStatus(o) === 'reserved').length,
    };

    const selectedBooking = selectedObj ? getBookingForObj(selectedObj) : null;
    const selectedLiveStatus = selectedObj ? getLiveStatus(selectedObj) : null;

    // Zoom
    const handleWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const pt = stage.getPointerPosition();
        const dir = e.evt.deltaY < 0 ? 1 : -1;
        const ns = Math.min(3, Math.max(0.25, scale * (1 + dir * 0.1)));
        const mp = { x: (pt.x - pos.x) / scale, y: (pt.y - pos.y) / scale };
        setScale(ns);
        setPos({ x: pt.x - mp.x * ns, y: pt.y - mp.y * ns });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Topbar title={t('nav.tableView', 'Live Floor Plan')} subtitle={activeBranch ? activeBranch.name : t('common.selectBranch', 'Select a branch')}>
                {/* Branch selector */}
                <select className="form-select" style={{ width: 200 }}
                    value={activeBranchId || ''}
                    onChange={e => { setSearchParams({ branch: e.target.value }); }}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                {/* Date picker */}
                <input type="date" className="form-input" value={viewDate}
                    onChange={e => setViewDate(e.target.value)}
                    style={{ width: 140, padding: '7px 12px', fontSize: 13 }} />

                {/* Zoom controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.max(0.25, s / 1.2))}>−</button>
                    <button onClick={() => { setScale(0.75); setPos({ x: 10, y: 10 }); }}
                        style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {Math.round(scale * 100)}%
                    </button>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.min(3, s * 1.2))}>+</button>
                </div>

                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/manual-booking')}>+ {t('bookings.newBooking', 'Walk-in')}</button>
            </Topbar>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left: schema */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Floor tabs + status counts */}
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {floors.map(f => (
                                <button key={f.id} type="button"
                                    className={`tab ${activeFloorId === f.id ? 'active' : ''}`}
                                    onClick={() => { setActiveFloorId(f.id); setSelectedObj(null); }}>
                                    {f.name}
                                </button>
                            ))}
                            {loading && <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>Loading…</span>}
                            {!loading && floors.length === 0 && (
                                <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
                                    No schema for this branch. <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/schema?branch=${activeBranchId}`)}>Create Schema →</button>
                                </span>
                            )}
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
                            {[
                                ['Available', '#22c55e', counts.available],
                                ['Occupied', '#e8192c', counts.occupied],
                                ['Reserved', '#f59e0b', counts.reserved],
                            ].map(([l, c, n]) => (
                                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                                    <span style={{ color: c, fontWeight: 700 }}>{n}</span>
                                    <span style={{ color: 'var(--text3)' }}>{l}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Konva canvas — read-only, drag to pan, scroll to zoom */}
                    <div ref={containerRef} style={{ flex: 1, background: TH.canvasBg, overflow: 'hidden', position: 'relative' }}>
                        {floors.length > 0 && (
                            <Stage
                                ref={stageRef}
                                width={stageSize.w} height={stageSize.h}
                                scaleX={scale} scaleY={scale}
                                x={pos.x} y={pos.y}
                                draggable
                                onWheel={handleWheel}
                                onDragEnd={e => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
                                onClick={e => { if (e.target === stageRef.current) setSelectedObj(null); }}
                                style={{ cursor: 'grab' }}
                            >
                                <Layer listening={false}>
                                    <GridLayer />
                                    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H}
                                        fill="transparent" stroke={TH.canvasBorder} strokeWidth={1} listening={false} />
                                    <Text x={18} y={20} text={activeFloor?.name?.toUpperCase() || ''} fontSize={11} fontStyle="700" fill={TH.textDim} letterSpacing={2} listening={false} />
                                    <Line points={[CANVAS_W / 2 - 80, CANVAS_H - 4, CANVAS_W / 2 + 80, CANVAS_H - 4]} stroke={TH.entrance} strokeWidth={4} listening={false} />
                                    <Text x={CANVAS_W / 2 - 80} y={CANVAS_H - 18} width={160} text="ENTRANCE" fontSize={9} fontStyle="700" fill={TH.entrance} align="center" letterSpacing={2} listening={false} />
                                </Layer>
                                <Layer>
                                    {objects.map(obj => (
                                        <SchemaItem
                                            key={obj.id}
                                            obj={obj}
                                            liveStatus={getLiveStatus(obj)}
                                            selected={selectedObj?.id === obj.id}
                                            onSelect={setSelectedObj}
                                        />
                                    ))}
                                </Layer>
                            </Stage>
                        )}

                        {/* Legend overlay */}
                        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(6px)' }}>
                            {Object.entries(STATUS_COLOR).filter(([k]) => k !== 'disabled').map(([s, c]) => (
                                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
                                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}` }} />
                                    <span style={{ color: '#ccc' }}>{STATUS_LABEL[s]}</span>
                                </div>
                            ))}
                        </div>

                        {/* Hint */}
                        <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            Scroll to zoom · Drag to pan · Click table for details
                        </div>
                    </div>
                </div>

                {/* Right: Table detail sidebar */}
                <div style={{ width: 290, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Table Detail</div>
                    </div>

                    {selectedObj && selectedObj.type.startsWith('table_') ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {/* Table name + status */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 34, color: STATUS_COLOR[selectedLiveStatus] || '#22c55e' }}>
                                    {selectedObj.label || selectedObj.type}
                                </div>
                                <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>
                                    {activeFloor?.name} · Zone: {selectedObj.zone || '—'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                <span className="badge" style={{ background: `${STATUS_COLOR[selectedLiveStatus] || '#22c55e'}20`, color: STATUS_COLOR[selectedLiveStatus] || '#22c55e', fontSize: 12 }}>
                                    ● {STATUS_LABEL[selectedLiveStatus] || 'Available'}
                                </span>
                                <span className="badge badge-gray">
                                    {viewDate}
                                </span>
                            </div>

                            {/* Booking info */}
                            {selectedBooking ? (
                                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                                        Active Booking #{selectedBooking.id}
                                    </div>
                                    {[
                                        { label: 'Guest', value: selectedBooking.guestName },
                                        { label: 'Phone', value: selectedBooking.phone || '—' },
                                        { label: 'Time', value: selectedBooking.time },
                                        { label: 'Guests', value: `${selectedBooking.guests} pax` },
                                    ].map(f => (
                                        <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                            <span style={{ color: 'var(--text3)' }}>{f.label}</span>
                                            <span style={{ fontWeight: 600 }}>{f.value}</span>
                                        </div>
                                    ))}
                                    {selectedBooking.note && (
                                        <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
                                            📝 "{selectedBooking.note}"
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                                    No active booking on {viewDate}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {selectedBooking?.status === 'confirmed' && (
                                    <button type="button" className="btn btn-primary" style={{ justifyContent: 'center' }}
                                        onClick={() => postBookingStatus(selectedBooking.id, 'check_in')}>
                                        ✓ Check-in Guest
                                    </button>
                                )}
                                {selectedBooking?.status === 'pending' && (
                                    <button type="button" className="btn btn-secondary" style={{ justifyContent: 'center' }}
                                        onClick={() => postBookingStatus(selectedBooking.id, 'confirm')}>
                                        ✓ Confirm Booking
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}
                                    onClick={() => navigate('/manual-booking')}>
                                    + New Walk-in Here
                                </button>
                                {selectedBooking && ['pending', 'confirmed'].includes(selectedBooking.status) && (
                                    <>
                                        <button type="button" className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }}
                                            onClick={() => { if (confirm('Cancel booking?')) postBookingStatus(selectedBooking.id, 'cancel'); }}>
                                            ✕ Cancel Booking
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }}
                                            onClick={() => { if (confirm('Mark as no-show?')) postBookingStatus(selectedBooking.id, 'no_show'); }}>
                                            No-show
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">◫</div>
                            <div className="empty-state-title">Select a Table</div>
                            <div className="empty-state-sub">Click any table on the floor plan to see details and take actions</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}