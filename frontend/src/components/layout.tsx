// Layout.tsx
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import SwitchedUserBanner from "@/components/SwitchedUserBanner";
import { useState } from "react";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const location = useLocation();
    const currentPage = location.pathname;
    return (

        <div className="h-screen flex overflow-hidden bg-ink-50 dark:bg-ink-950">

            {/* Sidebar */}
            <div className="h-full overflow-y-auto">
                <Sidebar
                    isOpen={sidebarOpen}
                    toggleSidebar={toggleSidebar}
                    currentPage={currentPage}
                />
            </div>

            {/* Right Side */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">

                {/* Topbar (fixed) */}
                <div className="h-16 shrink-0">
                    <Topbar toggleSidebar={toggleSidebar} />
                </div>

                {/* Content Scroll Area */}
                <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                    {/* "Viewing as … — Return" while an admin is switched into another user, on every page */}
                    <SwitchedUserBanner onSwitchBack={() => window.location.reload()} />
                    {children}
                </main>

            </div>
        </div>

    );
}
