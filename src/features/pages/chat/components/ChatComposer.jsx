import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Chat.module.css';

export default function ChatComposer({ value, onChange, onSend, disabled }) {
    const { t } = useTranslation();

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
        }
    };

    return (
        <form
            className={styles.composer}
            onSubmit={(event) => {
                event.preventDefault();
                onSend();
            }}
        >
            <textarea
                className={styles.composerInput}
                rows={1}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                disabled={disabled}
            />
            <button
                type="submit"
                className={styles.sendBtn}
                disabled={disabled || !value.trim()}
            >
                {t('chat.send')}
            </button>
        </form>
    );
}
