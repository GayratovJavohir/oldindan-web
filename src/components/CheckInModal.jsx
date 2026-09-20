import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import styles from '../features/pages/bookings/Bookings.module.css';
import BrandBranchSelect from './BrandBranchSelect';
import { checkInByNumber } from '../services/bookings.services';
import { getApiError } from '../utils/apiHelpers';
import { getStoredUser } from '../utils/authUser';

/** Pulls a valid 6-char booking code out of whatever a QR code contained
 * (a bare code, a JSON payload like {"booking_number":"A3X9K2"}, or a URL
 * with the code somewhere in it). Returns null if nothing usable is found. */
function extractBookingCode(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    if (/^[A-Za-z0-9]{6}$/.test(text)) return text.toUpperCase();

    try {
        const parsed = JSON.parse(text);
        const candidate = parsed?.booking_number || parsed?.bookingNumber || parsed?.code;
        if (candidate && /^[A-Za-z0-9]{6}$/.test(String(candidate))) {
            return String(candidate).toUpperCase();
        }
    } catch {
        // not JSON, fall through to regex search
    }

    const match = text.toUpperCase().match(/\b[A-Z0-9]{6}\b/);
    return match ? match[0] : null;
}

function QrScanner({ onDetected, onError }) {
    const { t } = useTranslation();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const frameRef = useRef(null);
    const streamRef = useRef(null);
    const [ready, setReady] = useState(false);

    // FIX: the scan loop is started once inside a mount-only effect, so it
    // captured the *first* `onDetected` / `onError` it ever saw. Keeping them
    // in refs means a detected code always reaches the current handler.
    const onDetectedRef = useRef(onDetected);
    const onErrorRef = useRef(onError);
    onDetectedRef.current = onDetected;
    onErrorRef.current = onError;

    useEffect(() => {
        let cancelled = false;

        async function start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setReady(true);
                tick();
            } catch (err) {
                onErrorRef.current?.(err?.message || t('bookings.cameraError'));
            }
        }

        function tick() {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const result = jsQR(imageData.data, imageData.width, imageData.height);
                if (result?.data) {
                    const code = extractBookingCode(result.data);
                    if (code) {
                        onDetectedRef.current(code);
                        return; // stop the loop once we found something usable
                    }
                }
            }
            frameRef.current = requestAnimationFrame(tick);
        }

        start();

        return () => {
            cancelled = true;
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={styles.formGroup}>
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: '#000',
                    borderRadius: 12,
                    overflow: 'hidden',
                }}
            >
                <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {!ready && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
                        {t('bookings.cameraLoading')}
                    </div>
                )}
            </div>
            <p style={{ marginTop: 8, color: '#aaa', fontSize: 12, textAlign: 'center' }}>
                {t('bookings.qrHint')}
            </p>
        </div>
    );
}

export default function CheckInModal({
    branchId: initialBranchId = null,
    bookingNumber: initialNumber = '',
    guestHint = '',
    onClose,
    onSuccess,
}) {
    const { t } = useTranslation();
    const user = getStoredUser();
    const isOwner = user?.role === 'owner';
    const assignedBranchId = user?.branchId ? String(user.branchId) : '';
    const [mode, setMode] = useState('code'); // 'code' | 'qr'
    const [bookingNumber, setBookingNumber] = useState(String(initialNumber || '').toUpperCase());
    const [branchId, setBranchId] = useState(
        initialBranchId ? String(initialBranchId) : assignedBranchId
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const runCheckIn = async (code) => {
        const bid = branchId || assignedBranchId || initialBranchId;
        if (!bid) {
            setError(t('bookings.needBranch'));
            return;
        }
        setBusy(true);
        setError('');
        setResult(null);
        try {
            const data = await checkInByNumber({
                booking_number: code,
                branch_id: Number(bid),
            });
            setResult(data);
            onSuccess?.(data);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setBusy(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        const code = bookingNumber.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            setError(t('bookings.invalidCode'));
            return;
        }
        await runCheckIn(code);
    };

    const handleQrDetected = (code) => {
        setBookingNumber(code);
        runCheckIn(code);
    };

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modalContent} style={{ maxWidth: 440 }}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{t('bookings.checkIn')}</h2>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                {!result && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 20px', marginBottom: 4 }}>
                        <button
                            type="button"
                            className={mode === 'code' ? styles.confirmBtn : styles.cancelBtn}
                            onClick={() => setMode('code')}
                        >
                            {t('bookings.checkInByCodeTab')}
                        </button>
                        <button
                            type="button"
                            className={mode === 'qr' ? styles.confirmBtn : styles.cancelBtn}
                            onClick={() => setMode('qr')}
                        >
                            {t('bookings.checkInByQrTab')}
                        </button>
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className={styles.modalBody}>
                        {guestHint && (
                            <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>
                                {t('bookings.guestLabel')}: {guestHint}
                            </p>
                        )}

                        {isOwner && !assignedBranchId && (
                            <div className={styles.formGroup}>
                                <label>{t('bookings.brandBranch')} *</label>
                                <BrandBranchSelect
                                    branchId={branchId}
                                    onBranchChange={setBranchId}
                                    fieldClassName={styles.formGroup}
                                />
                            </div>
                        )}

                        {mode === 'code' && !result && (
                            <div className={styles.formGroup}>
                                <label>{t('bookings.bookingCode')} *</label>
                                <input
                                    value={bookingNumber}
                                    onChange={(e) => setBookingNumber(
                                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                                    )}
                                    placeholder="A3X9K2"
                                    maxLength={6}
                                    autoFocus
                                    style={{
                                        letterSpacing: '0.25em',
                                        fontWeight: 700,
                                        fontSize: 20,
                                        textAlign: 'center',
                                    }}
                                    required
                                />
                            </div>
                        )}

                        {mode === 'qr' && !result && !busy && (
                            <QrScanner onDetected={handleQrDetected} onError={setError} />
                        )}

                        {mode === 'qr' && busy && (
                            <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                                {t('bookings.checkingIn')}
                            </p>
                        )}

                        {error && <div style={{ color: '#cf222e', fontSize: 14 }}>{error}</div>}
                        {result && (
                            <div style={{ color: '#7dcea0', fontSize: 14 }}>
                                ✓ {result.detail || t('bookings.checkedInOk')}
                                {result.guest ? ` — ${result.guest}` : ''}
                                {result.table ? ` · ${result.table}` : ''}
                            </div>
                        )}
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.modalCancelBtn} onClick={onClose}>
                            {result ? t('common.close') : t('common.cancel')}
                        </button>
                        {!result && mode === 'code' && (
                            <button type="submit" className={styles.modalSubmitBtn} disabled={busy}>
                                {busy ? t('bookings.checkingIn') : t('bookings.checkIn')}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

