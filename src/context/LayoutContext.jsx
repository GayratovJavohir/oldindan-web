import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LayoutContext = createContext({
    sidebarOpen: false,
    openSidebar: () => {},
    closeSidebar: () => {},
    toggleSidebar: () => {},
    isMobile: false,
});

export function LayoutProvider({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= 900 : false
    );

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth <= 900;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

    const value = useMemo(() => ({
        sidebarOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        isMobile,
    }), [sidebarOpen, openSidebar, closeSidebar, toggleSidebar, isMobile]);

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    return useContext(LayoutContext);
}
