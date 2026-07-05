import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import NotFoundPage from "../pages/NotFoundPage";
import Sidebar from '../components/sidebar/Sidebar';
import StaffPage from '../pages/StaffPage';
import BrandPage from '../pages/BrandPage';
import BranchPage from '../pages/BranchPage'
import TablesPage from '../pages/TablesPage';
import BookingsPage from '../pages/BookingsPage';
import LiveFloorPage from '../pages/LiveFloorPage';

const PageLoader = () => <div className='loader'> Loading Stats </div>;

export default function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Sidebar />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/">
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="bookings" element={<BookingsPage />} />
                    <Route path="floor-layout" element={<LiveFloorPage />} />
                    <Route path="brands" element={<BrandPage />} />
                    <Route path="staff" element={<StaffPage />} />
                    <Route path="branches" element={<BranchPage />} />
                    <Route path="tables" element={<TablesPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    )
}
