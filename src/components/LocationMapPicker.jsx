import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [41.3111, 69.2797]; // Tashkent
const DEFAULT_ZOOM = 12;

const markerIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

/**
 * Click map to set branch latitude / longitude.
 */
export default function LocationMapPicker({
    latitude,
    longitude,
    onChange,
    height = 260,
}) {
    const { t } = useTranslation();
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
    const lng = longitude != null && longitude !== '' ? Number(longitude) : null;
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return undefined;

        const map = L.map(containerRef.current, {
            center: hasPoint ? [lat, lng] : DEFAULT_CENTER,
            zoom: hasPoint ? 15 : DEFAULT_ZOOM,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19,
        }).addTo(map);

        map.on('click', (e) => {
            const nextLat = Number(e.latlng.lat.toFixed(6));
            const nextLng = Number(e.latlng.lng.toFixed(6));
            if (markerRef.current) {
                markerRef.current.setLatLng([nextLat, nextLng]);
            } else {
                markerRef.current = L.marker([nextLat, nextLng], { icon: markerIcon }).addTo(map);
            }
            onChange?.({ latitude: nextLat, longitude: nextLng });
        });

        mapRef.current = map;

        if (hasPoint) {
            markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        }

        // Leaflet needs a tick after modal layout
        setTimeout(() => map.invalidateSize(), 80);

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !hasPoint) return;
        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        }
        map.setView([lat, lng], Math.max(map.getZoom(), 14));
    }, [lat, lng, hasPoint]);

    return (
        <div>
            <div
                ref={containerRef}
                style={{
                    height,
                    width: '100%',
                    borderRadius: 10,
                    border: '1px solid #2a2a2a',
                    overflow: 'hidden',
                    background: '#1a1a1a',
                }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#888' }}>
                <span>{t('common.lat')}: {hasPoint ? lat : '—'}</span>
                <span>{t('common.lng')}: {hasPoint ? lng : '—'}</span>
                <span style={{ marginLeft: 'auto' }}>{t('branches.clickMap')}</span>
            </div>
        </div>
    );
}
