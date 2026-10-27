import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { useEffect, useState, useRef } from "react";
import { Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";

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
    title: string;
}

export const Topbar: React.FC<TopbarProps> = ({ toggleSidebar, title }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    const authUserLD = localStorage.getItem("authUserLD");

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
                const raw = localStorage.getItem(STORAGE_KEY);
                setNotifications(raw ? JSON.parse(raw) : []);
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
        <header className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between" style={{ height: "45px" }}>
            <div className="flex items-center">
                <Button
                    isIconOnly
                    variant="light"
                    onClick={toggleSidebar}
                    className=" mr-4 lg:hidden"
                >
                    <MenuIcon />
                </Button>

                {/* <h1 className="text-xl font-semibold">{title}</h1> */}
            </div>

            <div className="flex items-center space-x-3">
                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen((o) => !o)}
                        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Notifications"
                    >
                        <BellIcon className="w-[20px] h-[20px] text-gray-600 dark:text-gray-300" />
                        {unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unread > 9 ? "9+" : unread}
                            </span>
                        )}
                    </button>

                    {notifOpen && (
                        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</span>
                                <div className="flex items-center gap-1">
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L7 17l-4-4" /><path d="M22 12l-7.5 7.5L13 18" /></svg>
                                            Mark all read
                                        </button>
                                    )}
                                    <button
                                        onClick={clearNotifications}
                                        className="text-[11px] text-gray-400 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        aria-label="Clear all"
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        Clear
                                    </button>
                                    <button onClick={() => setNotifOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                        <BellIcon className="w-6 h-6 mb-2" />
                                        <span className="text-xs">No notifications yet</span>
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 ${n.read ? "opacity-70" : "bg-blue-50/40 dark:bg-blue-900/20"}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-snug">{n.message}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
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
                        <div className="flex items-center gap-2 cursor-pointer">
                            <div className="hidden sm:block text-right">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{authUserLD && JSON.parse(authUserLD).name}</p>

                                {authUserLD && JSON.parse(authUserLD).departmentName && (
                                    <p className="text-xs text-primary">
                                        {JSON.parse(authUserLD)
                                            .departmentName
                                            .replace(/([A-Z])/g, ' $1')
                                            .trim()}
                                    </p>
                                )}

                            </div>
                            <Avatar
                                src=""
                                size="sm"
                                className="ring-2 ring-transparent hover:ring-blue-500 transition-all duration-200"
                            />

                            {/* Down Arrow Icon */}
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </div>
                    </DropdownTrigger>

                    <DropdownMenu aria-label="Profile Actions">
                        <DropdownItem key="profile" isDisabled className="font-semibold">
                            Profile
                        </DropdownItem>

                        <DropdownItem
                            key="logout"
                            className="text-danger"
                            color="danger"
                            onClick={() => {
                                window.location.href = "/logout"
                            }}
                        >
                            Logout
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>

            </div>
        </header>
    );
};
