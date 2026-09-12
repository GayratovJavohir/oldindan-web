import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/header/PageHeader';
import { useLayout } from '../../../context/LayoutContext';
import { useChatUnread } from '../../../context/ChatContext';
import {
    getConversations,
    getMessages,
    markConversationRead,
    sendMessage,
} from '../../../services/chat.services';
import ChatList from './components/ChatList';
import ChatThread from './components/ChatThread';
import styles from './Chat.module.css';

export default function Chat() {
    const { t } = useTranslation();
    const { isMobile } = useLayout();
    const { refreshUnread } = useChatUnread();

    const [conversations, setConversations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [draft, setDraft] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [sending, setSending] = useState(false);

    const loadConversations = useCallback(async () => {
        const list = await getConversations();
        setConversations(list);
        await refreshUnread();
        return list;
    }, [refreshUnread]);

    useEffect(() => {
        let cancelled = false;
        setLoadingList(true);
        loadConversations()
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        return () => {
            cancelled = true;
        };
    }, [loadConversations]);

    const selected = useMemo(
        () => conversations.find((item) => item.id === selectedId) || null,
        [conversations, selectedId],
    );

    const visibleConversations = useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations.filter((item) => {
            if (filter === 'unread' && !(item.unreadCount > 0)) return false;
            if (!q) return true;
            const hay = `${item.guest?.name || ''} ${item.guest?.phone || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [conversations, search, filter]);

    const openConversation = useCallback(async (id) => {
        setSelectedId(id);
        setDraft('');
        setLoadingThread(true);
        try {
            const [list] = await Promise.all([
                getMessages(id),
                markConversationRead(id),
            ]);
            setMessages(list);
            setConversations((prev) =>
                prev.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item)),
            );
            await refreshUnread();
        } finally {
            setLoadingThread(false);
        }
    }, [refreshUnread]);

    const handleSend = useCallback(async () => {
        const text = draft.trim();
        if (!text || !selectedId || sending) return;
        setSending(true);
        try {
            const message = await sendMessage(selectedId, text);
            setMessages((prev) => [...prev, message]);
            setDraft('');
            await loadConversations();
        } finally {
            setSending(false);
        }
    }, [draft, selectedId, sending, loadConversations]);

    const handleBack = () => {
        setSelectedId(null);
        setMessages([]);
        setDraft('');
    };

    return (
        <>
            <PageHeader title={t('pages.chat')} />
            <div className={styles.chatContainer}>
                <div className={`${styles.shell} ${isMobile && selectedId ? styles.threadOpen : ''}`}>
                    {(!isMobile || !selectedId) && (
                        <ChatList
                            conversations={visibleConversations}
                            selectedId={selectedId}
                            search={search}
                            filter={filter}
                            loading={loadingList}
                            onSearchChange={setSearch}
                            onFilterChange={setFilter}
                            onSelect={openConversation}
                        />
                    )}
                    {(!isMobile || selectedId) && (
                        <ChatThread
                            conversation={selected}
                            messages={messages}
                            loading={loadingThread}
                            draft={draft}
                            onDraftChange={setDraft}
                            onSend={handleSend}
                            sending={sending}
                            onBack={handleBack}
                            showBack={isMobile}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
