import { Button } from "@/components/ui";
import { useEffect } from "react";
import { Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from "@/components/ui";
import SwitchUserModal from "./SwitchUserModal";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./notifications/NotificationBell";
import { pageMeta } from "./sidebar";
import { useLocation } from "react-router-dom";

// Custom Icons
const MenuIcon = (props: any) => (
    <svg
        aria-hidden="true"
        fill="none"
        focusable="false"
        height="1em"
        role="presentation"
        viewBox="0 0 24 24"
        width="1em"
        {...props}
    >
        <path
            d="M3 12h18M3 6h18M3 18h18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        />
    </svg>
);

interface TopbarProps {
    toggleSidebar: () => void;
    title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ toggleSidebar, title }) => {
    const meta = pageMeta(useLocation().pathname);

    const authUserLD = localStorage.getItem("authUserLD");
    const user = authUserLD ? JSON.parse(authUserLD) : null;
    const initials = String(user?.name ?? "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

    const handleLogout = () => {
        localStorage.removeItem("authUserLD");
        window.location.href = "/";
    };

    useEffect(() => {
        const authUser = localStorage.getItem("authUserLD");
        if (!authUser) return;
        const user = JSON.parse(authUser);
        const token = user.token;
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const expiresIn = payload.exp * 1000 - Date.now();
            if (expiresIn <= 0) {
                handleLogout();
                return;
            }
            const timer = setTimeout(() => {
                handleLogout();
            }, expiresIn);
            return () => clearTimeout(timer);
        } catch (err) {
            console.error("Invalid JWT", err);
            handleLogout();
        }
    }, []);

    return (
        <header className="flex h-16 items-center justify-between gap-4 border-b border-ink-200 bg-white px-4 dark:border-white/10 dark:bg-ink-900 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <Button isIconOnly variant="light" size="sm" onClick={toggleSidebar} className="lg:hidden" aria-label="Open menu">
                    <MenuIcon className="h-5 w-5" />
                </Button>
                <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
                    <span className="eyebrow hidden sm:inline">{meta.section}</span>
                    <span aria-hidden className="hidden text-ink-300 dark:text-ink-600 sm:inline">/</span>
                    <span className="truncate font-medium text-ink-900 dark:text-white" aria-current="page">{meta.label || title}</span>
                </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <SwitchUserModal />
                <ThemeToggle />

                <NotificationBell />

                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <button type="button" className="ml-1 flex items-center gap-2.5 border-l border-ink-200 pl-3 focus-ring dark:border-white/10">
                            <span className="hidden text-right sm:block">
                                <span className="block max-w-[160px] truncate text-[13px] font-medium leading-tight text-ink-900 dark:text-white">{user?.name}</span>
                                {user?.departmentName && (
                                    <span className="block max-w-[160px] truncate text-[11px] leading-tight text-ink-500 dark:text-ink-400">
                                        {String(user.departmentName).replace(/([A-Z])/g, " $1").trim()}
                                    </span>
                                )}
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center bg-brand-600 text-[11px] font-bold text-white">{initials || "?"}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                    </DropdownTrigger>

                    <DropdownMenu aria-label="Profile Actions">
                        <DropdownItem key="profile" isReadOnly className="cursor-default opacity-100" textValue="Profile">
                            <p className="eyebrow">Signed in as</p>
                            <p className="text-sm font-medium">{user?.email ?? user?.name}</p>
                        </DropdownItem>

                        <DropdownItem
                            key="logout"
                            className="text-danger"
                            color="danger"
                            onClick={() => {
                                window.location.href = "/logout"
                            }}
                        >
                            Sign out
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>

            </div>
        </header>
    );
};
