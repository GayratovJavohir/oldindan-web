import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Circle, Line, Arrow, Text } from 'react-konva';

/*
 * FloorCanvas (2D / react-konva)
 * -------------------------------
 * This replaced an earlier Three.js (WebGL) implementation that would
 * eventually freeze the tab in production — every layout/status update
 * rebuilt the whole scene graph (geometries, materials, canvas textures)
 * without disposing the old ones, which leaks GPU memory until the tab
 * locks up. Plain 2D canvas (react-konva) has no GPU context to leak and
 * is plenty fast for a floor plan, so that whole class of bug goes away.
 *
 * Used in TWO places:
 *   - LiveFloor.jsx   -> editable=false: hover/click a table to see its
 *                        live status (free / pending / occupied / ...).
 *   - LayoutFloor.jsx -> editable=true : click+drag any item to reposition
 *                        it (calls onItemChange(item, {x, y}) on release —
 *                        the same contract the old canvas used). Resizing
 *                        is handled by the Inspector's W/H fields, not by
 *                        drag-handles, to keep interactions simple and
 *                        predictable.
 *
 * Props: width, height, scale, items, selectedId, editable, theme,
 *        statusByLayoutItemId, zoneColorById, focusZoneId,
 *        onSelect, onHover, onBackgroundClick, onItemChange
 */

// ---- status colors (fill/stroke pairs) — keep in sync with the legend
// dots in Floor.module.css / LiveLayout.module.css ----
const STATUS_COLORS = {
    available: { fill: '#26282f', stroke: '#52525b' },
    pending: { fill: '#4a3512', stroke: '#f5a623' },
    confirmed: { fill: '#15304f', stroke: '#4c8bf5' },
    checked_in: { fill: '#341f4a', stroke: '#a463f2' },
    occupied: { fill: '#4a1f1f', stroke: '#e85d5d' },
    completed: { fill: '#123322', stroke: '#4ade80' },
    canceled: { fill: '#333333', stroke: '#9ca3af' },
    no_show: { fill: '#333333', stroke: '#9ca3af' },
    facility: { fill: '#242424', stroke: '#666666' },
};

// Each non-table facility gets its own color + icon so it reads instantly
// on the floor plan instead of everything looking like the same box.
const FACILITY_META = {
    entrance: { color: '#4ade80', pad: '#123322', icon: '⬇', labelKey: 'entrance' },
    exit: { color: '#e85d5d', pad: '#3a1414', icon: '⬆', labelKey: 'exit' },
    wc: { color: '#60a5fa', pad: '#132338', icon: '🚻', labelKey: 'wc' },
    cashier: { color: '#f5a623', pad: '#3a2a10', icon: '💰', labelKey: 'cashier' },
    kids_area: { color: '#f472b6', pad: '#3a1c2c', icon: '🧸', labelKey: 'kids_area' },
    decor: { color: '#2dd4bf', pad: '#123430', icon: '🌿', labelKey: 'decor' },
    stairs: { color: '#c9ccd1', pad: '#2a2c30', icon: '', labelKey: 'stairs' },
};

const THEME_BG = {
    dark: { floor: '#1b1b1b', grid: '#262626', wall: '#4a3c28' },
    light: { floor: '#f4efe4', grid: '#e2d9c4', wall: '#8a6a3e' },
};

function normalizeStatus(status) {
    const raw = String(status || 'available').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    return raw === 'checkedin' ? 'checked_in' : raw;
}

function itemKey(item) {
    return String(item?.id ?? item?.tempId ?? '');
}

// Small chair dots scattered evenly around a table — makes seat count
// immediately visible without having to read the label text.
function SeatDots({ radius, count, color }) {
    const n = Math.max(0, Math.min(10, Number(count) || 0));
    if (!n) return null;
    const dist = radius + 10;
    return (
        <>
            {Array.from({ length: n }).map((_, i) => {
                const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                return (
                    <Circle
                        key={i}
                        x={Math.cos(angle) * dist}
                        y={Math.sin(angle) * dist}
                        radius={4}
                        fill={color}
                        listening={false}
                    />
                );
            })}
        </>
    );
}

function TableNode({ item, w, h, selected, hovered, status, zoneColor, seats, title }) {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.available;
    const isRound = item.shape === 'round' || item.shape !== 'rect';
    const strokeWidth = selected ? 3.5 : (hovered ? 2.5 : 2);
    const strokeColor = selected ? '#ffffff' : (hovered ? '#e5e7eb' : colors.stroke);
    const radius = Math.min(w, h) / 2;

    return (
        <>
            {zoneColor && (
                isRound ? (
                    <Circle radius={radius + 6} stroke={zoneColor} strokeWidth={2} dash={[4, 3]} listening={false} />
                ) : (
                    <Rect
                        x={-w / 2 - 6}
                        y={-h / 2 - 6}
                        width={w + 12}
                        height={h + 12}
                        stroke={zoneColor}
                        strokeWidth={2}
                        dash={[4, 3]}
                        cornerRadius={10}
                        listening={false}
                    />
                )
            )}
            {isRound ? (
                <Circle
                    radius={radius}
                    fill={colors.fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    shadowColor={selected ? '#ffffff' : 'transparent'}
                    shadowBlur={selected ? 14 : 0}
                    shadowOpacity={0.6}
                />
            ) : (
                <Rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    cornerRadius={12}
                    fill={colors.fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    shadowColor={selected ? '#ffffff' : 'transparent'}
                    shadowBlur={selected ? 14 : 0}
                    shadowOpacity={0.6}
                />
            )}
            <SeatDots radius={radius} count={seats} color={strokeColor} />
            <Text
                y={seats ? -8 : -6}
                width={w}
                offsetX={w / 2}
                align="center"
                text={title}
                fontSize={13}
                fontStyle="600"
                fill="#ffffff"
                listening={false}
            />
            {seats ? (
                <Text
                    y={8}
                    width={w}
                    offsetX={w / 2}
                    align="center"
                    text={`${seats} 👤`}
                    fontSize={11}
                    fill="#c9c9c9"
                    listening={false}
                />
            ) : null}
        </>
    );
}

function WallNode({ w, h, selected, isDivider, theme }) {
    const palette = THEME_BG[theme] || THEME_BG.dark;
    return (
        <Rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            cornerRadius={isDivider ? 2 : 3}
            fill={isDivider ? '#3a3228' : palette.wall}
            opacity={isDivider ? 0.85 : 1}
            stroke={selected ? '#ffffff' : undefined}
            strokeWidth={selected ? 2 : 0}
        />
    );
}

function EntranceExitNode({ w, h, selected, hovered, meta, isEntrance, title }) {
    const arrowLen = Math.min(w, h) * 0.6;
    return (
        <>
            <Rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                cornerRadius={10}
                fill={meta.pad}
                stroke={selected ? '#ffffff' : (hovered ? '#e5e7eb' : meta.color)}
                strokeWidth={selected ? 3 : 2}
            />
            <Arrow
                points={isEntrance
                    ? [0, -arrowLen / 2, 0, arrowLen / 2]
                    : [0, arrowLen / 2, 0, -arrowLen / 2]}
                pointerLength={10}
                pointerWidth={10}
                fill={meta.color}
                stroke={meta.color}
                strokeWidth={4}
                listening={false}
            />
            <Text
                y={h / 2 - 16}
                width={w}
                offsetX={w / 2}
                align="center"
                text={title}
                fontSize={11}
                fontStyle="600"
                fill="#ffffff"
                listening={false}
            />
        </>
    );
}

function StairsNode({ w, h, selected, hovered, meta, title }) {
    const treads = 6;
    const gap = h / treads;
    return (
        <>
            <Rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                cornerRadius={8}
                fill={meta.pad}
                stroke={selected ? '#ffffff' : (hovered ? '#e5e7eb' : meta.color)}
                strokeWidth={selected ? 3 : 2}
            />
            {Array.from({ length: treads - 1 }).map((_, i) => (
                <Line
                    key={i}
                    points={[-w / 2 + 8, -h / 2 + gap * (i + 1), w / 2 - 8, -h / 2 + gap * (i + 1)]}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={1.5}
                    listening={false}
                />
            ))}
            <Arrow
                points={[0, h / 2 - 10, 0, -h / 2 + 10]}
                pointerLength={9}
                pointerWidth={9}
                fill="#ffffff"
                stroke="#ffffff"
                strokeWidth={2.5}
                listening={false}
            />
            <Text
                y={h / 2 - 15}
                width={w}
                offsetX={w / 2}
                align="center"
                text={title}
                fontSize={10}
                fontStyle="600"
                fill="#ffffff"
                listening={false}
            />
        </>
    );
}

function FacilityIconNode({ w, h, selected, hovered, meta, title }) {
    return (
        <>
            <Rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                cornerRadius={14}
                fill={meta.pad}
                stroke={selected ? '#ffffff' : (hovered ? '#e5e7eb' : meta.color)}
                strokeWidth={selected ? 3 : 2}
            />
            <Text
                y={meta.icon ? -h * 0.12 : -6}
                width={w}
                offsetX={w / 2}
                align="center"
                text={meta.icon}
                fontSize={Math.min(w, h) * 0.42}
                listening={false}
            />
            <Text
                y={h / 2 - 18}
                width={w}
                offsetX={w / 2}
                align="center"
                text={title}
                fontSize={10}
                fontStyle="600"
                fill="#ffffff"
                listening={false}
            />
        </>
    );
}

function ItemNode({
    item, selected, hovered, editable, status, zoneColor, theme,
    onSelect, onHoverIn, onHoverOut, onDragEnd,
}) {
    const { t } = useTranslation();
    const w = item.width;
    const h = item.height;
    const cx = item.x + w / 2;
    const cy = item.y + h / 2;
    const isTable = item.type === 'table';
    const isWallLike = item.type === 'wall' || item.type === 'divider';
    const meta = FACILITY_META[item.type];

    const title = item.name || (
        isTable ? t('layout.types.table')
            : isWallLike ? ''
                : t(`layout.types.${item.type}`, item.type)
    );

    const handleMouseEnter = (e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = editable ? 'grab' : (isTable ? 'pointer' : 'default');
        onHoverIn?.(item);
    };
    const handleMouseLeave = (e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
        onHoverOut?.();
    };

    return (
        <Group
            x={cx}
            y={cy}
            rotation={item.rotation || 0}
            draggable={editable}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => { e.cancelBubble = true; }}
            onClick={(e) => { e.cancelBubble = true; onSelect?.(item); }}
            onTap={(e) => { e.cancelBubble = true; onSelect?.(item); }}
            onDragEnd={(e) => {
                onDragEnd?.(item, {
                    x: Math.round(e.target.x() - w / 2),
                    y: Math.round(e.target.y() - h / 2),
                });
            }}
        >
            {isTable && (
                <TableNode
                    item={item}
                    w={w}
                    h={h}
                    selected={selected}
                    hovered={hovered}
                    status={status}
                    zoneColor={zoneColor}
                    seats={item.meta?.seats || item.seats}
                    title={title}
                />
            )}
            {isWallLike && (
                <WallNode w={w} h={h} selected={selected} isDivider={item.type === 'divider'} theme={theme} />
            )}
            {item.type === 'entrance' && (
                <EntranceExitNode w={w} h={h} selected={selected} hovered={hovered} meta={meta} isEntrance title={title} />
            )}
            {item.type === 'exit' && (
                <EntranceExitNode w={w} h={h} selected={selected} hovered={hovered} meta={meta} isEntrance={false} title={title} />
            )}
            {item.type === 'stairs' && (
                <StairsNode w={w} h={h} selected={selected} hovered={hovered} meta={meta} title={title} />
            )}
            {meta && !['entrance', 'exit', 'stairs'].includes(item.type) && (
                <FacilityIconNode w={w} h={h} selected={selected} hovered={hovered} meta={meta} title={title} />
            )}
        </Group>
    );
}

export default function FloorCanvas({
    width = 1100,
    height = 700,
    scale = 1,
    items = [],
    selectedId = null,
    editable = false,
    theme = 'dark',
    statusByLayoutItemId = {},
    zoneColorById = {},
    focusZoneId = 'all',
    onSelect,
    onHover,
    onBackgroundClick,
    onItemChange,
}) {
    const [hoverKey, setHoverKey] = useState(null);
    const stageRef = useRef(null);
    const palette = THEME_BG[theme] || THEME_BG.dark;

    const sorted = useMemo(
        () => [...items].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
        [items]
    );

    const hasExplicitWalls = items.some((i) => i.type === 'wall');

    const isDimmed = (item) => {
        if (!focusZoneId || focusZoneId === 'all') return false;
        if (focusZoneId === 'none') return Boolean(item.zoneId);
        return String(item.zoneId) !== String(focusZoneId);
    };

    const gridLinesV = Math.ceil(width / 40);
    const gridLinesH = Math.ceil(height / 40);

    return (
        <Stage
            ref={stageRef}
            width={width * scale}
            height={height * scale}
            scaleX={scale}
            scaleY={scale}
            style={{ borderRadius: 14, overflow: 'hidden' }}
            onMouseDown={(e) => {
                if (e.target === e.target.getStage()) onBackgroundClick?.();
            }}
            onTouchStart={(e) => {
                if (e.target === e.target.getStage()) onBackgroundClick?.();
            }}
            onMouseLeave={() => {
                setHoverKey(null);
                onHover?.(null);
            }}
        >
            <Layer listening={false}>
                <Rect x={0} y={0} width={width} height={height} fill={palette.floor} />
                {Array.from({ length: gridLinesV }).map((_, i) => (
                    <Line key={`v-${i}`} points={[i * 40, 0, i * 40, height]} stroke={palette.grid} strokeWidth={1} />
                ))}
                {Array.from({ length: gridLinesH }).map((_, i) => (
                    <Line key={`h-${i}`} points={[0, i * 40, width, i * 40]} stroke={palette.grid} strokeWidth={1} />
                ))}
                {!hasExplicitWalls && (
                    <Rect
                        x={4}
                        y={4}
                        width={width - 8}
                        height={height - 8}
                        stroke={palette.wall}
                        strokeWidth={8}
                        cornerRadius={4}
                    />
                )}
            </Layer>

            <Layer>
                {sorted.map((item) => {
                    const key = itemKey(item);
                    const status = item.type === 'table'
                        ? normalizeStatus(statusByLayoutItemId[item.id] ?? statusByLayoutItemId[item.tempId])
                        : 'facility';
                    return (
                        <Group key={key} opacity={isDimmed(item) ? 0.3 : 1}>
                            <ItemNode
                                item={item}
                                selected={String(selectedId) === key}
                                hovered={hoverKey === key}
                                editable={editable}
                                status={status}
                                zoneColor={item.zoneId ? zoneColorById[item.zoneId] : null}
                                theme={theme}
                                onSelect={onSelect}
                                onHoverIn={(hoveredItem) => {
                                    setHoverKey(key);
                                    onHover?.(hoveredItem);
                                }}
                                onHoverOut={() => {
                                    setHoverKey((prev) => (prev === key ? null : prev));
                                    onHover?.(null);
                                }}
                                onDragEnd={(target, pos) => onItemChange?.(target, pos)}
                            />
                        </Group>
                    );
                })}
            </Layer>
        </Stage>
    );
}