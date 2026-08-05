import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/*
 * FloorCanvas3D
 * -------------
 * A real 3D (WebGL / Three.js) isometric restaurant floor-plan renderer.
 * Drop-in replacement for the 2D <FloorCanvas /> (react-konva) used in the
 * *live view* only — the drag/resize editor keeps using the original
 * FloorCanvas.jsx.
 *
 * Same prop contract as FloorCanvas.jsx:
 *   width, height, items, selectedId, statusByLayoutItemId,
 *   zoneColorById, onSelect, onHover, onBackgroundClick
 *
 * Requires: `npm install three`
 */

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
    entrance: { color: 0x4ade80, icon: '⭬', label: 'IN' },
    exit: { color: 0xe85d5d, icon: '⭭', label: 'OUT' },
    wc: { color: 0x60a5fa, icon: '🚻', label: 'WC' },
    cashier: { color: 0xf5a623, icon: '💳', label: 'CASHIER' },
    kids_area: { color: 0xf472b6, icon: '🧸', label: 'KIDS' },
    decor: { color: 0x2dd4bf, icon: '🌿', label: '' },
};

const WALL_HEIGHT = 130;
const DIVIDER_HEIGHT = 70;
const TABLE_HEIGHT = 42;

function normalizeStatus(status) {
    const raw = String(status || 'available').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
    return raw === 'checkedin' ? 'checked_in' : raw;
}

// draws text onto a canvas and returns a THREE.Sprite
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

// bakes a subtle tile pattern into a texture sized exactly to the floor plane
// so it can never visually spill past the walls (unlike a separate grid mesh)
function makeFloorTexture(width, height, tile = 42) {
    const canvas = document.createElement('canvas');
    const scale = 2; // crisper tiles
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

function buildTable(item, status, zoneColor, seats, t) {
    const group = new THREE.Group();
    const isRound = item.shape === 'round' || item.shape !== 'rect';
    const w = item.width;
    const h = item.height;
    const radius = Math.min(w, h) / 2;
    const statusColor = STATUS_COLOR[status] ?? STATUS_COLOR.facility;

    // pedestal leg
    const legGeo = isRound
        ? new THREE.CylinderGeometry(radius * 0.14, radius * 0.18, TABLE_HEIGHT * 0.8, 16)
        : new THREE.BoxGeometry(radius * 0.24, TABLE_HEIGHT * 0.8, radius * 0.24);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.3 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = TABLE_HEIGHT * 0.4;
    leg.castShadow = true;
    group.add(leg);

    // tabletop
    const topGeo = isRound
        ? new THREE.CylinderGeometry(radius, radius, TABLE_HEIGHT * 0.16, 32)
        : new THREE.BoxGeometry(w * 0.94, TABLE_HEIGHT * 0.16, h * 0.94);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.55 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = TABLE_HEIGHT * 0.82;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // status glow ring on the floor beneath the table
    const ringGeo = new THREE.RingGeometry(radius * 1.05, radius * 1.35, 40);
    const ringMat = new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);
    group.userData.ring = ring;

    // zone accent (thin colored rim under the tabletop edge)
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

    // chairs around the table
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

    // label sprite
    const seatLabel = seats ? `${item.name || t('table')}\n${seats} ${t('seats')}` : (item.name || t('table'));
    const label = makeLabelSprite(seatLabel, { fontSize: 30 });
    label.position.y = TABLE_HEIGHT + 46;
    group.add(label);

    return group;
}

function buildWall(item, kind, opacity = 1) {
    const height = kind === 'divider' ? DIVIDER_HEIGHT : WALL_HEIGHT;
    const geo = new THREE.BoxGeometry(item.width, height, Math.max(item.height, 10));
    const mat = new THREE.MeshStandardMaterial({
        color: kind === 'divider' ? 0x3a3228 : 0x4a3c28,
        roughness: 0.85,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = opacity >= 1;
    mesh.receiveShadow = true;
    return mesh;
}

function buildFacility(item, t) {
    const style = FACILITY_STYLE[item.type] || { color: 0x555555, label: item.type?.slice(0, 3).toUpperCase() || '' };
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(item.width * 0.9, 26, item.height * 0.9);
    const mat = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.6, transparent: true, opacity: 0.85 });
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

export default function FloorCanvas3D({
    width = 900,
    height = 560,
    items = [],
    selectedId = null,
    statusByLayoutItemId = {},
    zoneColorById = {},
    onSelect,
    onHover,
    onBackgroundClick,
    // eslint-disable-next-line no-unused-vars
    editable = false, // kept only for prop-compat with the 2D editor variant
}) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const [ready, setReady] = useState(false);

    // keep the latest callbacks in refs so the render-loop closures never go stale
    const cbRef = useRef({ onSelect, onHover, onBackgroundClick });
    cbRef.current = { onSelect, onHover, onBackgroundClick };

    const tt = (key) => {
        const dict = { table: 'Table', seats: 'seats', wc: 'WC', cashier: 'Cashier', kids: 'Kids area' };
        return dict[key] || '';
    };

    // ---- one-time scene / renderer / camera setup ----
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return undefined;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101010);
        scene.fog = new THREE.Fog(0x101010, 900, 2200);

        const aspect = width / height;
        const viewSize = Math.max(width, height) * 0.72;
        const camera = new THREE.OrthographicCamera(
            (-viewSize * aspect) / 2, (viewSize * aspect) / 2, viewSize / 2, -viewSize / 2, -2000, 4000
        );
        // flatter, closer-to-overhead angle (~32° from vertical) so the floor
        // reads as a level rectangle instead of a strongly skewed diamond
        camera.position.set(366, 763, 307);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.enableRotate = true;
        controls.minZoom = 0.6;
        controls.maxZoom = 2.4;
        controls.minPolarAngle = Math.PI / 6;
        controls.maxPolarAngle = Math.PI / 2.6;
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
        let lastHoverId = null;

        const pickItem = (clientX, clientY) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(group.children, true);
            const hit = hits.find((h) => h.object.userData?.itemRef);
            return hit ? hit.object.userData.itemRef : null;
        };

        const onPointerMove = (e) => {
            const found = pickItem(e.clientX, e.clientY);
            const id = found ? (found.id ?? found.tempId) : null;
            if (id !== lastHoverId) {
                lastHoverId = id;
                cbRef.current.onHover?.(found && found.type === 'table' ? found : null);
            }
            mount.style.cursor = found && found.type === 'table' ? 'pointer' : 'default';
        };

        const onClick = (e) => {
            const found = pickItem(e.clientX, e.clientY);
            if (found) cbRef.current.onSelect?.(found);
            else cbRef.current.onBackgroundClick?.();
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('click', onClick);
        renderer.domElement.addEventListener('mouseleave', () => cbRef.current.onHover?.(null));

        let rafId;
        const animate = () => {
            rafId = requestAnimationFrame(animate);
            controls.update();
            const tNow = performance.now() / 500;
            group.children.forEach((child) => {
                if (child.userData.ring) {
                    const pulse = child.userData.selected ? 0.55 + Math.sin(tNow * 4) * 0.35 : 0.5;
                    child.userData.ring.material.opacity = Math.max(0.15, pulse);
                }
            });
            renderer.render(scene, camera);
        };
        animate();

        sceneRef.current = { scene, camera, renderer, controls, group };
        setReady(true);

        const handleResize = () => {
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            setReady(false);
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('click', onClick);
            controls.dispose();
            renderer.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            sceneRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]);

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
            // All 4 perimeter walls. The two facing the camera are kept
            // semi-transparent so they read as "there" without blocking the
            // view into the room (a fully-opaque box would hide everything
            // behind the near walls from this angle).
            const t = 14;
            const perim = [
                { x: 0, y: 0, width, height: t, opacity: 1 }, // back wall
                { x: 0, y: 0, width: t, height, opacity: 1 }, // left wall
                { x: 0, y: height - t, width, height: t, opacity: 0.22 }, // front wall (near camera)
                { x: width - t, y: 0, width: t, height, opacity: 0.22 }, // right wall (near camera)
            ];
            perim.forEach((p) => {
                const wall = buildWall(p, 'wall', p.opacity);
                const pos = toWorld(p);
                wall.position.x = pos.x;
                wall.position.z = pos.z;
                group.add(wall);
            });
        }

        items.forEach((item) => {
            if (!item.isActive && item.isActive !== undefined) return;
            const pos = toWorld(item);
            let obj = null;

            if (item.type === 'table') {
                const status = normalizeStatus(statusByLayoutItemId[item.id] ?? statusByLayoutItemId[item.tempId]);
                const zoneColor = item.zoneId ? zoneColorById[item.zoneId] : null;
                const seats = item.meta?.seats || item.seats;
                obj = buildTable(item, status, zoneColor, seats, tt);
                obj.userData.selected = String(selectedId) === String(item.id ?? item.tempId);
            } else if (item.type === 'wall') {
                obj = buildWall(item, 'wall');
            } else if (item.type === 'divider') {
                obj = buildWall(item, 'divider');
            } else {
                obj = buildFacility(item, tt);
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
            style={{ width, height, borderRadius: 14, overflow: 'hidden', touchAction: 'none' }}
        />
    );
}