import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ChatComposer from './ChatComposer';
import styles from '../Chat.module.css';

function initials(name) {
    return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?';
}

function dateKey(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toDateString();
}

function formatDayLabel(iso, t) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return t('chat.today');
    return date.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatThread({
    conversation,
    messages,
    loading,
    draft,
    onDraftChange,
    onSend,
    sending,
    onBack,
    showBack,
}) {
    const { t } = useTranslation();
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, conversation?.id]);

    const groups = useMemo(() => {
        const result = [];
        messages.forEach((message) => {
            const key = dateKey(message.createdAt);
            const last = result[result.length - 1];
            if (!last || last.key !== key) {
                result.push({ key, label: formatDayLabel(message.createdAt, t), items: [message] });
            } else {
                last.items.push(message);
            }
        });
        return result;
    }, [messages, t]);

    if (!conversation) {
        return (
            <section className={styles.threadPane}>
                <div className={styles.emptyThread}>{t('chat.emptyThread')}</div>
            </section>
        );
    }

    const booking = conversation.booking;
    const bookingLabel = booking
        ? t('chat.booking', {
            table: booking.table,
            date: booking.date,
            time: booking.time,
            count: booking.guests,
        })
        : '';

    return (
        <section className={styles.threadPane}>
            <header className={styles.threadHeader}>
                {showBack && (
                    <button type="button" className={styles.backBtn} onClick={onBack}>
                        ← {t('chat.back')}
                    </button>
                )}
                <span className={styles.avatar}>{initials(conversation.guest?.name)}</span>
                <div className={styles.threadMeta}>
                    <strong>{conversation.guest?.name}</strong>
                    <span>{conversation.guest?.phone}</span>
                </div>
                {bookingLabel && <span className={styles.bookingChip}>{bookingLabel}</span>}
            </header>

            <div className={styles.messages}>
                {loading ? (
                    <div className={styles.emptyList}>{t('common.loading')}</div>
                ) : messages.length === 0 ? (
                    <div className={styles.emptyList}>{t('chat.noMessages')}</div>
                ) : (
                    groups.map((group) => (
                        <div key={group.key} className={styles.messageGroup}>
                            <div className={styles.daySep}>{group.label}</div>
                            {group.items.map((message) => {
                                const mine = message.sender === 'receptionist';
                                return (
                                    <div
                                        key={message.id}
                                        className={`${styles.bubbleRow} ${mine ? styles.bubbleRowMine : ''}`}
                                    >
                                        <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleGuest}`}>
                                            <p>{message.text}</p>
                                            <time>{formatTime(message.createdAt)}</time>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            <ChatComposer
                value={draft}
                onChange={onDraftChange}
                onSend={onSend}
                disabled={sending}
            />
        </section>
    );
}
