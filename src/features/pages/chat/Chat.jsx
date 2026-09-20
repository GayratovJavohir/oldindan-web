import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/header/PageHeader';
import { useLayout } from '../../../context/LayoutContext';
import { useChatUnread } from '../../../context/ChatContext';
import {
    getConversations,
    getMessages,
    getOrCreateBookingRoom,
    markConversationRead,
    sendMessage,
} from '../../../services/chat.services';
import { getApiError } from '../../../utils/apiHelpers';
import ChatList from './components/ChatList';
import ChatThread from './components/ChatThread';
import styles from './Chat.module.css';

export default function Chat() {
    const { t } = useTranslation();
    const { isMobile } = useLayout();
    const { refreshUnread } = useChatUnread();
    const [searchParams, setSearchParams] = useSearchParams();

    const [conversations, setConversations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [draft, setDraft] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [sending, setSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const selectedIdRef = useRef(null);

    selectedIdRef.current = selectedId;

    const loadConversations = useCallback(async () => {
        const list = await getConversations();
        setConversations(list);
        await refreshUnread();
        return list;
    }, [refreshUnread]);

    useEffect(() => {
        let cancelled = false;
        setLoadingList(true);
        setErrorMessage('');
        loadConversations()
            .catch((err) => {
                if (!cancelled) setErrorMessage(getApiError(err) || t('chat.loadFailed'));
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        return () => {
            cancelled = true;
        };
    }, [loadConversations, t]);

    useEffect(() => {
        const timer = setInterval(() => {
            loadConversations().catch(() => { });
            const openId = selectedIdRef.current;
            if (!openId) return;
            getMessages(openId)
                .then(setMessages)
                .catch(() => { });
        }, 15000);
        return () => clearInterval(timer);
    }, [loadConversations]);

    const selected = useMemo(
        () => conversations.find((item) => String(item.id) === String(selectedId)) || null,
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
        setErrorMessage('');
        try {
            const [list] = await Promise.all([
                getMessages(id),
                markConversationRead(id).catch(() => null),
            ]);
            setMessages(list);
            setConversations((prev) =>
                prev.map((item) => (String(item.id) === String(id) ? { ...item, unreadCount: 0 } : item)),
            );
            await refreshUnread();
        } catch (err) {
            setErrorMessage(getApiError(err) || t('chat.loadFailed'));
        } finally {
            setLoadingThread(false);
        }
    }, [refreshUnread, t]);

    useEffect(() => {
        const bookingId = searchParams.get('booking');
        if (!bookingId) return undefined;
        let cancelled = false;

        (async () => {
            try {
                setErrorMessage('');
                const room = await getOrCreateBookingRoom(bookingId);
                if (cancelled || !room?.id) return;
                await loadConversations();
                await openConversation(room.id);
            } catch (err) {
                if (!cancelled) setErrorMessage(getApiError(err) || t('chat.loadFailed'));
            } finally {
                if (!cancelled) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('booking');
                    setSearchParams(next, { replace: true });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [searchParams, setSearchParams, loadConversations, openConversation, t]);

    const handleSend = useCallback(async () => {
        const text = draft.trim();
        if (!text || !selectedId || sending) return;
        setSending(true);
        setErrorMessage('');
        try {
            const message = await sendMessage(selectedId, text);
            setMessages((prev) => {
                if (prev.some((item) => String(item.id) === String(message.id))) return prev;
                return [...prev, message];
            });
            setDraft('');
            await loadConversations();
        } catch (err) {
            setErrorMessage(getApiError(err) || t('chat.sendFailed'));
        } finally {
            setSending(false);
        }
    }, [draft, selectedId, sending, loadConversations, t]);

    const handleBack = () => {
        setSelectedId(null);
        setMessages([]);
        setDraft('');
    };

    return (
        <>
            <PageHeader title={t('pages.chat')} />
            <div className={styles.chatContainer}>
                {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
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
