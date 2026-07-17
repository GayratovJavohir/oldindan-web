import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import styles from './Login.module.css';
import AuthService from '../../../services/auth.services';
import { useNavigate } from 'react-router-dom';
import { getDefaultRouteForRole, getStoredUser } from '../../../utils/authUser';
import { setAppLanguage } from '../../../i18n';

export default function Login() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [accountType, setAccountType] = useState('owner');
    const [loginError, setLoginError] = useState('');
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    const onSubmit = async (data) => {
        setLoginError('');
        try {
            await AuthService.login(data.email, data.password, accountType);
            const user = getStoredUser();
            navigate(getDefaultRouteForRole(user?.role || (accountType === 'owner' ? 'owner' : 'receptionist')));
        } catch (error) {
            setLoginError(error.message || 'Email or password is incorrect.');
        }
    };

    return (
        <div className={styles.loginWrapper}>
            <div className={styles.loginCard}>
                <div className={styles.langTop}>
                    <select
                        value={i18n.language?.slice(0, 2) || 'uz'}
                        onChange={(e) => setAppLanguage(e.target.value)}
                        aria-label={t('common.language')}
                    >
                        <option value="uz">UZ</option>
                        <option value="en">EN</option>
                        <option value="ru">RU</option>
                    </select>
                </div>

                <div className={styles.logoSection}>
                    <div className={styles.logo}>OL</div>
                    <h1 className={styles.logoText}>OLDINDAN</h1>
                    <p className={styles.logoSubtext}>{t('login.subtitle')}</p>
                </div>

                <div className={styles.accountTypeTabs}>
                    <button
                        type="button"
                        className={`${styles.accountTab} ${accountType === 'owner' ? styles.accountTabActive : ''}`}
                        onClick={() => setAccountType('owner')}
                    >
                        {t('login.owner')}
                    </button>
                    <button
                        type="button"
                        className={`${styles.accountTab} ${accountType === 'staff' ? styles.accountTabActive : ''}`}
                        onClick={() => setAccountType('staff')}
                    >
                        {t('login.staff')}
                    </button>
                </div>

                <form className={styles.loginForm} onSubmit={handleSubmit(onSubmit)}>
                    {loginError && <div className={styles.errorBanner}>{loginError}</div>}

                    <div className={styles.inputGroup}>
                        <label htmlFor="email">{t('login.phone')}</label>
                        <input
                            id="email"
                            type="text"
                            placeholder={accountType === 'owner' ? 'owner@restaurant.com' : 'staff@restaurant.com'}
                            {...register('email', { required: t('common.required') })}
                            className={errors.email ? styles.inputError : ''}
                        />
                        {errors.email && <span className={styles.errorText}>{errors.email.message}</span>}
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">{t('login.password')}</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            {...register('password', {
                                required: t('common.required'),
                                minLength: { value: 6, message: t('common.required') },
                            })}
                            className={errors.password ? styles.inputError : ''}
                        />
                        {errors.password && <span className={styles.errorText}>{errors.password.message}</span>}
                    </div>

                    <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                        {isSubmitting ? t('common.loading') : t('login.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}
