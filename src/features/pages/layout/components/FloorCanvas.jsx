import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/*
 * FloorCanvas (3D / Three.js)
 * ---------------------------
 * Used in TWO places:
 *   - LiveFloor.jsx   -> editable=false: click a table to select/hover it.
 *   - LayoutFloor.jsx -> editable=true : click+drag any item to reposition it
 *                        (calls onItemChange(item, {x, y}) on release, same
 *                        contract the old Konva editor used).
 *
 * Props: width, height, scale, items, selectedId, editable, theme,
 *        statusByLayoutItemId, zoneColorById, onSelect, onHover,
 *        onBackgroundClick, onItemChange
 *
 * `theme` ('dark' | 'light') only affects the void background behind the
 * room + its fog — everything else (floor tile, walls, tables) is
 * intentionally unchanged, since this is meant to look like a physical room
 * regardless of the app's UI theme. Pass it down from useTheme():
 *   const { theme } = useTheme();
 *   <FloorCanvas ... theme={theme} />
 *
 * Requires: `npm install three`
 */

// scene void + fog per app theme — keep in sync with --bg in styles.css
const SCENE_BG = {
    dark: 0x101010,
    light: 0xf4f3f1,
};

// ---- palette (kept in sync with LiveLayout.module.css legend colors) ----
const STATUS_COLOR = {
    available: 0x3f3f46,
    pending: 0xf5a623,
    confirmed: 0x4c8bf5,
    checked_in: 0xa463f2,
    checkedin: 0xa463f2,
    occupied: 0xe85d5d,
    completed: 0x4ade80,
    canceled: 0x9ca3af,
    no_show: 0x9ca3af,
    facility: 0x555555,
};

const FACILITY_STYLE = {
    entrance: { color: 0x4ade80, label: 'IN', icon: '⬇️' },
    exit: { color: 0xe85d5d, label: 'OUT', icon: '⬆️' },
    wc: { color: 0x60a5fa, label: 'WC', icon: '🚻' },
    cashier: { color: 0xf5a623, label: 'CASHIER', icon: '💰' },
    kids_area: { color: 0xf472b6, label: 'KIDS', icon: '🧸' },
    decor: { color: 0x2dd4bf, label: '', icon: '🌿' },
};

// Deterministic pseudo-random in [0,1), seeded by an integer — used so
// decorative details (ball-pit balls, foliage clusters, etc.) get a
// natural scattered look but don't jitter/reshuffle every time the scene
// rebuilds (which a real Math.random() call would cause).
function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

const WALL_HEIGHT = 130;
const DIVIDER_HEIGHT = 70;
const TABLE_HEIGHT = 42;

function normalizeStatus(status) {
    const raw = String(status || 'available').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    return raw === 'checkedin' ? 'checked_in' : raw;
}

function itemKey(item) {
    return String(item?.id ?? item?.tempId ?? '');
}

function makeLabelSprite(text, { fontSize = 34, color = '#ffffff', bg = 'rgba(15,15,15,0.72)', scale = 1 } = {}) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const padX = 24;
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const lines = text.split('\n');
    const widths = lines.map((l) => ctx.measureText(l).width);
    const w = Math.max(...widths) + padX * 2;
    const lineH = fontSize * 1.25;
    const h = lineH * lines.length + 16;
    canvas.width = w;
    canvas.height = h;

    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = bg;
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h / 2 - (lines.length - 1) * lineH / 2 + i * lineH);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    const worldScale = 0.62 * scale;
    sprite.scale.set((w / h) * 30 * worldScale, 30 * worldScale, 1);
    sprite.renderOrder = 999;
    return sprite;
}

// Renders a large emoji/pictogram onto a soft circular badge — much more
// legible at a glance than plain text, and gives each facility type (WC,
// cashier, kids area, entrance/exit...) an instantly recognizable look
// without needing custom 3D models for every icon.
function makeIconSprite(emoji, { size = 120, bg = 'rgba(15,15,15,0.55)', ring = null } = {}) {
    const canvas = document.createElement('canvas');
    const scale = 3;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    const r = (size * scale) / 2;

    ctx.beginPath();
    ctx.arc(r, r, r - 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    if (ring) {
        ctx.lineWidth = 5 * scale;
        ctx.strokeStyle = ring;
        ctx.stroke();
    }

    ctx.font = `${Math.round(size * scale * 0.56)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, r, r + size * scale * 0.03);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 998;
    return sprite;
}

// Flat arrow (used for entrance/exit floor markers) built from a 2D shape
// and extruded a couple of units so it reads as a painted floor decal
// rather than a plain box.
function makeArrowMesh(width, height, color, pointsIn = true) {
    const w = Math.min(width, height) * 0.42;
    const shape = new THREE.Shape();
    const dir = pointsIn ? 1 : -1;
    shape.moveTo(-w * 0.35, -w * dir);
    shape.lineTo(w * 0.35, -w * dir);
    shape.lineTo(w * 0.35, w * 0.15 * dir);
    shape.lineTo(w * 0.7, w * 0.15 * dir);
    shape.lineTo(0, w * dir);
    shape.lineTo(-w * 0.7, w * 0.15 * dir);
    shape.lineTo(-w * 0.35, w * 0.15 * dir);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 2;
    mesh.receiveShadow = true;
    return mesh;
}

function makeFloorTexture(width, height, tile = 42) {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e7ddc7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(150,135,100,0.35)';
    ctx.lineWidth = 1;
    const step = tile * scale;
    for (let x = 0; x <= canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
}

function tagAll(object3d, item) {
    object3d.traverse((child) => {
        if (child.isMesh) child.userData.itemRef = item;
    });
    object3d.userData.itemRef = item;
    return object3d;
}

function buildTable(item, status, zoneColor, seats, t, selected) {
    const group = new THREE.Group();
    const isRound = item.shape === 'round' || item.shape !== 'rect';
    const w = item.width;
    const h = item.height;
    const radius = Math.min(w, h) / 2;
    const statusColor = STATUS_COLOR[status] ?? STATUS_COLOR.facility;

    const legGeo = isRound
        ? new THREE.CylinderGeometry(radius * 0.14, radius * 0.18, TABLE_HEIGHT * 0.8, 16)
        : new THREE.BoxGeometry(radius * 0.24, TABLE_HEIGHT * 0.8, radius * 0.24);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.3 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = TABLE_HEIGHT * 0.4;
    leg.castShadow = true;
    group.add(leg);

    const topGeo = isRound
        ? new THREE.CylinderGeometry(radius, radius, TABLE_HEIGHT * 0.16, 32)
        : new THREE.BoxGeometry(w * 0.94, TABLE_HEIGHT * 0.16, h * 0.94);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.55 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = TABLE_HEIGHT * 0.82;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const ringGeo = new THREE.RingGeometry(radius * 1.05, radius * 1.35, 40);
    const ringMat = new THREE.MeshBasicMaterial({
        color: selected ? 0xffffff : statusColor,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);
    group.userData.ring = ring;

    if (zoneColor) {
        const rimGeo = isRound
            ? new THREE.TorusGeometry(radius * 0.98, 2.2, 8, 32)
            : new THREE.BoxGeometry(w * 0.96, 2.2, 3);
        const rimMat = new THREE.MeshStandardMaterial({ color: zoneColor, roughness: 0.4 });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = isRound ? Math.PI / 2 : 0;
        rim.position.y = TABLE_HEIGHT * 0.74;
        group.add(rim);
    }

    const seatCount = Math.max(2, Math.min(8, Number(seats) || 4));
    const chairDist = radius + 20;
    for (let i = 0; i < seatCount; i += 1) {
        const angle = (i / seatCount) * Math.PI * 2;
        const chair = new THREE.Group();
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: 0.7 });
        const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 16), seatMat);
        seatMesh.position.y = 20;
        seatMesh.castShadow = true;
        const backMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 4), seatMat);
        backMesh.position.set(0, 30, -8);
        backMesh.castShadow = true;
        chair.add(seatMesh, backMesh);
        chair.position.set(Math.cos(angle) * chairDist, 0, Math.sin(angle) * chairDist);
        chair.lookAt(0, 0, 0);
        group.add(chair);
    }

    const seatLabel = seats ? `${item.name || t('table')}\n${seats} ${t('seats')}` : (item.name || t('table'));
    const label = makeLabelSprite(seatLabel, { fontSize: 30 });
    label.position.y = TABLE_HEIGHT + 46;
    group.add(label);

    return group;
}

function buildWall(item, kind, opacity = 1, selected = false) {
    const height = kind === 'divider' ? DIVIDER_HEIGHT : WALL_HEIGHT;
    const geo = new THREE.BoxGeometry(item.width, height, Math.max(item.height, 10));
    const mat = new THREE.MeshStandardMaterial({
        color: selected ? 0x8c5a2a : (kind === 'divider' ? 0x3a3228 : 0x4a3c28),
        roughness: 0.85,
        transparent: true,
        opacity,
        depthWrite: opacity >= 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// A thin, axis-aligned floor pad every facility sits on — gives a
// consistent "footprint" so different facility types read as belonging to
// the same visual language instead of each being an unrelated box.
function buildFacilityPad(width, height, color, opacity = 0.85) {
    const geo = new THREE.BoxGeometry(width, 6, height);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 3;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function buildKidsArea(item, style, selected) {
    const group = new THREE.Group();
    const w = item.width * 0.92;
    const h = item.height * 0.92;
    const color = selected ? 0xffffff : style.color;

    group.add(buildFacilityPad(w, h, 0xfff1f6, 0.95));

    // Low candy-striped pit wall around the edge.
    const wallH = 22;
    const wallMat1 = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const wallMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const perim = [
        { x: 0, z: -h / 2 + 3, bw: w, bh: 6 },
        { x: 0, z: h / 2 - 3, bw: w, bh: 6 },
        { x: -w / 2 + 3, z: 0, bw: 6, bh: h },
        { x: w / 2 - 3, z: 0, bw: 6, bh: h },
    ];
    perim.forEach((p, i) => {
        const geo = new THREE.BoxGeometry(p.bw, wallH, p.bh);
        const mesh = new THREE.Mesh(geo, i % 2 === 0 ? wallMat1 : wallMat2);
        mesh.position.set(p.x, wallH / 2, p.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });

    // A little pile of colorful ball-pit balls, scattered but stable.
    const ballColors = [0xff6b6b, 0xffd166, 0x4dd4ac, 0x5b9bff, 0xff8fd6];
    const seedBase = (item.id ?? item.tempId ?? 1);
    const ballCount = Math.max(6, Math.min(16, Math.round((w * h) / 900)));
    for (let i = 0; i < ballCount; i += 1) {
        const rx = (seededRandom(seedBase * 7 + i * 3.1) - 0.5) * (w - 26);
        const rz = (seededRandom(seedBase * 11 + i * 5.7) - 0.5) * (h - 26);
        const radius = 9 + seededRandom(seedBase * 13 + i) * 4;
        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 14, 14),
            new THREE.MeshStandardMaterial({
                color: ballColors[i % ballColors.length],
                roughness: 0.35,
                metalness: 0.05,
            })
        );
        ball.position.set(rx, radius * 0.7 + 6, rz);
        ball.castShadow = true;
        group.add(ball);
    }

    const icon = makeIconSprite(style.icon, { bg: 'rgba(244,114,182,0.35)', ring: '#ffffff' });
    icon.position.y = wallH + 44;
    icon.scale.multiplyScalar(0.85);
    group.add(icon);

    const label = makeLabelSprite(item.name || 'Kids Area', { fontSize: 24, bg: 'rgba(20,20,20,0.7)' });
    label.position.y = wallH + 12;
    group.add(label);
    return group;
}

function buildWc(item, style, selected) {
    const group = new THREE.Group();
    const w = item.width * 0.9;
    const h = item.height * 0.9;
    const color = selected ? 0xffffff : style.color;
    group.add(buildFacilityPad(w, h, 0xdbeafe, 0.95));

    const wallMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 34, h * 0.95), wallMat);
    wall.position.y = 17;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, 30, 4), doorMat);
    door.position.set(0, 15, h * 0.475 + 2);
    group.add(door);

    const icon = makeIconSprite(style.icon, { bg: 'rgba(96,165,250,0.4)', ring: '#ffffff' });
    icon.position.y = 74;
    group.add(icon);
    return group;
}

function buildCashier(item, style, selected) {
    const group = new THREE.Group();
    const w = item.width * 0.9;
    const h = item.height * 0.9;
    const color = selected ? 0xffffff : style.color;
    group.add(buildFacilityPad(w, h, 0xfff4e0, 0.95));

    const counterMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 30, h * 0.6), counterMat);
    counter.position.set(0, 15, -h * 0.15);
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 6, h * 0.68), topMat);
    top.position.set(0, 33, -h * 0.15);
    top.castShadow = true;
    group.add(top);

    const screenMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.4 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 20, 3), screenMat);
    screen.position.set(w * 0.2, 46, -h * 0.15);
    screen.rotation.x = -0.25;
    group.add(screen);

    const icon = makeIconSprite(style.icon, { bg: 'rgba(245,166,35,0.4)', ring: '#ffffff' });
    icon.position.y = 76;
    group.add(icon);
    return group;
}

function buildEntranceExit(item, style, selected, isEntrance) {
    const group = new THREE.Group();
    const w = item.width * 0.95;
    const h = item.height * 0.95;
    const color = selected ? 0xffffff : style.color;
    group.add(buildFacilityPad(w, h, isEntrance ? 0xdcfce7 : 0xfee2e2, 0.9));
    group.add(makeArrowMesh(w, h, color, isEntrance));

    const icon = makeIconSprite(style.icon, {
        bg: isEntrance ? 'rgba(74,222,128,0.4)' : 'rgba(232,93,93,0.4)',
        ring: '#ffffff',
        size: 90,
    });
    icon.position.y = 46;
    icon.scale.multiplyScalar(0.7);
    group.add(icon);
    return group;
}

function buildDecor(item, style, selected) {
    const group = new THREE.Group();
    const radius = Math.min(item.width, item.height) * 0.32;
    const potMat = new THREE.MeshStandardMaterial({ color: selected ? 0xffffff : 0x8a5a3a, roughness: 0.7 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.55, radius * 0.9, 16), potMat);
    pot.position.y = radius * 0.45;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    const leafColors = [0x2f7d4f, 0x3f9d63, 0x2a6a43];
    const seedBase = (item.id ?? item.tempId ?? 3);
    for (let i = 0; i < 5; i += 1) {
        const s = radius * (0.55 + seededRandom(seedBase + i) * 0.35);
        const leaf = new THREE.Mesh(
            new THREE.IcosahedronGeometry(s, 0),
            new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], roughness: 0.8, flatShading: true })
        );
        const ang = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(ang) * radius * 0.25, radius * 1.1 + s * 0.4, Math.sin(ang) * radius * 0.25);
        leaf.castShadow = true;
        group.add(leaf);
    }
    return group;
}

function buildFacility(item, t, selected) {
    const style = FACILITY_STYLE[item.type] || {
        color: 0x555555,
        label: item.type?.slice(0, 3).toUpperCase() || '',
        icon: '📍',
    };

    if (item.type === 'kids_area') return buildKidsArea(item, style, selected);
    if (item.type === 'wc') return buildWc(item, style, selected);
    if (item.type === 'cashier') return buildCashier(item, style, selected);
    if (item.type === 'entrance') return buildEntranceExit(item, style, selected, true);
    if (item.type === 'exit') return buildEntranceExit(item, style, selected, false);
    if (item.type === 'decor') return buildDecor(item, style, selected);

    // Fallback for any future/unknown facility type.
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(item.width * 0.9, 26, item.height * 0.9);
    const mat = new THREE.MeshStandardMaterial({
        color: selected ? 0xffffff : style.color,
        roughness: 0.6,
        transparent: true,
        opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 13;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const label = makeLabelSprite(item.name || t(style.label?.toLowerCase()) || style.label || item.type, {
        fontSize: 26,
        bg: 'rgba(20,20,20,0.75)',
    });
    label.position.y = 60;
    group.add(label);
    return group;
}

export default function FloorCanvas({
    width = 900,
    height = 560,
    scale = 1,
    items = [],
    selectedId = null,
    editable = false,
    theme = 'dark',
    statusByLayoutItemId = {},
    zoneColorById = {},
    onSelect,
    onHover,
    onBackgroundClick,
    onItemChange,
}) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const [ready, setReady] = useState(false);

    const cbRef = useRef({ onSelect, onHover, onBackgroundClick, onItemChange });
    cbRef.current = { onSelect, onHover, onBackgroundClick, onItemChange };
    const editableRef = useRef(editable);
    editableRef.current = editable;

    const tt = (key) => {
        const dict = { table: 'Table', seats: 'seats', wc: 'WC', cashier: 'Cashier', kids: 'Kids area' };
        return dict[key] || '';
    };

    // ---- one-time scene / renderer / camera setup ----
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return undefined;

        const initialBg = SCENE_BG[theme] ?? SCENE_BG.dark;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(initialBg);
        scene.fog = new THREE.Fog(initialBg, 900, 2200);

        const aspect = width / height;
        const viewSize = Math.max(width, height) * 0.72;
        const camera = new THREE.OrthographicCamera(
            (-viewSize * aspect) / 2, (viewSize * aspect) / 2, viewSize / 2, -viewSize / 2, -2000, 4000
        );
        // Previous default (302, 809, 254) sat almost directly overhead
        // (~26° off vertical) — right at the top of the allowed rotation
        // range, which is why the room read as a flat 2D map instead of a
        // real 3D scene. This angle (~48° off vertical) gives a proper
        // isometric "diorama" look by default, so table height, chairs and
        // walls are actually visible without the user needing to rotate.
        camera.position.set(560, 640, 480);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width * scale, height * scale);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.enableRotate = true;
        controls.minZoom = 0.6;
        controls.maxZoom = 2.4;
        // Widened so the user can tilt from a near-map top-down view all the
        // way to a low, dramatic angle — the default position above sits
        // roughly in the middle of this range.
        controls.minPolarAngle = Math.PI / 8;   // ~22.5° — near top-down
        controls.maxPolarAngle = Math.PI / 2.3; // ~78°   — low, dramatic angle
        controls.target.set(0, 0, 0);
        controls.update();

        scene.add(new THREE.HemisphereLight(0xffffff, 0x14100a, 0.85));
        const dir = new THREE.DirectionalLight(0xfff2df, 1.0);
        dir.position.set(400, 700, 250);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        const shadowSize = Math.max(width, height) * 0.75;
        dir.shadow.camera.left = -shadowSize;
        dir.shadow.camera.right = shadowSize;
        dir.shadow.camera.top = shadowSize;
        dir.shadow.camera.bottom = -shadowSize;
        scene.add(dir);

        const floorGeo = new THREE.PlaneGeometry(width, height, 1, 1);
        const floorMat = new THREE.MeshStandardMaterial({
            map: makeFloorTexture(width, height),
            roughness: 0.92,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const group = new THREE.Group();
        scene.add(group);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        let lastHoverId = null;

        const setPointerFromEvent = (clientX, clientY) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        };

        const pickItem = (clientX, clientY) => {
            setPointerFromEvent(clientX, clientY);
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(group.children, true);
            const hit = hits.find((h) => h.object.userData?.itemRef);
            return hit ? hit.object.userData.itemRef : null;
        };

        const floorHit = (clientX, clientY) => {
            setPointerFromEvent(clientX, clientY);
            raycaster.setFromCamera(pointer, camera);
            const out = new THREE.Vector3();
            const hit = raycaster.ray.intersectPlane(floorPlane, out);
            return hit ? out : null;
        };

        const drag = {
            active: false,
            moved: false,
            item: null,
            mesh: null,
            offsetX: 0,
            offsetZ: 0,
            startClientX: 0,
            startClientY: 0,
        };

        const findMeshFor = (item) => group.children.find(
            (c) => c.userData.itemRef && itemKey(c.userData.itemRef) === itemKey(item)
        );

        const onPointerDown = (e) => {
            const found = pickItem(e.clientX, e.clientY);
            if (!found) return;
            controls.enabled = false;
            cbRef.current.onSelect?.(found);

            if (!editableRef.current) {
                controls.enabled = true;
                return;
            }
            const mesh = findMeshFor(found);
            if (!mesh) {
                controls.enabled = true;
                return;
            }
            const hit = floorHit(e.clientX, e.clientY);
            drag.active = true;
            drag.moved = false;
            drag.item = found;
            drag.mesh = mesh;
            drag.offsetX = hit ? mesh.position.x - hit.x : 0;
            drag.offsetZ = hit ? mesh.position.z - hit.z : 0;
            drag.startClientX = e.clientX;
            drag.startClientY = e.clientY;
        };

        const onPointerMove = (e) => {
            if (drag.active) {
                const hit = floorHit(e.clientX, e.clientY);
                if (hit) {
                    if (
                        Math.abs(e.clientX - drag.startClientX) > 2
                        || Math.abs(e.clientY - drag.startClientY) > 2
                    ) {
                        drag.moved = true;
                    }
                    drag.mesh.position.x = hit.x + drag.offsetX;
                    drag.mesh.position.z = hit.z + drag.offsetZ;
                }
                return;
            }

            const found = pickItem(e.clientX, e.clientY);
            const id = found ? itemKey(found) : null;
            if (id !== lastHoverId) {
                lastHoverId = id;
                cbRef.current.onHover?.(found && found.type === 'table' ? found : null);
            }
            mount.style.cursor = found ? (editableRef.current ? 'grab' : (found.type === 'table' ? 'pointer' : 'default')) : 'default';
        };

        const onPointerUp = () => {
            controls.enabled = true;
            if (drag.active) {
                if (drag.moved && drag.item && drag.mesh) {
                    const newX = Math.round(drag.mesh.position.x - drag.item.width / 2 + width / 2);
                    const newY = Math.round(drag.mesh.position.z - drag.item.height / 2 + height / 2);
                    cbRef.current.onItemChange?.(drag.item, { x: newX, y: newY });
                }
                drag.active = false;
                drag.item = null;
                drag.mesh = null;
            }
        };

        const onClick = (e) => {
            if (drag.moved) {
                drag.moved = false;
                return;
            }
            const found = pickItem(e.clientX, e.clientY);
            if (!found) cbRef.current.onBackgroundClick?.();
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('click', onClick);
        renderer.domElement.addEventListener('mouseleave', () => { if (!drag.active) cbRef.current.onHover?.(null); });

        let rafId;
        const NEAR_OPACITY = 0.2;
        const animate = () => {
            rafId = requestAnimationFrame(animate);
            controls.update();
            const tNow = performance.now() / 500;

            const camLen = Math.hypot(camera.position.x, camera.position.z) || 1;
            const dirX = camera.position.x / camLen;
            const dirZ = camera.position.z / camLen;
            const sideScores = { back: -dirZ, front: dirZ, left: -dirX, right: dirX };
            const nearestSide = Object.keys(sideScores).reduce(
                (best, side) => (sideScores[side] > sideScores[best] ? side : best),
                'back'
            );

            group.children.forEach((child) => {
                if (child.userData.ring) {
                    const pulse = child.userData.selected ? 0.55 + Math.sin(tNow * 4) * 0.35 : 0.5;
                    child.userData.ring.material.opacity = Math.max(0.15, pulse);
                }
                if (child.userData.autoWallSide) {
                    const targetOpacity = child.userData.autoWallSide === nearestSide ? NEAR_OPACITY : 1;
                    child.material.opacity += (targetOpacity - child.material.opacity) * 0.12;
                    child.material.depthWrite = child.material.opacity > 0.9;
                    child.castShadow = child.material.opacity > 0.9;
                }
            });
            renderer.render(scene, camera);
        };
        animate();

        sceneRef.current = { scene, camera, renderer, controls, group };
        setReady(true);

        return () => {
            setReady(false);
            cancelAnimationFrame(rafId);
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('click', onClick);
            controls.dispose();
            renderer.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            sceneRef.current = null;
        };
        // NOTE: `theme` is intentionally NOT a dependency here — the whole
        // scene/renderer must not be torn down and rebuilt just because the
        // theme flipped. See the small effect right below instead, which
        // only repaints the background + fog color live.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height, scale]);

    // ---- live theme switch: only repaints the void background + fog ----
    useEffect(() => {
        if (!ready || !sceneRef.current) return;
        const { scene } = sceneRef.current;
        const bg = SCENE_BG[theme] ?? SCENE_BG.dark;
        scene.background = new THREE.Color(bg);
        if (scene.fog) scene.fog.color.set(bg);
    }, [ready, theme]);

    // ---- rebuild the item meshes whenever data changes ----
    useEffect(() => {
        if (!ready || !sceneRef.current) return;
        const { group } = sceneRef.current;
        while (group.children.length) group.remove(group.children[0]);

        const toWorld = (item) => ({
            x: item.x + item.width / 2 - width / 2,
            z: item.y + item.height / 2 - height / 2,
        });

        const hasExplicitWalls = items.some((i) => i.type === 'wall');
        if (!hasExplicitWalls) {
            const t = 14;
            const perim = [
                { x: 0, y: 0, width, height: t, side: 'back' },
                { x: 0, y: 0, width: t, height, side: 'left' },
                { x: 0, y: height - t, width, height: t, side: 'front' },
                { x: width - t, y: 0, width: t, height, side: 'right' },
            ];
            perim.forEach((p) => {
                const wall = buildWall(p, 'wall', 1);
                wall.userData.autoWallSide = p.side;
                const pos = toWorld(p);
                wall.position.x = pos.x;
                wall.position.z = pos.z;
                group.add(wall);
            });
        }

        items.forEach((item) => {
            if (!item.isActive && item.isActive !== undefined) return;
            const pos = toWorld(item);
            const selected = itemKey(item) === String(selectedId);
            let obj = null;

            if (item.type === 'table') {
                const status = normalizeStatus(statusByLayoutItemId[item.id] ?? statusByLayoutItemId[item.tempId]);
                const zoneColor = item.zoneId ? zoneColorById[item.zoneId] : null;
                const seats = item.meta?.seats || item.seats;
                obj = buildTable(item, status, zoneColor, seats, tt, selected);
                obj.userData.selected = selected;
            } else if (item.type === 'wall') {
                obj = buildWall(item, 'wall', 1, selected);
            } else if (item.type === 'divider') {
                obj = buildWall(item, 'divider', 1, selected);
            } else {
                obj = buildFacility(item, tt, selected);
            }

            obj.position.x = pos.x;
            obj.position.z = pos.z;
            obj.rotation.y = -THREE.MathUtils.degToRad(item.rotation || 0);
            tagAll(obj, item);
            group.add(obj);
        });
    }, [ready, items, statusByLayoutItemId, zoneColorById, selectedId, width, height]);

    return (
        <div
            ref={mountRef}
            style={{ width: width * scale, height: height * scale, borderRadius: 14, overflow: 'hidden', touchAction: 'none' }}
        />
    );
}