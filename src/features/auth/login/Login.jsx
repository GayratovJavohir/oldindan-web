import React from 'react'
import { useForm } from 'react-hook-form'
import styles from './Login.module.css'
import AuthService from '../../../services/auth.services';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    const onSubmit = async (data) => {
        try {
            const result = await AuthService.login(data.email, data.password);

            if (result) {
                navigate("/dashboard");
            }

        } catch (error) {
            alert(error.response?.data?.message || "Email or password is incorrect.");
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

                <form className={styles.loginForm} onSubmit={handleSubmit(onSubmit)}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="email">Email manzili</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="partner@restaurant.com"
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
                <p className={styles.footerText}>Partner login (owner / manager)</p>
            </div>
        </div>
    )
}