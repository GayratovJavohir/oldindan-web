import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, getApiError } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute',
                top: '-20%', right: '-10%',
                width: 600, height: 600,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(232,25,44,0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-20%', left: '-10%',
                width: 500, height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(232,25,44,0.05) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ width: '100%', maxWidth: 420 }} className="animate-in">
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 56, height: 56,
                        background: 'var(--red)',
                        borderRadius: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, fontWeight: 800,
                        color: 'white',
                        fontFamily: "'Space Grotesk', sans-serif",
                        boxShadow: 'var(--shadow-red)',
                        margin: '0 auto 16px'
                    }}>R</div>
                    <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>
                        ReserveX Partner
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                        Restaurant management platform
                    </div>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 32,
                    boxShadow: 'var(--shadow)'
                }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {t('auth.signInTo')}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 24 }}>
                        {t('auth.signInTo')}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">{t('auth.email')}</label>
                            <input
                                className="form-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="partner@restaurant.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('auth.password')}</label>
                            <input
                                className="form-input"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div style={{
                                background: 'var(--red-muted)',
                                border: '1px solid rgba(232,25,44,0.2)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 14px',
                                fontSize: 13.5,
                                color: 'var(--red-light)',
                                marginBottom: 16
                            }}>⚠ {error}</div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                            disabled={loading}
                        >
                            {loading ? `⏳ ${t('auth.signingIn')}` : `→ ${t('auth.signIn')}`}
                        </button>
                    </form>

                    <div className="divider" />

                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                        Partner login (owner / manager). API: <code style={{ fontSize: 11 }}>POST /api/accounts/partner/login/</code>
                    </div>
                </div>
            </div>
        </div>
    );
}