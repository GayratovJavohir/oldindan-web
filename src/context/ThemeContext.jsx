import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'kfc_theme_preference';
const ThemeContext = createContext(null);

function readStoredTheme() {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

// Tizim mavzusini aniqlash
function getSystemTheme() {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDocument(theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }) {
    // 1. Foydalanuvchi tanlagan rejim (light, dark, system)
    const [theme, setThemeState] = useState(() => {
        const stored = readStoredTheme();
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
        return 'system';
    });

    // 2. Real vaqtda qurilma (tizim) qaysi rejimdaligini saqlovchi State
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    // Tizim mavzusi o'zgarishini doimiy eshitib turish
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // 3. Ekranga chiqishi kerak bo'lgan haqiqiy rejim
    const activeTheme = theme === 'system' ? systemTheme : theme;

    // Har safar haqiqiy rejim o'zgarganda DOM'ga qo'llash
    useEffect(() => {
        applyThemeToDocument(activeTheme);
    }, [activeTheme]);

    const setTheme = useCallback((next) => {
        const value = ['light', 'dark', 'system'].includes(next) ? next : 'system';
        setThemeState(value);
        try {
            localStorage.setItem(THEME_KEY, value);
        } catch {
            // ignore
        }
    }, []);

    const toggleTheme = useCallback(() => {
        // Toggle bosilganda doim aniq light yoki dark rejimga o'tadi
        setTheme(activeTheme === 'light' ? 'dark' : 'light');
    }, [activeTheme, setTheme]);

    const value = useMemo(() => ({
        theme,           // Select uchun ('light' | 'dark' | 'system')
        activeTheme,     // Real qaysi rangdagi UI chizilayotgani ('light' | 'dark')
        isLight: activeTheme === 'light',
        isDark: activeTheme === 'dark',
        setTheme,
        toggleTheme,
    }), [theme, activeTheme, setTheme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme() must be used inside <ThemeProvider>');
    }
    return ctx;
}