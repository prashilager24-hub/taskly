// Layout.tsx
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useState } from "react";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const location = useLocation();
    const currentPage = location.pathname;
    return (

        <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">

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
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>

            </div>
        </div>

    );
}
