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
 * Props: width, height, scale, items, selectedId, editable,
 *        statusByLayoutItemId, zoneColorById, onSelect, onHover,
 *        onBackgroundClick, onItemChange
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
    entrance: { color: 0x4ade80, label: 'IN' },
    exit: { color: 0xe85d5d, label: 'OUT' },
    wc: { color: 0x60a5fa, label: 'WC' },
    cashier: { color: 0xf5a623, label: 'CASHIER' },
    kids_area: { color: 0xf472b6, label: 'KIDS' },
    decor: { color: 0x2dd4bf, label: '' },
};

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

function buildFacility(item, t, selected) {
    const style = FACILITY_STYLE[item.type] || { color: 0x555555, label: item.type?.slice(0, 3).toUpperCase() || '' };
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

    // refs so the render-loop / event closures never see stale props
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

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101010);
        scene.fog = new THREE.Fog(0x101010, 900, 2200);

        const aspect = width / height;
        const viewSize = Math.max(width, height) * 0.72;
        const camera = new THREE.OrthographicCamera(
            (-viewSize * aspect) / 2, (viewSize * aspect) / 2, viewSize / 2, -viewSize / 2, -2000, 4000
        );
        camera.position.set(302, 809, 254);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        // `scale` changes the OUTPUT resolution only — the orthographic frustum
        // above is computed from the unscaled width/height, so the same world
        // stays in view, just rendered bigger/smaller to match the container.
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
        controls.minPolarAngle = Math.PI / 7;
        controls.maxPolarAngle = Math.PI / 2.7;
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

        // ---------------- drag-to-move (editable mode only) ----------------
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
            if (!found) return; // background — handled on click
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
                // NOTE: drag.moved stays as-is until the following click event
                // reads it (see onClick) — reset there.
            }
        };

        const onClick = (e) => {
            if (drag.moved) {
                drag.moved = false; // consume the flag so background-click logic isn't tricked next time
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height, scale]);

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