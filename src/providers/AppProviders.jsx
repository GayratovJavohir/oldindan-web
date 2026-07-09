import React, { useEffect } from 'react';
import AuthService from '../services/auth.services';
import { getStoredUser, mapProfile, setStoredUser } from '../utils/authUser';

function AuthBootstrap({ children }) {
    useEffect(() => {
        const token = localStorage.getItem('rp_access') || localStorage.getItem('token');
        if (!token || getStoredUser()) return;

        AuthService.getProfile()
            .then((profile) => setStoredUser(mapProfile(profile)))
            .catch(() => {});
    }, []);

    return children;
}

export const AppProviders = ({ children }) => {
    return (
        <AuthBootstrap>
            {children}
        </AuthBootstrap>
    );
};
