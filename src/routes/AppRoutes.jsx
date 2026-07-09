import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import StaffPage from '../pages/StaffPage';
import BrandPage from '../pages/BrandPage';
import BranchPage from '../pages/BranchPage';
import TablesPage from '../pages/TablesPage';
import BookingsPage from '../pages/BookingsPage';
import LayoutPage from '../pages/LayoutPage';
import NotificationPage from '../pages/NotificationPage';
import ManualBookingsPage from '../pages/ManualBookingsPage';
import ProfilePage from '../pages/ProfilePage';
import LiveLayoutPage from '../pages/LiveLayoutPage';
import ProtectedLayout from '../components/ProtectedLayout';
import { getDefaultRouteForRole, getStoredUser } from '../utils/authUser';

const PageLoader = () => <div className="loader">Loading...</div>;

function HomeRedirect() {
    const user = getStoredUser();
    const role = user?.role || 'manager';
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
}

export default function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedLayout />}>
                    <Route path="/" element={<HomeRedirect />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="bookings" element={<BookingsPage />} />
                    <Route path="manual-bookings" element={<ManualBookingsPage />} />
                    <Route path="floor-layout" element={<LayoutPage />} />
                    <Route path="live-view" element={<LiveLayoutPage />} />
                    <Route path="brands" element={<BrandPage />} />
                    <Route path="staff" element={<StaffPage />} />
                    <Route path="branches" element={<BranchPage />} />
                    <Route path="tables" element={<TablesPage />} />
                    <Route path="notifications" element={<NotificationPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
}
