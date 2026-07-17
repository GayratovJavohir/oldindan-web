import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';
import { NotificationDrawer } from '../components/header/PageHeader';
import {
    canAccessRoute,
    getDefaultRouteForRole,
    getStoredUser,
} from '../utils/authUser';

function hasAuthToken() {
    return Boolean(localStorage.getItem('rp_access') || localStorage.getItem('token'));
}

export default function ProtectedLayout() {
    const location = useLocation();
    const user = getStoredUser();

    if (!hasAuthToken()) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (!user) {
        return (
            <div className="loader" style={{ marginLeft: 'var(--sidebar-width)', padding: 24 }}>
                Loading workspace...
            </div>
        );
    }

    if (!canAccessRoute(location.pathname, user.role)) {
        return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
    }

    return (
        <>
            <Sidebar />
            <NotificationDrawer />
            <Outlet />
        </>
    );
}
