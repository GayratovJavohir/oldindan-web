import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { getUnreadChatCount } from '../services/chat.services';
import { getStoredUser } from '../utils/authUser';

const ChatContext = createContext(null);

function hasAuthToken() {
    return Boolean(localStorage.getItem('rp_access') || localStorage.getItem('token'));
}

export function ChatProvider({ children }) {
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnread = useCallback(async () => {
        if (!hasAuthToken()) {
            setUnreadCount(0);
            return 0;
        }
        const user = getStoredUser();
        if (user?.role !== 'receptionist') {
            setUnreadCount(0);
            return 0;
        }
        try {
            const count = await getUnreadChatCount();
            setUnreadCount(count);
            return count;
        } catch {
            setUnreadCount(0);
            return 0;
        }
    }, []);

    useEffect(() => {
        refreshUnread().catch(() => setUnreadCount(0));
        const interval = setInterval(() => {
            refreshUnread().catch(() => { });
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshUnread]);

    const value = useMemo(() => ({
        unreadCount,
        refreshUnread,
    }), [unreadCount, refreshUnread]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatUnread() {
    return useContext(ChatContext) || { unreadCount: 0, refreshUnread: async () => 0 };
}
