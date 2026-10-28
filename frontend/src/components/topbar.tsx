import { Button } from "@/components/ui";
import { useEffect, useState, useRef } from "react";
import { Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";
import SwitchUserModal from "./SwitchUserModal";
import ThemeToggle from "./ThemeToggle";
import { pageMeta } from "./sidebar";
import { useLocation } from "react-router-dom";

// Custom Icons
const BellIcon = (props: any) => (
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
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        />
        <path
            d="M13.73 21a2 2 0 0 1-3.46 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        />
    </svg>
);

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

const STORAGE_KEY = "hrModuleNotifications";

interface NotificationItem {
    id: string;
    message: string;
    time: string;
    read: boolean;
}

interface TopbarProps {
    toggleSidebar: () => void;
    title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ toggleSidebar, title }) => {
    const meta = pageMeta(useLocation().pathname);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const lastRaw = useRef<string | null>(null);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

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

    // Load notifications from localStorage and keep them in sync
    useEffect(() => {
        const load = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY) ?? "[]";
                // Polled every 2s: keep the same state when nothing changed so the topbar doesn't re-render
                if (raw === lastRaw.current) return;
                lastRaw.current = raw;
                setNotifications(JSON.parse(raw));
            } catch {
                setNotifications([]);
            }
        };
        load();
        const onStorage = () => load();
        window.addEventListener("storage", onStorage);
        const interval = setInterval(load, 2000);

        // Listen for push messages from service worker
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === "PUSH_RECEIVED" && event.data.payload) {
                const p = event.data.payload;
                const item = {
                    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
                    message: p.body || p.title || "New notification",
                    time: new Date().toISOString(),
                    read: false,
                };
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    const prev = raw ? JSON.parse(raw) : [];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...prev].slice(0, 50)));
                } catch { /* ignore */ }
                load();
            }
        };
        // serviceWorker is undefined on insecure origins (e.g. http://<LAN IP>)
        navigator.serviceWorker?.addEventListener("message", onMessage);

        return () => {
            window.removeEventListener("storage", onStorage);
            clearInterval(interval);
            navigator.serviceWorker?.removeEventListener("message", onMessage);
        };
    }, []);

    // Close panel on outside click
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const persist = (next: NotificationItem[]) => {
        setNotifications(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    };

    const markAllRead = () => persist(notifications.map((n) => ({ ...n, read: true })));

    const clearNotifications = () => {
        persist([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
    };

    const unread = notifications.filter((n) => !n.read).length;

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

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen((o) => !o)}
                        className="relative flex h-8 w-8 items-center justify-center text-ink-600 transition-colors hover:bg-ink-100 focus-ring dark:text-ink-300 dark:hover:bg-white/5"
                        aria-label="Notifications"
                    >
                        <BellIcon className="h-[18px] w-[18px]" />
                        {unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {unread > 9 ? "9+" : unread}
                            </span>
                        )}
                    </button>

                    {notifOpen && (
                        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] border border-ink-200 bg-white shadow-pop z-50 dark:border-white/10 dark:bg-ink-900 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 dark:border-ink-700">
                                <span className="eyebrow">Notifications</span>
                                <div className="flex items-center gap-1">
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L7 17l-4-4" /><path d="M22 12l-7.5 7.5L13 18" /></svg>
                                            Mark all read
                                        </button>
                                    )}
                                    <button
                                        onClick={clearNotifications}
                                        className="text-[11px] text-ink-400 hover:text-rose-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800"
                                        aria-label="Clear all"
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        Clear
                                    </button>
                                    <button onClick={() => setNotifOpen(false)} className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Close">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-ink-400">
                                        <BellIcon className="w-6 h-6 mb-2" />
                                        <span className="text-xs">No notifications yet</span>
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`px-4 py-3 border-b border-ink-50 dark:border-ink-800 last:border-0 ${n.read ? "opacity-70" : "bg-brand-50/60 dark:bg-brand-500/10"}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-600 shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] text-ink-800 dark:text-ink-200 leading-snug">{n.message}</p>
                                                    <p className="text-[11px] text-ink-400 mt-0.5">
                                                        {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

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
