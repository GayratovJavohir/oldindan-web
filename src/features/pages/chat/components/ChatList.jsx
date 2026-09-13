import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Chat.module.css';

function initials(name) {
    return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?';
}

function formatListTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function ChatList({
    conversations,
    selectedId,
    search,
    filter,
    loading,
    onSearchChange,
    onFilterChange,
    onSelect,
}) {
    const { t } = useTranslation();

    return (
        <aside className={styles.listPane}>
            <div className={styles.listToolbar}>
                <input
                    className={styles.search}
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('chat.search')}
                    aria-label={t('chat.search')}
                />
                <div className={styles.filters} role="tablist">
                    <button
                        type="button"
                        className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
                        onClick={() => onFilterChange('all')}
                    >
                        {t('chat.all')}
                    </button>
                    <button
                        type="button"
                        className={`${styles.filterBtn} ${filter === 'unread' ? styles.filterBtnActive : ''}`}
                        onClick={() => onFilterChange('unread')}
                    >
                        {t('chat.unread')}
                    </button>
                </div>
            </div>

            <div className={styles.conversationList}>
                {loading && conversations.length === 0 ? (
                    <div className={styles.emptyList}>{t('common.loading')}</div>
                ) : conversations.length === 0 ? (
                    <div className={styles.emptyList}>{t('chat.emptyList')}</div>
                ) : (
                    conversations.map((item) => {
                        const unread = item.unreadCount > 0;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`${styles.conversation} ${String(selectedId) === String(item.id) ? styles.conversationActive : ''} ${unread ? styles.conversationUnread : ''}`}
                                onClick={() => onSelect(item.id)}
                            >
                                <span className={styles.avatar}>{initials(item.guest?.name)}</span>
                                <span className={styles.conversationBody}>
                                    <span className={styles.conversationTop}>
                                        <span className={styles.guestName}>{item.guest?.name}</span>
                                        <span className={styles.listTime}>{formatListTime(item.lastAt)}</span>
                                    </span>
                                    <span className={styles.conversationBottom}>
                                        <span className={styles.lastMessage}>{item.lastMessage}</span>
                                        {unread && (
                                            <span className={styles.unreadPill}>
                                                {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
