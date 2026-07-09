import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import styles from './Login.module.css';
import AuthService from '../../../services/auth.services';
import { useNavigate } from 'react-router-dom';
import { getDefaultRouteForRole, getStoredUser } from '../../../utils/authUser';

export default function Login() {
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
                <div className={styles.logoSection}>
                    <div className={styles.logo}>R</div>
                    <h1 className={styles.logoText}>ReserveX Partner</h1>
                    <p className={styles.logoSubtext}>Tizimga kirish</p>
                </div>

                <div className={styles.accountTypeTabs}>
                    <button
                        type="button"
                        className={`${styles.accountTab} ${accountType === 'owner' ? styles.accountTabActive : ''}`}
                        onClick={() => setAccountType('owner')}
                    >
                        Owner
                    </button>
                    <button
                        type="button"
                        className={`${styles.accountTab} ${accountType === 'staff' ? styles.accountTabActive : ''}`}
                        onClick={() => setAccountType('staff')}
                    >
                        Staff (Manager / Receptionist)
                    </button>
                </div>

                <form className={styles.loginForm} onSubmit={handleSubmit(onSubmit)}>
                    {loginError && <div className={styles.errorBanner}>{loginError}</div>}

                    <div className={styles.inputGroup}>
                        <label htmlFor="email">Email manzili</label>
                        <input
                            id="email"
                            type="email"
                            placeholder={accountType === 'owner' ? 'owner@restaurant.com' : 'staff@restaurant.com'}
                            {...register('email', { required: 'Email kiritish majburiy!' })}
                            className={errors.email ? styles.inputError : ''}
                        />
                        {errors.email && <span className={styles.errorText}>{errors.email.message}</span>}
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">Parol</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            {...register('password', {
                                required: 'Parol kiritish majburiy!',
                                minLength: { value: 6, message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" }
                            })}
                            className={errors.password ? styles.inputError : ''}
                        />
                        {errors.password && <span className={styles.errorText}>{errors.password.message}</span>}
                    </div>

                    <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                        {isSubmitting ? '⏳ Yuklanmoqda...' : '→ Kirish'}
                    </button>
                </form>

                <div className={styles.divider}></div>
                <p className={styles.footerText}>
                    {accountType === 'owner'
                        ? 'Owner login — POST /accounts/owner/login/'
                        : 'Staff login — POST /accounts/staff/login/'}
                </p>
            </div>
        </div>
    );
}
