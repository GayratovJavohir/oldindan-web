import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import uz from './locales/uz.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LANG_KEY = 'rp_lang';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            uz: { translation: uz },
            en: { translation: en },
            ru: { translation: ru },
        },
        fallbackLng: 'uz',
        lng: localStorage.getItem(LANG_KEY) || 'uz',
        supportedLngs: ['uz', 'en', 'ru'],
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage'],
            lookupLocalStorage: LANG_KEY,
            caches: ['localStorage'],
        },
    });

export function setAppLanguage(lang) {
    const next = ['uz', 'en', 'ru'].includes(lang) ? lang : 'uz';
    localStorage.setItem(LANG_KEY, next);
    return i18n.changeLanguage(next);
}

export default i18n;
