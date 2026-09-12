import React, { useEffect } from 'react';
import AuthService from '../services/auth.services';
import { getStoredUser, mapProfile, setStoredUser, getAccountType } from '../utils/authUser';
import { NotificationProvider } from '../context/NotificationContext';
import { ChatProvider } from '../context/ChatContext';
import { LayoutProvider } from '../context/LayoutContext';
import { ThemeProvider } from '../context/ThemeContext';

function AuthBootstrap({ children }) {
    useEffect(() => {
        const token = localStorage.getItem('rp_access') || localStorage.getItem('token');
        if (!token || getStoredUser()) return;

        AuthService.getProfile()
            .then((profile) => setStoredUser(mapProfile(profile, getAccountType())))
            .catch(() => { });
    }, []);

    return children;
}

export const AppProviders = ({ children }) => {
    return (
        <ThemeProvider>
            <AuthBootstrap>
                <LayoutProvider>
                    <NotificationProvider>
                        <ChatProvider>
                            {children}
                        </ChatProvider>
                    </NotificationProvider>
                </LayoutProvider>
            </AuthBootstrap>
        </ThemeProvider>
    );
};
