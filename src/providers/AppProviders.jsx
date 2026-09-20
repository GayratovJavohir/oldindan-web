import React, { useEffect, useState } from 'react';
import AuthService from '../services/auth.services';
import { getStoredUser, mapProfile, setStoredUser, getAccountType } from '../utils/authUser';
import { NotificationProvider } from '../context/NotificationContext';
import { ChatProvider } from '../context/ChatContext';
import { LayoutProvider } from '../context/LayoutContext';
import { ThemeProvider } from '../context/ThemeContext';

/**
 * Restores the signed-in user on a hard refresh.
 *
 * FIX: the previous version wrote the profile straight into localStorage
 * without any React state, so nothing re-rendered when it finished.
 * `ProtectedLayout` reads the user synchronously from localStorage, which
 * meant a page refresh left the app stuck on "Loading workspace..." until the
 * user manually reloaded a second time. It also swallowed the error, so an
 * expired session never redirected to /login.
 *
 * Children are now rendered only once bootstrapping has settled.
 */
function AuthBootstrap({ children }) {
    const [booting, setBooting] = useState(() => {
        const token = localStorage.getItem('rp_access') || localStorage.getItem('token');
        return Boolean(token) && !getStoredUser();
    });

    useEffect(() => {
        if (!booting) return undefined;

        let active = true;
        AuthService.getProfile()
            .then((profile) => {
                if (active) setStoredUser(mapProfile(profile, getAccountType()));
            })
            .catch(() => {
                // Invalid/expired token: drop it so ProtectedLayout can redirect.
                if (active) AuthService.logout();
            })
            .finally(() => {
                if (active) setBooting(false);
            });

        return () => { active = false; };
    }, [booting]);

    if (booting) {
        return <div className="loader" style={{ padding: 24 }}>Loading…</div>;
    }

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
