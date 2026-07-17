import React, { useEffect } from 'react';
import AuthService from '../services/auth.services';
import { getStoredUser, mapProfile, setStoredUser, getAccountType } from '../utils/authUser';
import { NotificationProvider } from '../context/NotificationContext';
import { LayoutProvider } from '../context/LayoutContext';

function AuthBootstrap({ children }) {
    useEffect(() => {
        const token = localStorage.getItem('rp_access') || localStorage.getItem('token');
        if (!token || getStoredUser()) return;

        AuthService.getProfile()
            .then((profile) => setStoredUser(mapProfile(profile, getAccountType())))
            .catch(() => {});
    }, []);

    return children;
}

export const AppProviders = ({ children }) => {
    return (
        <AuthBootstrap>
            <LayoutProvider>
                <NotificationProvider>
                    {children}
                </NotificationProvider>
            </LayoutProvider>
        </AuthBootstrap>
    );
};
