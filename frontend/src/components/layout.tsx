// Layout.tsx
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import SwitchedUserBanner from "@/components/SwitchedUserBanner";
import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const location = useLocation();

    // Access can change while someone is signed in (role, department or personal access): re-read it
    // when the app opens and reload once if the menu would be different
    useEffect(() => {
        if (!localStorage.getItem("authUserLD")) return;
        axios.get("/t2.0/authentificationUtilization/access/me")
            .then((res) => {
                const fresh = res.data?.response;
                if (!res.data?.status || !fresh) return;
                const before = localStorage.getItem("roles");
                const next = JSON.stringify(fresh);
                if (before !== next) {
                    localStorage.setItem("roles", next);
                    let had = "";
                    try { had = JSON.parse(before || "{}").rolePrivileges ?? ""; } catch { /* ignore */ }
                    if (had !== fresh.rolePrivileges) window.location.reload();
                }
            })
            .catch(() => undefined);
    }, []);
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
                    <div className="mx-auto w-full max-w-[1680px]">
                    {/* "Viewing as … — Return" while an admin is switched into another user, on every page */}
                    <SwitchedUserBanner onSwitchBack={() => window.location.reload()} />
                    {children}
                    </div>
                </main>

            </div>
        </div>

    );
}
