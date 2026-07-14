import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Group, Rect, Circle, Text, Transformer } from 'react-konva';

const STATUS_COLORS = {
    available: { fill: 'rgba(42,45,53,0.85)', stroke: '#3f3f46' },
    pending: { fill: 'rgba(121,85,23,0.35)', stroke: '#f5a623' },
    confirmed: { fill: 'rgba(24,61,119,0.35)', stroke: '#4c8bf5' },
    checked_in: { fill: 'rgba(90,39,130,0.35)', stroke: '#a463f2' },
    checkedIn: { fill: 'rgba(90,39,130,0.35)', stroke: '#a463f2' },
    occupied: { fill: 'rgba(140,25,25,0.4)', stroke: '#e85d5d' },
    facility: { fill: 'rgba(30,30,30,0.9)', stroke: '#555' },
};

function normalizeStatus(status) {
    const raw = String(status || 'available').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    if (raw === 'checkedin') return 'checked_in';
    return raw;
}

function labelForType(type) {
    const map = {
        table: 'T',
        entrance: 'IN',
        exit: 'OUT',
        wc: 'WC',
        cashier: '$$',
        kids_area: 'KIDS',
        wall: '',
        divider: '',
        decor: '•',
    };
    return map[type] ?? (type?.slice(0, 3)?.toUpperCase() || '');
}

function ItemShape({
    item,
    selected,
    editable,
    status,
    zoneColor,
    onSelect,
    onDragEnd,
    onTransformEnd,
}) {
    const shapeRef = useRef(null);
    const trRef = useRef(null);
    const liveStatus = normalizeStatus(status || (item.type === 'table' ? 'available' : 'facility'));
    const colors = STATUS_COLORS[liveStatus] || STATUS_COLORS.facility;
    const isRound = item.shape === 'round' || (item.type === 'table' && item.shape !== 'rect');
    const stroke = zoneColor || colors.stroke;

    useEffect(() => {
        if (!editable || !selected || !trRef.current || !shapeRef.current) return;
        trRef.current.nodes([shapeRef.current]);
        trRef.current.getLayer()?.batchDraw();
    }, [editable, selected, item.id, item.width, item.height, item.rotation]);

    const commonProps = {
        ref: shapeRef,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation || 0,
        fill: colors.fill,
        stroke,
        strokeWidth: selected ? 3 : 2,
        draggable: editable,
        onClick: (e) => {
            e.cancelBubble = true;
            onSelect?.(item);
        },
        onTap: (e) => {
            e.cancelBubble = true;
            onSelect?.(item);
        },
        onDragEnd: (e) => {
            onDragEnd?.(item, {
                x: Math.round(e.target.x()),
                y: Math.round(e.target.y()),
            });
        },
        onTransformEnd: () => {
            const node = shapeRef.current;
            if (!node) return;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onTransformEnd?.(item, {
                x: Math.round(node.x()),
                y: Math.round(node.y()),
                width: Math.max(16, Math.round(node.width() * scaleX)),
                height: Math.max(16, Math.round(node.height() * scaleY)),
                rotation: Math.round(node.rotation()),
            });
        },
    };

    const title = item.name || (item.type === 'table' ? 'Table' : labelForType(item.type));
    const seats = item.meta?.seats || item.seats;

    return (
        <>
            <Group>
                {isRound ? (
                    <Circle
                        {...commonProps}
                        x={item.x + item.width / 2}
                        y={item.y + item.height / 2}
                        radius={Math.min(item.width, item.height) / 2}
                        width={undefined}
                        height={undefined}
                        onDragEnd={(e) => {
                            const r = Math.min(item.width, item.height) / 2;
                            onDragEnd?.(item, {
                                x: Math.round(e.target.x() - r),
                                y: Math.round(e.target.y() - r),
                            });
                        }}
                        onTransformEnd={() => {
                            const node = shapeRef.current;
                            if (!node) return;
                            const scaleX = node.scaleX();
                            node.scaleX(1);
                            node.scaleY(1);
                            const size = Math.max(32, Math.round((Math.min(item.width, item.height)) * scaleX));
                            onTransformEnd?.(item, {
                                x: Math.round(node.x() - size / 2),
                                y: Math.round(node.y() - size / 2),
                                width: size,
                                height: size,
                                rotation: Math.round(node.rotation()),
                            });
                        }}
                    />
                ) : (
                    <Rect
                        {...commonProps}
                        cornerRadius={item.type === 'wall' || item.type === 'divider' ? 2 : 14}
                    />
                )}
                <Text
                    x={item.x}
                    y={item.y + item.height / 2 - (seats ? 12 : 6)}
                    width={item.width}
                    align="center"
                    text={title}
                    fontSize={item.type === 'table' ? 13 : 11}
                    fontStyle="bold"
                    fill="#fff"
                    listening={false}
                />
                {item.type === 'table' && seats ? (
                    <Text
                        x={item.x}
                        y={item.y + item.height / 2 + 4}
                        width={item.width}
                        align="center"
                        text={`${seats} seats`}
                        fontSize={10}
                        fill="#aaa"
                        listening={false}
                    />
                ) : null}
            </Group>
            {editable && selected ? (
                <Transformer
                    ref={trRef}
                    rotateEnabled
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 16 || newBox.height < 16) return oldBox;
                        return newBox;
                    }}
                />
            ) : null}
        </>
    );
}

export default function FloorCanvas({
    width = 960,
    height = 640,
    items = [],
    selectedId = null,
    editable = false,
    statusByLayoutItemId = {},
    zoneColorById = {},
    onSelect,
    onBackgroundClick,
    onItemChange,
}) {
    const sorted = [...items].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    return (
        <Stage
            width={width}
            height={height}
            onMouseDown={(e) => {
                if (e.target === e.target.getStage()) onBackgroundClick?.();
            }}
            onTouchStart={(e) => {
                if (e.target === e.target.getStage()) onBackgroundClick?.();
            }}
        >
            <Layer>
                {Array.from({ length: Math.ceil(width / 30) }).map((_, i) => (
                    <Rect
                        key={`vg-${i}`}
                        x={i * 30}
                        y={0}
                        width={1}
                        height={height}
                        fill="#1f1f1f"
                        listening={false}
                    />
                ))}
                {Array.from({ length: Math.ceil(height / 30) }).map((_, i) => (
                    <Rect
                        key={`hg-${i}`}
                        x={0}
                        y={i * 30}
                        width={width}
                        height={1}
                        fill="#1f1f1f"
                        listening={false}
                    />
                ))}

                {sorted.map((item) => (
                    <ItemShape
                        key={item.id || item.tempId}
                        item={item}
                        selected={String(selectedId) === String(item.id || item.tempId)}
                        editable={editable}
                        status={statusByLayoutItemId[item.id] || statusByLayoutItemId[item.tempId]}
                        zoneColor={item.zoneId ? zoneColorById[item.zoneId] : null}
                        onSelect={onSelect}
                        onDragEnd={(target, pos) => onItemChange?.(target, pos)}
                        onTransformEnd={(target, next) => onItemChange?.(target, next)}
                    />
                ))}
            </Layer>
        </Stage>
    );
}
