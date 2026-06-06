import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Circle, Line, Text, Transformer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Topbar from '../components/Topbar';
import { useAppStore } from '../store/appStore';
import { useThemeStore } from '../store/themeStore';
import { api, getApiError } from '../services/api';

// ── Backend type/shape mapping ─────────────────────────────────────────────────
const API_TYPE_MAP = {
    table_round_2: { type: 'table', shape: 'round' },
    table_round_4: { type: 'table', shape: 'round' },
    table_round_6: { type: 'table', shape: 'round' },
    table_rect_2: { type: 'table', shape: 'rect' },
    table_rect_4: { type: 'table', shape: 'rect' },
    table_rect_6: { type: 'table', shape: 'rect' },
    table_rect_8: { type: 'table', shape: 'rect' },
    sofa: { type: 'divider', shape: 'rect' },
    wall: { type: 'wall', shape: 'rect' },
    wall_v: { type: 'wall', shape: 'rect' },
    bar_counter: { type: 'divider', shape: 'rect' },
    kids: { type: 'kids_area', shape: 'icon' },
    stage: { type: 'decor', shape: 'rect' },
    entrance: { type: 'entrance', shape: 'rect' },
    stairs: { type: 'decor', shape: 'rect' },
    wc_rect: { type: 'wc', shape: 'rect' },
    cashier: { type: 'cashier', shape: 'rect' },
};

// Seats count derived from visual type (used when creating Table records)
const VISUAL_SEATS = {
    table_round_2: 2, table_round_4: 4, table_round_6: 6,
    table_rect_2: 2, table_rect_4: 4, table_rect_6: 6, table_rect_8: 8,
    sofa: 3,
};

const GRID = 20;
const CANVAS_W = 1400;
const CANVAS_H = 800;
const snap = (v, g = GRID) => Math.round(v / g) * g;

const T = {
    TABLE_ROUND_2: 'table_round_2', TABLE_ROUND_4: 'table_round_4', TABLE_ROUND_6: 'table_round_6',
    TABLE_RECT_2: 'table_rect_2', TABLE_RECT_4: 'table_rect_4', TABLE_RECT_6: 'table_rect_6',
    TABLE_RECT_8: 'table_rect_8', SOFA: 'sofa',
    WALL: 'wall', WALL_V: 'wall_v', BAR_COUNTER: 'bar_counter',
    KIDS: 'kids', STAGE: 'stage', ENTRANCE: 'entrance',
    STAIRS: 'stairs', WC_RECT: 'wc_rect', CASHIER: 'cashier',
};

const STATUS = { AVAILABLE: 'available', OCCUPIED: 'occupied', RESERVED: 'reserved', DISABLED: 'disabled' };
const STATUS_COLOR = { available: '#22c55e', occupied: '#e8192c', reserved: '#f59e0b', disabled: '#4a4a5a' };

const ZONES_DEF = {
    NONE: { label: 'No Zone', color: 'transparent' },
    WINDOW: { label: 'Window', color: '#3b82f6' },
    CENTER: { label: 'Center', color: '#8b5cf6' },
    BAR: { label: 'Bar', color: '#f59e0b' },
    PRIVATE: { label: 'Private', color: '#ef4444' },
    TERRACE: { label: 'Terrace', color: '#06b6d4' },
    VIP: { label: 'VIP', color: '#ec4899' },
};

const DEFAULT_SIZES = {
    [T.TABLE_ROUND_2]: { w: 70, h: 70 }, [T.TABLE_ROUND_4]: { w: 90, h: 90 },
    [T.TABLE_ROUND_6]: { w: 110, h: 110 }, [T.TABLE_RECT_2]: { w: 80, h: 60 },
    [T.TABLE_RECT_4]: { w: 100, h: 70 }, [T.TABLE_RECT_6]: { w: 140, h: 80 },
    [T.TABLE_RECT_8]: { w: 180, h: 80 }, [T.SOFA]: { w: 140, h: 60 },
    [T.WALL]: { w: 200, h: 16 }, [T.WALL_V]: { w: 16, h: 200 },
    [T.BAR_COUNTER]: { w: 200, h: 60 }, [T.KIDS]: { w: 160, h: 120 },
    [T.STAGE]: { w: 240, h: 120 }, [T.ENTRANCE]: { w: 120, h: 40 },
    [T.STAIRS]: { w: 100, h: 100 }, [T.WC_RECT]: { w: 80, h: 80 },
    [T.CASHIER]: { w: 120, h: 60 },
};

const TOOL_GROUPS = [
    { group: 'Select', tools: [{ type: 'select', icon: '↖', label: 'Select', key: 'V' }] },
    {
        group: 'Round Tables', tools: [
            { type: T.TABLE_ROUND_2, icon: '⬤', label: '2p Round', key: null },
            { type: T.TABLE_ROUND_4, icon: '⬤', label: '4p Round', key: 'R' },
            { type: T.TABLE_ROUND_6, icon: '⬤', label: '6p Round', key: null },
        ]
    },
    {
        group: 'Rect Tables', tools: [
            { type: T.TABLE_RECT_2, icon: '▬', label: '2p Rect', key: null },
            { type: T.TABLE_RECT_4, icon: '▬', label: '4p Rect', key: 'T' },
            { type: T.TABLE_RECT_6, icon: '▬', label: '6p Rect', key: null },
            { type: T.TABLE_RECT_8, icon: '▬', label: '8p Rect', key: null },
        ]
    },
    { group: 'Seating', tools: [{ type: T.SOFA, icon: '⊟', label: 'Sofa', key: null }] },
    {
        group: 'Structure', tools: [
            { type: T.WALL, icon: '▬', label: 'Wall H', key: 'W' },
            { type: T.WALL_V, icon: '▮', label: 'Wall V', key: null },
            { type: T.STAIRS, icon: '⊞', label: 'Stairs', key: null },
            { type: T.ENTRANCE, icon: '⛛', label: 'Entrance', key: null },
        ]
    },
    {
        group: 'Facilities', tools: [
            { type: T.WC_RECT, icon: '🚻', label: 'WC', key: null },
            { type: T.CASHIER, icon: '💳', label: 'Cashier', key: null },
            { type: T.BAR_COUNTER, icon: '🍺', label: 'Bar', key: 'B' },
            { type: T.KIDS, icon: '🎠', label: 'Kids', key: null },
            { type: T.STAGE, icon: '🎭', label: 'Stage', key: null },
        ]
    },
];

const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.tools);
const isTableType = type => type && type.startsWith('table_');

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
    dark: {
        name: 'Dark Pro', icon: '🌑', canvasBg: '#16161a',
        gridMinor: 'rgba(255,255,255,0.032)', gridMajor: 'rgba(255,255,255,0.065)',
        available: { fill: 'rgba(34,197,94,0.13)', stroke: '#22c55e' },
        occupied: { fill: 'rgba(232,25,44,0.18)', stroke: '#e8192c' },
        reserved: { fill: 'rgba(245,158,11,0.15)', stroke: '#f59e0b' },
        disabled: { fill: 'rgba(60,60,70,0.3)', stroke: '#4a4a5a' },
        wall: { fill: 'rgba(100,100,110,0.8)', stroke: '#78716c' },
        facility: { fill: 'rgba(139,92,246,0.18)', stroke: '#a78bfa' },
        decor: { fill: 'rgba(34,197,94,0.15)', stroke: '#4ade80' },
        neutral: { fill: 'rgba(80,80,90,0.5)', stroke: '#9ca3af' },
        seatFill: 'rgba(255,255,255,0.15)', seatStroke: 'rgba(255,255,255,0.06)',
        textDim: 'rgba(255,255,255,0.3)', tableMeta: 'rgba(255,255,255,0.4)',
        selStroke: '#e8192c', canvasBorder: 'rgba(255,255,255,0.06)', entrance: '#f59e0b',
    },
    light: {
        name: 'Light', icon: '☀️', canvasBg: '#f0f2f5',
        gridMinor: 'rgba(0,0,0,0.04)', gridMajor: 'rgba(0,0,0,0.09)',
        available: { fill: 'rgba(34,197,94,0.1)', stroke: '#16a34a' },
        occupied: { fill: 'rgba(220,38,38,0.1)', stroke: '#dc2626' },
        reserved: { fill: 'rgba(217,119,6,0.1)', stroke: '#d97706' },
        disabled: { fill: 'rgba(200,200,210,0.3)', stroke: '#9ca3af' },
        wall: { fill: 'rgba(51,65,85,0.65)', stroke: '#334155' },
        facility: { fill: 'rgba(109,40,217,0.1)', stroke: '#7c3aed' },
        decor: { fill: 'rgba(22,163,74,0.1)', stroke: '#16a34a' },
        neutral: { fill: 'rgba(200,200,210,0.4)', stroke: '#94a3b8' },
        seatFill: 'rgba(0,0,0,0.12)', seatStroke: 'rgba(0,0,0,0.06)',
        textDim: 'rgba(0,0,0,0.35)', tableMeta: 'rgba(0,0,0,0.4)',
        selStroke: '#e8192c', canvasBorder: 'rgba(0,0,0,0.1)', entrance: '#d97706',
    },
    blueprint: {
        name: 'Blueprint', icon: '📐', canvasBg: '#0a1929',
        gridMinor: 'rgba(59,130,246,0.09)', gridMajor: 'rgba(59,130,246,0.18)',
        available: { fill: 'rgba(34,211,238,0.13)', stroke: '#22d3ee' },
        occupied: { fill: 'rgba(251,113,133,0.15)', stroke: '#fb7185' },
        reserved: { fill: 'rgba(251,191,36,0.13)', stroke: '#fbbf24' },
        disabled: { fill: 'rgba(100,116,139,0.15)', stroke: '#64748b' },
        wall: { fill: 'rgba(148,163,184,0.5)', stroke: '#94a3b8' },
        facility: { fill: 'rgba(167,139,250,0.15)', stroke: '#a78bfa' },
        decor: { fill: 'rgba(52,211,153,0.12)', stroke: '#34d399' },
        neutral: { fill: 'rgba(100,116,139,0.25)', stroke: '#64748b' },
        seatFill: 'rgba(148,163,184,0.2)', seatStroke: 'rgba(148,163,184,0.08)',
        textDim: 'rgba(148,163,184,0.5)', tableMeta: 'rgba(148,163,184,0.5)',
        selStroke: '#e8192c', canvasBorder: 'rgba(59,130,246,0.2)', entrance: '#fbbf24',
    },
};

// ── Shape renderers ────────────────────────────────────────────────────────────
function drawRoundTable(obj, th, seats) {
    const s = th[obj.status] || th.available;
    const cx = obj.w / 2, cy = obj.h / 2;
    const tableR = Math.min(cx, cy) - 10;
    const seatR = 8, ring = tableR + 14;
    const els = [];
    for (let i = 0; i < seats; i++) {
        const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
        els.push(<Circle key={`s${i}`} x={cx + Math.cos(a) * ring} y={cy + Math.sin(a) * ring} radius={seatR} fill={th.seatFill} stroke={th.seatStroke} strokeWidth={1} />);
    }
    els.push(
        <Circle key="t" x={cx} y={cy} radius={tableR} fill={s.fill} stroke={s.stroke} strokeWidth={2} shadowColor={s.stroke} shadowBlur={6} shadowOpacity={0.35} />,
        <Text key="l" x={0} y={cy - 10} width={obj.w} text={obj.label || ''} fontSize={11} fontStyle="bold" fill={s.stroke} align="center" />,
        <Text key="p" x={0} y={cy + 2} width={obj.w} text={`${seats}p`} fontSize={9} fill={th.tableMeta} align="center" />,
    );
    return els;
}
function drawRectTable(obj, th, seats) {
    const s = th[obj.status] || th.available;
    const { w, h } = obj; const cW = 18, cH = 11, gap = 4;
    const top = Math.ceil(seats / 2), bot = Math.floor(seats / 2); const els = [];
    for (let i = 0; i < top; i++) els.push(<Rect key={`ct${i}`} x={w / (top + 1) * (i + 1) - cW / 2} y={-cH - gap} width={cW} height={cH} cornerRadius={3} fill={th.seatFill} stroke={th.seatStroke} strokeWidth={1} />);
    for (let i = 0; i < bot; i++) els.push(<Rect key={`cb${i}`} x={w / (bot + 1) * (i + 1) - cW / 2} y={h + gap} width={cW} height={cH} cornerRadius={3} fill={th.seatFill} stroke={th.seatStroke} strokeWidth={1} />);
    els.push(
        <Rect key="t" x={0} y={0} width={w} height={h} cornerRadius={6} fill={s.fill} stroke={s.stroke} strokeWidth={2} shadowColor={s.stroke} shadowBlur={6} shadowOpacity={0.35} />,
        <Text key="l" x={0} y={h / 2 - 10} width={w} text={obj.label || ''} fontSize={11} fontStyle="bold" fill={s.stroke} align="center" />,
        <Text key="p" x={0} y={h / 2 + 2} width={w} text={`${seats}p`} fontSize={9} fill={th.tableMeta} align="center" />,
    );
    return els;
}
function drawSofa(obj, th) {
    const s = th.neutral; const { w, h } = obj; const aW = 16, bH = 18, gap = 3;
    const cnt = Math.max(2, Math.floor((w - aW * 2 + gap) / (50 + gap)));
    const cW = (w - aW * 2 - gap * (cnt - 1)) / cnt;
    const els = [
        <Rect key="bk" x={0} y={0} width={w} height={bH} cornerRadius={[6, 6, 0, 0]} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />,
        <Rect key="al" x={0} y={bH} width={aW} height={h - bH} cornerRadius={[0, 0, 4, 4]} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />,
        <Rect key="ar" x={w - aW} y={bH} width={aW} height={h - bH} cornerRadius={[0, 0, 4, 4]} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />,
    ];
    for (let i = 0; i < cnt; i++) els.push(<Rect key={`c${i}`} x={aW + i * (cW + gap)} y={bH + 4} width={cW} height={h - bH - 8} cornerRadius={4} fill={`${s.fill}90`} stroke={s.stroke} strokeWidth={1} />);
    return els;
}
const drawWall = (obj, th) => [<Rect key="w" x={0} y={0} width={obj.w} height={obj.h} fill={th.wall.fill} stroke={th.wall.stroke} strokeWidth={1} />];
const drawBarCounter = (obj, th) => { const s = th.facility; const { w, h } = obj; return [<Rect key="b" x={0} y={0} width={w} height={h} cornerRadius={[4, 4, 0, 0]} fill={s.fill} stroke={s.stroke} strokeWidth={2} />, <Rect key="t" x={0} y={0} width={w} height={8} fill={`${s.stroke}35`} />, <Text key="l" x={0} y={h / 2 - 7} width={w} text="BAR" fontSize={10} fontStyle="bold" fill={s.stroke} align="center" />]; };
const drawKids = (obj, th) => { const s = th.decor; const { w, h } = obj; return [<Rect key="a" x={0} y={0} width={w} height={h} cornerRadius={12} fill={s.fill} stroke={s.stroke} strokeWidth={2} dash={[6, 3]} />, <Text key="i" x={0} y={h / 2 - 22} width={w} text="🎠" fontSize={28} align="center" />, <Text key="l" x={0} y={h / 2 + 8} width={w} text="KIDS ZONE" fontSize={9} fontStyle="bold" fill={s.stroke} align="center" />]; };
const drawStage = (obj, th) => { const s = th.facility; const { w, h } = obj; return [<Rect key="s" x={0} y={0} width={w} height={h} cornerRadius={[10, 10, 0, 0]} fill={s.fill} stroke={s.stroke} strokeWidth={2} />, <Rect key="e" x={0} y={h - 12} width={w} height={12} fill={`${s.stroke}25`} />, <Text key="i" x={0} y={h * 0.1} width={w} text="🎭" fontSize={22} align="center" />, <Text key="l" x={0} y={h * 0.55} width={w} text="STAGE" fontSize={10} fontStyle="bold" fill={s.stroke} align="center" letterSpacing={2} />]; };
const drawEntrance = (obj, th) => { const { w, h } = obj; return [<Rect key="b" x={0} y={0} width={w} height={h} cornerRadius={6} fill={`${th.entrance}18`} stroke={th.entrance} strokeWidth={2} dash={[6, 3]} />, <Text key="l" x={0} y={h / 2 - 7} width={w} text="ENTRANCE" fontSize={9} fontStyle="bold" fill={th.entrance} align="center" letterSpacing={1.5} />]; };
const drawStairs = (obj, th) => { const s = th.neutral; const { w, h } = obj; const els = [<Rect key="bg" x={0} y={0} width={w} height={h} fill={`${s.fill}50`} stroke={s.stroke} strokeWidth={1.5} />]; for (let i = 0; i < 6; i++) els.push(<Rect key={`s${i}`} x={i * (w / 6)} y={i * (h / 6)} width={w - i * (w / 6)} height={h / 6} fill="transparent" stroke={`${s.stroke}60`} strokeWidth={0.75} />); els.push(<Text key="l" x={0} y={h / 2 - 6} width={w} text="STAIRS" fontSize={9} fontStyle="bold" fill={s.stroke} align="center" />); return els; };
const drawWcRect = (obj, th) => { const s = th.facility; const { w, h } = obj; return [<Rect key="b" x={0} y={0} width={w} height={h} fill={s.fill} stroke={s.stroke} strokeWidth={2} cornerRadius={4} />, <Text key="l" x={0} y={h / 2 - 8} width={w} text="WC" fontSize={14} fontStyle="bold" fill={s.stroke} align="center" />]; };
const drawCashier = (obj, th) => { const s = th.facility; const { w, h } = obj; return [<Rect key="b" x={0} y={0} width={w} height={h} cornerRadius={[6, 6, 0, 0]} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />, <Rect key="t" x={0} y={0} width={w} height={10} cornerRadius={[6, 6, 0, 0]} fill={`${s.stroke}30`} />, <Text key="l" x={0} y={h / 2 - 6} width={w} text="CASHIER" fontSize={8} fontStyle="bold" fill={s.stroke} align="center" />]; };

function renderShape(obj, th) {
    switch (obj.type) {
        case T.TABLE_ROUND_2: return drawRoundTable(obj, th, 2);
        case T.TABLE_ROUND_4: return drawRoundTable(obj, th, 4);
        case T.TABLE_ROUND_6: return drawRoundTable(obj, th, 6);
        case T.TABLE_RECT_2: return drawRectTable(obj, th, 2);
        case T.TABLE_RECT_4: return drawRectTable(obj, th, 4);
        case T.TABLE_RECT_6: return drawRectTable(obj, th, 6);
        case T.TABLE_RECT_8: return drawRectTable(obj, th, 8);
        case T.SOFA: return drawSofa(obj, th);
        case T.WALL: case T.WALL_V: return drawWall(obj, th);
        case T.BAR_COUNTER: return drawBarCounter(obj, th);
        case T.KIDS: return drawKids(obj, th);
        case T.STAGE: return drawStage(obj, th);
        case T.ENTRANCE: return drawEntrance(obj, th);
        case T.STAIRS: return drawStairs(obj, th);
        case T.WC_RECT: return drawWcRect(obj, th);
        case T.CASHIER: return drawCashier(obj, th);
        default: return [<Rect key="fb" x={0} y={0} width={obj.w} height={obj.h} fill="rgba(255,0,0,0.15)" stroke="red" strokeWidth={1} />];
    }
}

// ── Canvas object ──────────────────────────────────────────────────────────────
function CanvasObj({ obj, th, selected, snapEnabled, onSelect, onDragEnd, onTransformEnd }) {
    const groupRef = useRef(null); const PAD = 20;
    return (
        <Group ref={groupRef} id={`obj-${obj.id}`} x={obj.x} y={obj.y} width={obj.w} height={obj.h} rotation={obj.rotation || 0} draggable
            onClick={e => { e.cancelBubble = true; onSelect(obj.id, e.evt.shiftKey); }}
            onTap={e => { e.cancelBubble = true; onSelect(obj.id, false); }}
            onDragMove={e => { if (snapEnabled) { e.target.x(snap(e.target.x())); e.target.y(snap(e.target.y())); } }}
            onDragEnd={e => onDragEnd(obj.id, snap(e.target.x()), snap(e.target.y()))}
            onMouseEnter={e => { e.target.getStage().container().style.cursor = 'move'; }}
            onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}>
            <Rect x={-PAD} y={-PAD} width={obj.w + PAD * 2} height={obj.h + PAD * 2} fill="transparent" />
            {renderShape(obj, th)}
            {selected && <Rect x={-2} y={-2} width={obj.w + 4} height={obj.h + 4} cornerRadius={4} fill="transparent" stroke={th.selStroke} strokeWidth={1.5} dash={[5, 3]} />}
        </Group>
    );
}

function GridLayer({ th }) {
    const lines = [];
    for (let x = 0; x <= CANVAS_W; x += GRID) { const m = x % (GRID * 5) === 0; lines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke={m ? th.gridMajor : th.gridMinor} strokeWidth={1} listening={false} />); }
    for (let y = 0; y <= CANVAS_H; y += GRID) { const m = y % (GRID * 5) === 0; lines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke={m ? th.gridMajor : th.gridMinor} strokeWidth={1} listening={false} />); }
    return <>{lines}</>;
}
function BgImageLayer({ src, opacity }) {
    const [img] = useImage(src);
    if (!img) return null;
    return <KonvaImage image={img} x={0} y={0} width={CANVAS_W} height={CANVAS_H} opacity={opacity} listening={false} />;
}
function SelectionTransformer({ selectedIds, objects, layerRef, onTransformEnd }) {
    const trRef = useRef(null);
    useEffect(() => {
        if (!trRef.current || !layerRef.current) return;
        const nodes = selectedIds.map(id => layerRef.current.findOne(`#obj-${id}`)).filter(Boolean);
        trRef.current.nodes(nodes); trRef.current.getLayer()?.batchDraw();
    }, [selectedIds, objects, layerRef]);
    return (
        <Transformer ref={trRef} keepRatio={false}
            enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']}
            rotateEnabled={true} rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} rotationSnapTolerance={8}
            boundBoxFunc={(old, nb) => nb.width < 20 || nb.height < 12 ? old : nb}
            borderStroke="#e8192c" borderStrokeWidth={1.5}
            anchorFill="#fff" anchorStroke="#e8192c" anchorStrokeWidth={1.5} anchorSize={9} anchorCornerRadius={2} padding={4}
            onTransformEnd={() => {
                const node = trRef.current?.nodes()?.[0]; if (!node) return;
                const id = node.id()?.replace('obj-', '');
                const obj = objects.find(o => o.id === id); if (!obj) return;
                const sx = node.scaleX(), sy = node.scaleY(); node.scaleX(1); node.scaleY(1);
                onTransformEnd(id, { x: snap(node.x()), y: snap(node.y()), w: Math.max(20, snap(obj.w * sx)), h: Math.max(12, snap(obj.h * sy)), rotation: node.rotation() });
            }} />
    );
}

// ── ID / label ─────────────────────────────────────────────────────────────────
let _id = 1; const genId = () => `obj_${Date.now()}_${_id++}`;
let _tc = 0; const genLabel = t => isTableType(t) ? `T-${String(++_tc).padStart(2, '0')}` : t.replace(/_/g, ' ');
function makeObj(type, x, y, extra = {}) {
    const sz = DEFAULT_SIZES[type] || { w: 80, h: 60 };
    return { id: genId(), type, x: snap(x), y: snap(y), w: sz.w, h: sz.h, rotation: 0, status: STATUS.AVAILABLE, zone: 'NONE', label: genLabel(type), _apiId: null, _tableId: null, ...extra };
}

const SEED = [
    makeObj(T.WALL, 0, 0, { w: CANVAS_W, h: 16, label: '' }),
    makeObj(T.WALL, 0, CANVAS_H - 16, { w: CANVAS_W, h: 16, label: '' }),
    makeObj(T.WALL_V, 0, 0, { w: 16, h: CANVAS_H, label: '' }),
    makeObj(T.WALL_V, CANVAS_W - 16, 0, { w: 16, h: CANVAS_H, label: '' }),
    makeObj(T.TABLE_ROUND_4, 120, 120), makeObj(T.TABLE_ROUND_4, 260, 120),
    makeObj(T.TABLE_RECT_6, 420, 120), makeObj(T.BAR_COUNTER, 900, 400, { w: 240 }),
    makeObj(T.CASHIER, 60, 400), makeObj(T.ENTRANCE, 600, CANVAS_H - 56, { label: '' }),
];

// ── API helpers ────────────────────────────────────────────────────────────────
function objToLayoutItemPayload(obj, floorId) {
    const m = API_TYPE_MAP[obj.type] || { type: 'decor', shape: 'rect' };
    return {
        floor: floorId, zone: null,
        type: m.type, shape: m.shape,
        name: obj.label || obj.type,
        x: Math.round(obj.x), y: Math.round(obj.y),
        width: Math.round(obj.w), height: Math.round(obj.h),
        rotation: Math.round(obj.rotation || 0),
        z_index: 0,
        meta: { visual_type: obj.type, status: obj.status || STATUS.AVAILABLE, label: obj.label || '', zone_key: obj.zone || 'NONE' },
        is_active: true,
    };
}

function fallbackVisualType(apiType, apiShape) {
    if (apiType === 'table' && apiShape === 'round') return T.TABLE_ROUND_4;
    if (apiType === 'table') return T.TABLE_RECT_4;
    if (apiType === 'wall') return T.WALL;
    if (apiType === 'entrance') return T.ENTRANCE;
    if (apiType === 'wc') return T.WC_RECT;
    if (apiType === 'cashier') return T.CASHIER;
    if (apiType === 'kids_area') return T.KIDS;
    if (apiType === 'divider') return T.BAR_COUNTER;
    return T.STAGE;
}

/**
 * Convert API LayoutItem → canvas object.
 * tableByLayoutItem: { layoutItemId: tableId } — pre-fetched from tables API
 */
function apiItemToObj(item, tableByLayoutItem = {}) {
    const visual = item.meta?.visual_type || fallbackVisualType(item.type, item.shape);
    return {
        id: String(item.id),
        type: visual,
        x: item.x,
        y: item.y,
        w: item.width,
        h: item.height,
        rotation: item.rotation || 0,
        status: item.meta?.status || STATUS.AVAILABLE,
        label: item.meta?.label || item.name || '',
        zone: item.meta?.zone_key || 'NONE',
        _apiId: item.id,                                // LayoutItem.id
        _tableId: tableByLayoutItem[item.id] ?? null,     // Table.id (null if not yet a Table)
    };
}

function makeLocalFloor(name, objects = []) {
    return { id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, apiFloorId: null, objects };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SchemaBuilderPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const storeBranches = useAppStore(s => s.branches);
    const branchIdFromUrl = searchParams.get('branch');
    // profileBranchId is used as fallback for managers who can't access getPartnerBranches
    const [profileBranchId, setProfileBranchId] = useState(null);

    // If the store has no branches (manager role), get branch from user profile
    useEffect(() => {
        if (storeBranches.length > 0) return;
        api.getProfile().then(p => {
            const b = p?.branch ?? p?.branch_details;
            const id = typeof b === 'object' ? b?.id : (b ?? p?.branch_id ?? null);
            if (id) setProfileBranchId(id);
        }).catch(() => { });
    }, [storeBranches.length]);

    const resolvedBranchId = branchIdFromUrl
        ? (Number(branchIdFromUrl) || branchIdFromUrl)
        : storeBranches[0]?.id ?? profileBranchId ?? null;
    const selectedBranch = storeBranches.find(b => String(b.id) === String(resolvedBranchId)) || storeBranches[0];

    const [floors, setFloors] = useState(() => [makeLocalFloor('Main Hall', SEED)]);
    const [activeFloorId, setActiveFloorId] = useState(() => floors[0].id);
    const [activeTool, setActiveTool] = useState('select');
    const [selectedIds, setSelectedIds] = useState([]);

    const globalTheme = useThemeStore(s => s.theme);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentGlobalTheme = globalTheme === 'system' ? systemTheme : globalTheme;
    const [themeName, setThemeName] = useState(currentGlobalTheme);

    useEffect(() => {
        setThemeName(currentGlobalTheme);
    }, [currentGlobalTheme]);

    const [showGrid, setShowGrid] = useState(true);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [scale, setScale] = useState(0.85);
    const [pos, setPos] = useState({ x: 20, y: 20 });
    const [bgImages, setBgImages] = useState({});
    const [bgOpacity, setBgOpacity] = useState(0.25);
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [showBgPanel, setShowBgPanel] = useState(false);
    const [showThemes, setShowThemes] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [loadingFloors, setLoadingFloors] = useState(false);

    const stageRef = useRef(null); const layerRef = useRef(null);
    const fileRef = useRef(null); const importRef = useRef(null); const containerRef = useRef(null);
    const [stageSize, setStageSize] = useState({ w: 900, h: 600 });

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const th = THEMES[themeName] || THEMES.dark;
    const floor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
    const objects = floor?.objects || [];
    const counts = useMemo(() => ({
        available: objects.filter(o => isTableType(o.type) && o.status === STATUS.AVAILABLE).length,
        occupied: objects.filter(o => isTableType(o.type) && o.status === STATUS.OCCUPIED).length,
        reserved: objects.filter(o => isTableType(o.type) && o.status === STATUS.RESERVED).length,
    }), [objects]);

    // ── Load floors + layout items + tables from API ───────────────────────────
    useEffect(() => {
        if (!resolvedBranchId) return;
        setLoadingFloors(true); setSaveMsg('');

        // ── Reset canvas immediately when branch changes ──────────────────────
        // This ensures we never show stale SEED data or a previous branch's
        // schema while the API call is in-flight.
        const emptyFloor = makeLocalFloor('Main Hall');
        setFloors([emptyFloor]);
        setActiveFloorId(emptyFloor.id);
        setSelectedIds([]); setHistory([]); setFuture([]);

        // ── Load floors: try partner endpoint first, fall back to public ──────
        const loadFloors = async () => {
            // Helper: branch field may be a plain number OR a nested object {id, name}
            const getBranchId = f => {
                const b = f.branch ?? f.branch_id;
                if (b == null) return '';
                if (typeof b === 'object') return String(b.id ?? '');
                return String(b);
            };

            try {
                const raw = await api.getPartnerFloors();
                const filtered = raw.filter(f => getBranchId(f) === String(resolvedBranchId));
                // If partner endpoint returned nothing for this branch, fall through to public
                if (filtered.length > 0) return filtered;
            } catch (_) { /* fall through */ }

            // Fallback: public endpoint already scoped to branchId
            try {
                return await api.getPublicFloors(resolvedBranchId);
            } catch (_) {
                return [];
            }
        };

        loadFloors()
            .then(async raw => {
                // No floors in DB → this is a new/empty branch.
                // The canvas is already reset to an empty floor above, so just return.
                if (!raw.length) { setLoadingFloors(false); return; }

                const localFloors = await Promise.all(raw.map(async f => {
                    // 1. Get layout items for this floor
                    let items = [];
                    try { items = await api.getPartnerLayoutItems({ floor_id: f.id }); } catch (_) { }

                    // 2. Get tables for this floor → build layoutItemId → tableId map
                    //    TableSerializer returns "layout_item" = LayoutItem pk
                    let tablesList = [];
                    try {
                        tablesList = await api.getPartnerTables({
                            branch_id: resolvedBranchId,
                            floor_id: f.id,
                        });
                    } catch (_) { }

                    const tableByLayoutItem = {};
                    for (const t of tablesList) {
                        const liId = t.layout_item ?? t.layout_item_id;
                        if (liId != null) tableByLayoutItem[liId] = t.id;
                    }

                    return {
                        id: `api_${f.id}`,
                        name: f.name,
                        apiFloorId: f.id,
                        objects: items.map(item => apiItemToObj(item, tableByLayoutItem)),
                    };
                }));

                setFloors(localFloors);
                if (localFloors.length) setActiveFloorId(localFloors[0].id);
                setSelectedIds([]); setHistory([]); setFuture([]);
            })
            .catch(() => { })
            .finally(() => setLoadingFloors(false));
    }, [resolvedBranchId]);

    // ── History ────────────────────────────────────────────────────────────────
    const pushHistory = useCallback(prev => { setHistory(h => [...h, prev].slice(-40)); setFuture([]); }, []);
    const updateObjects = useCallback((newObjs, sh = true) => {
        setFloors(prev => { if (sh) pushHistory(prev); return prev.map(f => f.id === activeFloorId ? { ...f, objects: newObjs } : f); });
    }, [activeFloorId, pushHistory]);
    const undo = useCallback(() => { if (!history.length) return; setFuture(f => [floors, ...f].slice(0, 40)); setHistory(h => h.slice(0, -1)); setFloors(history[history.length - 1]); setSelectedIds([]); }, [history, floors]);
    const redo = useCallback(() => { if (!future.length) return; setHistory(h => [...h, floors].slice(-40)); setFuture(f => f.slice(1)); setFloors(future[0]); setSelectedIds([]); }, [future, floors]);

    // ── Keyboard ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const h = e => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
            if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
            if (ctrl && e.key === 'a') { e.preventDefault(); setSelectedIds(objects.map(o => o.id)); return; }
            if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
            if (e.key === 'Escape') { setSelectedIds([]); setActiveTool('select'); return; }
            const tool = ALL_TOOLS.find(t => t.key && t.key.toLowerCase() === e.key.toLowerCase());
            if (tool && !ctrl) setActiveTool(tool.type);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [objects, undo, redo, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStageClick = useCallback(e => {
        if (activeTool === 'select') return;
        const isBg = e.target === stageRef.current || e.target.name() === 'bgRect';
        if (!isBg) return;
        const pt = stageRef.current.getPointerPosition();
        const x = snap((pt.x - pos.x) / scale - (DEFAULT_SIZES[activeTool]?.w || 80) / 2);
        const y = snap((pt.y - pos.y) / scale - (DEFAULT_SIZES[activeTool]?.h || 60) / 2);
        const obj = makeObj(activeTool, x, y);
        updateObjects([...objects, obj]); setSelectedIds([obj.id]); setActiveTool('select');
    }, [activeTool, objects, pos, scale, updateObjects]);

    const handleStageMouseDown = useCallback(e => {
        if (activeTool === 'select' && (e.target === stageRef.current || e.target.name() === 'bgRect')) setSelectedIds([]);
    }, [activeTool]);

    const handleWheel = useCallback(e => {
        e.evt.preventDefault();
        const pt = stageRef.current.getPointerPosition();
        const dir = e.evt.deltaY < 0 ? 1 : -1;
        const ns = Math.min(4, Math.max(0.15, scale * (1 + dir * 0.1)));
        const mp = { x: (pt.x - pos.x) / scale, y: (pt.y - pos.y) / scale };
        setScale(ns); setPos({ x: pt.x - mp.x * ns, y: pt.y - mp.y * ns });
    }, [scale, pos]);

    const handleSelect = useCallback((id, add) => setSelectedIds(prev => add ? prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id] : [id]), []);
    const handleDragEnd = useCallback((id, x, y) => updateObjects(objects.map(o => o.id === id ? { ...o, x, y } : o), true), [objects, updateObjects]);
    const handleTransformEnd = useCallback((id, attrs) => updateObjects(objects.map(o => o.id === id ? { ...o, ...attrs } : o), true), [objects, updateObjects]);
    const deleteSelected = useCallback(() => { if (!selectedIds.length) return; updateObjects(objects.filter(o => !selectedIds.includes(o.id))); setSelectedIds([]); }, [selectedIds, objects, updateObjects]);
    const duplicateSelected = useCallback(() => { const sel = objects.filter(o => selectedIds.includes(o.id)); if (!sel.length) return; const cl = sel.map(o => ({ ...o, id: genId(), x: o.x + GRID * 2, y: o.y + GRID * 2, _apiId: null, _tableId: null })); updateObjects([...objects, ...cl]); setSelectedIds(cl.map(c => c.id)); }, [selectedIds, objects, updateObjects]);
    const updateProp = useCallback((key, val) => { if (!selectedIds.length) return; updateObjects(objects.map(o => selectedIds.includes(o.id) ? { ...o, [key]: val } : o), false); }, [selectedIds, objects, updateObjects]);

    const handleBgFile = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { setBgImages(p => ({ ...p, [activeFloorId]: ev.target.result })); setShowBgPanel(false); }; r.readAsDataURL(file); e.target.value = ''; };
    const handleExport = () => { const j = JSON.stringify({ version: 2, branchId: resolvedBranchId, floors }, null, 2); const u = URL.createObjectURL(new Blob([j], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: u, download: `layout-branch-${resolvedBranchId}.json` }).click(); URL.revokeObjectURL(u); };
    const handleImportFile = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { try { const d = JSON.parse(ev.target.result); if (d.floors) { pushHistory(floors); setFloors(d.floors); setActiveFloorId(d.floors[0]?.id); } } catch { alert('Invalid layout file'); } }; r.readAsText(file); e.target.value = ''; };

    const addFloor = () => { const f = makeLocalFloor(`Floor ${floors.length + 1}`); setFloors(p => [...p, f]); setActiveFloorId(f.id); setSelectedIds([]); };
    const deleteFloor = id => { if (floors.length <= 1) return; setFloors(p => p.filter(f => f.id !== id)); if (activeFloorId === id) setActiveFloorId(floors.find(f => f.id !== id)?.id); };

    // ── SAVE LAYOUT — creates both LayoutItems AND Table records ───────────────
    const handleSaveLayout = async () => {
        if (!resolvedBranchId) { setSaveMsg('⚠ No branch selected.'); return; }
        setSaving(true); setSaveMsg('Saving…');

        try {
            // Load ALL tables for the branch so we never accidentally re-create
            // a table that already exists under a different floor or with a stale _tableId.
            let branchAllTables = [];
            try {
                branchAllTables = await api.getPartnerTables({ branch_id: Number(resolvedBranchId) });
            } catch (_) { }
            const tableByNameBranch = {}; // name → table (branch-wide fallback)
            for (const t of branchAllTables) {
                if (t.name) tableByNameBranch[t.name] = t;
            }

            const updatedFloors = [];
            for (const fl of floors) {
                // 1. Create/update Floor
                let apiFloorId = fl.apiFloorId;
                if (!apiFloorId) {
                    const c = await api.createFloor({ branch: Number(resolvedBranchId), name: fl.name, sort_order: floors.indexOf(fl), is_active: true });
                    apiFloorId = c.id;
                } else {
                    try { await api.patchFloor(apiFloorId, { name: fl.name, sort_order: floors.indexOf(fl) }); } catch (_) { }
                }

                // 2. Fetch existing layout items to detect deletions
                let existingItems = [];
                try { existingItems = await api.getPartnerLayoutItems({ floor_id: apiFloorId }); } catch (_) { }
                const existItemIds = new Set(existingItems.map(i => i.id));
                const localApiIds = new Set(fl.objects.filter(o => o._apiId).map(o => o._apiId));

                // Soft-delete removed layout items
                for (const item of existingItems) {
                    if (!localApiIds.has(item.id)) {
                        try { await api.patchLayoutItem(item.id, { is_active: false }); } catch (_) { }
                    }
                }

                // 3. Pre-load existing tables for THIS floor only
                let floorTables = [];
                try {
                    floorTables = await api.getPartnerTables({
                        branch_id: Number(resolvedBranchId),
                        floor_id: Number(apiFloorId),
                    });
                } catch (_) { }

                // Keyed maps for fast lookup
                const tableByLI = {};  // layout_item_id → table
                const tableByName = {};  // name → table (floor-scoped only)
                for (const t of floorTables) {
                    const liId = t.layout_item ?? t.layout_item_id;
                    if (liId != null) tableByLI[Number(liId)] = t;
                    if (t.name) tableByName[t.name] = t;
                }

                // Upsert each object
                const updObjs = [];
                for (const obj of fl.objects) {
                    const liPayload = objToLayoutItemPayload(obj, apiFloorId);
                    let layoutItemId = null;

                    try {
                        if (obj._apiId && existItemIds.has(obj._apiId)) {
                            const updated = await api.patchLayoutItem(obj._apiId, liPayload);
                            layoutItemId = updated.id;
                        } else {
                            const created = await api.createLayoutItem(liPayload);
                            layoutItemId = created.id;
                        }
                    } catch (e) {
                        console.warn('[Schema] LayoutItem save failed:', getApiError(e));
                        updObjs.push(obj);
                        continue;
                    }

                    // 4. For table-type objects: upsert Table record
                    let tableId = obj._tableId ?? null;
                    if (isTableType(obj.type)) {
                        const seats = VISUAL_SEATS[obj.type] || 4;
                        // Use layoutItemId-based name — globally unique (DB PK), no cross-branch
                        // collisions possible. The visual label (obj.label) stays on the canvas.
                        const tableName = `TBL-${layoutItemId}`;
                        const tablePayload = {
                            branch: Number(resolvedBranchId),
                            floor: Number(apiFloorId),
                            zone: null,
                            layout_item: Number(layoutItemId),
                            name: tableName,
                            seats: Number(seats),
                            is_active: true,
                        };

                        // Resolve existing table: stored _tableId first, then by layout_item match
                        if (!tableId) {
                            const byLI = tableByLI[Number(layoutItemId)];
                            if (byLI) tableId = byLI.id;
                        }

                        if (tableId) {
                            // PATCH existing — safe to always send layout_item since name is unique
                            try {
                                await api.patchTable(tableId, {
                                    name: tableName,
                                    seats: Number(seats),
                                    layout_item: Number(layoutItemId),
                                    is_active: true,
                                });
                            } catch (patchErr) {
                                console.warn('[Schema] Table PATCH failed:', getApiError(patchErr), tableName);
                            }
                        } else {
                            // POST — create new Table record
                            try {
                                const newTable = await api.createTable(tablePayload);
                                tableId = newTable.id;
                                tableByLI[Number(layoutItemId)] = newTable;
                            } catch (createErr) {
                                const rawData = createErr.response?.data;
                                console.error('[Schema] Table CREATE failed:', JSON.stringify(rawData), '| payload:', JSON.stringify(tablePayload));
                            }
                        }
                    }

                    updObjs.push({ ...obj, _apiId: layoutItemId, _tableId: tableId });
                }

                updatedFloors.push({ ...fl, apiFloorId, objects: updObjs });
            }

            setFloors(updatedFloors);
            setSaveMsg('✓ Layout saved! Tables synced to DB.');
        } catch (e) {
            setSaveMsg(`⚠ ${getApiError(e)}`);
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 5000);
        }
    };

    const selObj = selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null;
    const selIsTable = selObj && isTableType(selObj.type);
    const hasBg = !!bgImages[activeFloorId];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Topbar title={t('schema.title', 'Schema Builder')} subtitle={selectedBranch ? `${t('common.branch', 'Branch')}: ${selectedBranch.name}` : t('schema.subtitle', 'Floor plan editor')}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/branches')}>← {t('branches.title', 'Branches')}</button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={undo} disabled={!history.length} style={{ opacity: history.length ? 1 : 0.35 }}>↩</button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={redo} disabled={!future.length} style={{ opacity: future.length ? 1 : 0.35 }}>↪</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.max(0.15, s / 1.2))}>−</button>
                    <button onClick={() => { setScale(0.85); setPos({ x: 20, y: 20 }); }} style={{ minWidth: 50, padding: '4px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{Math.round(scale * 100)}%</button>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setScale(s => Math.min(4, s * 1.2))}>+</button>
                </div>
                {[{ label: 'Grid', icon: '⊞', val: showGrid, set: setShowGrid }, { label: 'Snap', icon: '⊕', val: snapEnabled, set: setSnapEnabled }].map(t => (
                    <button key={t.label} onClick={() => t.set(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${t.val ? 'var(--red)' : 'var(--border)'}`, background: t.val ? 'var(--red-muted)' : 'transparent', color: t.val ? 'var(--red-light)' : 'var(--text3)', cursor: 'pointer' }}>{t.icon} {t.label}</button>
                ))}
                <div style={{ position: 'relative' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setShowThemes(v => !v); setShowBgPanel(false); }}>{THEMES[themeName].icon} Theme</button>
                    {showThemes && (
                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 8, minWidth: 160, boxShadow: 'var(--shadow)' }}>
                            {Object.entries(THEMES).map(([key, t]) => (
                                <button key={key} onClick={() => { setThemeName(key); setShowThemes(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: themeName === key ? 'var(--red-muted)' : 'transparent', color: themeName === key ? 'var(--red-light)' : 'var(--text)', fontSize: 13.5, fontWeight: themeName === key ? 700 : 500 }}>
                                    <span style={{ fontSize: 17 }}>{t.icon}</span>{t.name}{themeName === key && <span style={{ marginLeft: 'auto' }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ position: 'relative' }}>
                    <button className={`btn btn-sm ${hasBg ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => { setShowBgPanel(v => !v); setShowThemes(false); }}>🖼 {hasBg ? '● BG' : 'BG'}</button>
                    {showBgPanel && (
                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 16, width: 260, boxShadow: 'var(--shadow)' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Floor Plan Background</div>
                            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border2)', borderRadius: 10, padding: '18px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}>
                                <div style={{ fontSize: 30, marginBottom: 8 }}>📤</div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{hasBg ? 'Replace' : 'Upload floor plan'}</div>
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgFile} />
                            {hasBg && <>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}><span>Opacity</span><span>{Math.round(bgOpacity * 100)}%</span></div>
                                    <input type="range" min="0.05" max="1" step="0.05" value={bgOpacity} onChange={e => setBgOpacity(+e.target.value)} style={{ width: '100%', accentColor: 'var(--red)' }} />
                                </div>
                                <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setBgImages(p => { const n = { ...p }; delete n[activeFloorId]; return n; }); setShowBgPanel(false); }}>🗑 Remove BG</button>
                            </>}
                        </div>
                    )}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()}>↑ {t('common.import', 'Import')}</button>
                <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
                <button className="btn btn-ghost btn-sm" onClick={handleExport}>↓ {t('common.export', 'Export')}</button>
                {saveMsg && <span style={{ fontSize: 12, fontWeight: 600, color: saveMsg.startsWith('✓') ? 'var(--green)' : saveMsg.startsWith('⚠') ? 'var(--red-light)' : 'var(--text2)' }}>{saveMsg}</span>}
                <button className="btn btn-primary btn-sm" disabled={saving || loadingFloors} onClick={handleSaveLayout}>{saving ? t('schema.saving', '⏳ Saving…') : `💾 ${t('schema.saveLayout', 'Save Layout')}`}</button>
            </Topbar>

            {selectedBranch && (
                <div style={{ padding: '6px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>🏢 {selectedBranch.name}</span>
                    <span>·</span><span>{selectedBranch.address}</span>
                    <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 10, background: selectedBranch.status === 'active' ? 'rgba(34,197,94,0.15)' : 'var(--bg3)', color: selectedBranch.status === 'active' ? '#22c55e' : 'var(--text3)', fontSize: 11, fontWeight: 700 }}>{selectedBranch.status}</span>
                </div>
            )}

            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
                    {floors.map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', background: activeFloorId === f.id ? 'var(--surface2)' : 'transparent', border: `1px solid ${activeFloorId === f.id ? 'var(--border2)' : 'transparent'}`, borderRadius: 8, overflow: 'hidden' }}>
                            <button onClick={() => { setActiveFloorId(f.id); setSelectedIds([]); }} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: activeFloorId === f.id ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                                {f.name}{f.apiFloorId && <span style={{ fontSize: 9, marginLeft: 5, opacity: 0.5 }}>✓</span>}
                            </button>
                            {floors.length > 1 && <button onClick={() => deleteFloor(f.id)} style={{ padding: '4px 8px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--red-light)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; }}>×</button>}
                        </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" onClick={addFloor}>+ Floor</button>
                </div>
                <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    {[['Available', '#22c55e', counts.available], ['Occupied', '#e8192c', counts.occupied], ['Reserved', '#f59e0b', counts.reserved]].map(([l, c, n]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} /><span style={{ color: c, fontWeight: 700 }}>{n}</span> {l}
                        </div>
                    ))}
                    {loadingFloors && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Loading…</span>}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <aside style={{ width: 88, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 6px', gap: 1, overflowY: 'auto', flexShrink: 0 }}>
                    {TOOL_GROUPS.map(group => (
                        <div key={group.group} style={{ width: '100%' }}>
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px', textAlign: 'center' }}>{group.group}</div>
                            {group.tools.map(tool => {
                                const active = activeTool === tool.type;
                                return (
                                    <button key={tool.type} title={`${tool.label}${tool.key ? ` (${tool.key})` : ''}`} onClick={() => setActiveTool(tool.type)}
                                        style={{ width: '100%', padding: '7px 4px', marginBottom: 3, borderRadius: 9, background: active ? 'var(--red-muted)' : 'var(--surface)', border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, boxShadow: active ? '0 0 10px rgba(232,25,44,0.25)' : 'none', position: 'relative' }}>
                                        <span style={{ fontSize: 16, lineHeight: 1, color: active ? 'var(--red-light)' : 'var(--text2)' }}>{tool.icon}</span>
                                        <span style={{ fontSize: 8.5, fontWeight: 700, color: active ? 'var(--red-light)' : 'var(--text3)', lineHeight: 1 }}>{tool.label}</span>
                                        {tool.key && <div style={{ position: 'absolute', top: 2, right: 3, fontSize: 7, fontWeight: 800, color: active ? 'var(--red)' : 'var(--text3)', background: active ? 'var(--red-muted)' : 'var(--bg3)', padding: '1px 3px', borderRadius: 3 }}>{tool.key}</div>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', width: '100%', textAlign: 'center', fontSize: 7.5, color: 'var(--text3)', lineHeight: 1.7 }}>Del-delete<br />Ctrl+Z undo<br />Ctrl+D dupe<br />Esc cancel</div>
                </aside>

                <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0, background: th.canvasBg }} onClick={() => { setShowThemes(false); setShowBgPanel(false); }}>
                    <Stage ref={stageRef} width={stageSize.w} height={stageSize.h} scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
                        draggable={activeTool === 'select'} onWheel={handleWheel} onMouseDown={handleStageMouseDown} onClick={handleStageClick}
                        onDragEnd={e => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
                        style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}>
                        <Layer listening={false}>
                            {showGrid && <GridLayer th={th} />}
                            {bgImages[activeFloorId] && <BgImageLayer src={bgImages[activeFloorId]} opacity={bgOpacity} />}
                            <Rect name="bgRect" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="transparent" stroke={th.canvasBorder} strokeWidth={1} listening={false} />
                            {[0, 200, 400, 600, 800, 1000, 1200, 1400].map(x => <Text key={`rx${x}`} x={x + 2} y={2} text={`${x}`} fontSize={8} fill={th.textDim} listening={false} />)}
                            {[0, 100, 200, 300, 400, 500, 600, 700, 800].map(y => <Text key={`ry${y}`} x={2} y={y + 2} text={`${y}`} fontSize={8} fill={th.textDim} listening={false} />)}
                            <Text x={18} y={20} text={floor?.name?.toUpperCase() || ''} fontSize={11} fontStyle="700" fill={th.textDim} letterSpacing={2} listening={false} />
                            <Line points={[CANVAS_W / 2 - 80, CANVAS_H - 4, CANVAS_W / 2 + 80, CANVAS_H - 4]} stroke={th.entrance} strokeWidth={4} listening={false} />
                            <Text x={CANVAS_W / 2 - 80} y={CANVAS_H - 18} width={160} text="ENTRANCE" fontSize={9} fontStyle="700" fill={th.entrance} align="center" letterSpacing={2} listening={false} />
                        </Layer>
                        <Layer ref={layerRef}>
                            {objects.map(obj => (
                                <CanvasObj key={obj.id} obj={{ ...obj, w: obj.w || DEFAULT_SIZES[obj.type]?.w || 80, h: obj.h || DEFAULT_SIZES[obj.type]?.h || 60 }}
                                    th={th} selected={selectedIds.includes(obj.id)} snapEnabled={snapEnabled}
                                    onSelect={handleSelect} onDragEnd={handleDragEnd} onTransformEnd={handleTransformEnd} />
                            ))}
                            {selectedIds.length > 0 && <SelectionTransformer selectedIds={selectedIds} objects={objects} layerRef={layerRef} onTransformEnd={handleTransformEnd} />}
                        </Layer>
                    </Stage>
                    {activeTool !== 'select' && <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(232,25,44,0.9)', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>Click to place {ALL_TOOLS.find(t => t.type === activeTool)?.label} · Esc to cancel</div>}
                </div>

                <aside style={{ width: 248, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Properties</div>
                        {selectedIds.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--red-muted)', color: 'var(--red-light)' }}>{selectedIds.length} selected</span>}
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
                        {selectedIds.length === 0 && (
                            <div style={{ textAlign: 'center', marginTop: 28 }}>
                                <div style={{ fontSize: 38, opacity: 0.2, marginBottom: 12 }}>◫</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.7 }}>Select an object to edit<br />Shift+click for multi-select</div>
                                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}><div>🖱 Drag to move</div><div>↔ Resize handles</div><div>↻ Rotate</div><div>Del to delete</div></div>
                            </div>
                        )}
                        {selObj && (
                            <>
                                <div style={{ padding: '7px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16, fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                    {selObj.type.replace(/_/g, ' ')}
                                    {API_TYPE_MAP[selObj.type] && <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.5 }}>→ {API_TYPE_MAP[selObj.type].type}</span>}
                                </div>
                                {selIsTable && <PropRow label="Label"><input className="form-input" value={selObj.label || ''} onChange={e => updateProp('label', e.target.value)} style={{ fontSize: 13 }} /></PropRow>}
                                {selIsTable && <PropRow label="Status"><div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{Object.entries(STATUS_COLOR).map(([s, c]) => <button key={s} onClick={() => updateProp('status', s)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${selObj.status === s ? c : 'var(--border)'}`, background: selObj.status === s ? `${c}18` : 'var(--surface2)', color: selObj.status === s ? c : 'var(--text2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div></PropRow>}
                                {selIsTable && <PropRow label="Zone"><select className="form-select" value={selObj.zone || 'NONE'} onChange={e => updateProp('zone', e.target.value)} style={{ fontSize: 13 }}>{Object.entries(ZONES_DEF).map(([k, z]) => <option key={k} value={k}>{z.label}</option>)}</select></PropRow>}
                                <PropRow label="Position"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{[['X', 'x'], ['Y', 'y']].map(([l, k]) => <div key={k}><div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{l}</div><input className="form-input" type="number" value={Math.round(selObj[k] || 0)} step={GRID} onChange={e => updateProp(k, +e.target.value)} style={{ fontSize: 12, padding: '5px 8px' }} /></div>)}</div></PropRow>
                                <PropRow label="Size"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{[['W', 'w'], ['H', 'h']].map(([l, k]) => <div key={k}><div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{l}</div><input className="form-input" type="number" value={Math.round(selObj[k] || 0)} step={GRID} min={20} onChange={e => updateProp(k, +e.target.value)} style={{ fontSize: 12, padding: '5px 8px' }} /></div>)}</div></PropRow>
                                <PropRow label="Rotation"><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="form-input" type="number" value={Math.round(selObj.rotation || 0)} step={45} onChange={e => updateProp('rotation', +e.target.value)} style={{ fontSize: 12, padding: '5px 8px' }} /><button className="btn btn-ghost btn-sm" onClick={() => updateProp('rotation', 0)}>↺ 0°</button></div></PropRow>
                                {/* Show sync status */}
                                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, padding: '6px 8px', background: 'var(--surface2)', borderRadius: 6, lineHeight: 1.7 }}>
                                    {selObj._apiId ? `✓ LayoutItem #${selObj._apiId}` : '○ Not saved'}<br />
                                    {selIsTable && (selObj._tableId ? `✓ Table #${selObj._tableId}` : '○ Table not saved')}
                                </div>
                            </>
                        )}
                        {selectedIds.length > 1 && <PropRow label="Bulk Status"><div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{Object.entries(STATUS_COLOR).map(([s, c]) => <button key={s} onClick={() => updateProp('status', s)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />Set All {s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div></PropRow>}
                    </div>
                    {selectedIds.length > 0 && <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}><button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={duplicateSelected}>⊕ Dupe</button><button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={deleteSelected}>🗑 Delete</button></div>}
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}>Zones</div>
                        {Object.entries(ZONES_DEF).filter(([k]) => k !== 'NONE').map(([key, z]) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: z.color }} /><span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{z.label}</span><span style={{ fontSize: 11, color: 'var(--text3)' }}>{objects.filter(o => o.zone === key).length}</span></div>)}
                    </div>
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Current Floor</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{floor?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{floor?.apiFloorId ? `✓ Synced (id: ${floor.apiFloorId})` : '○ Not saved yet'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                            {objects.length} items · {objects.filter(o => isTableType(o.type)).length} tables
                            {' '}({objects.filter(o => isTableType(o.type) && o._tableId).length} in DB)
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function PropRow({ label, children }) {
    return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>{children}</div>;
}