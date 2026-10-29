import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@heroui/theme";

import { notificationsApi, type Level, type MyNotification } from "./api";

const BAR: Record<Level, string> = {
    info: "bg-sky-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    urgent: "bg-rose-600",
};

// The bell in the top bar: what admins have sent to this person. Each item can be closed; closed ones stay gone.
export default function NotificationBell() {
    const [items, setItems] = useState<MyNotification[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const last = useRef("");

    const load = useCallback(() => {
        notificationsApi.mine().then((list) => {
            // Polled: only touch state when something changed, so the bar does not re-render for nothing
            const key = JSON.stringify(list.map((n) => [n.id, n.read]));
            if (key === last.current) return;
            last.current = key;
            setItems(list);
        }).catch(() => undefined);
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [load]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    const unread = items.filter((n) => !n.read).length;

    const dismiss = (id: number) => { setItems((l) => l.filter((n) => n.id !== id)); last.current = ""; notificationsApi.dismiss(id).catch(load); };
    const read = (id: number) => { setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n))); last.current = ""; notificationsApi.read(id).catch(load); };
    const readAll = () => { setItems((l) => l.map((n) => ({ ...n, read: true }))); last.current = ""; notificationsApi.readAll().catch(load); };
    const clearAll = () => { setItems([]); last.current = ""; notificationsApi.dismissAll().catch(load); };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative flex h-8 w-8 items-center justify-center text-ink-600 transition-colors hover:bg-ink-100 focus-ring dark:text-ink-300 dark:hover:bg-white/5"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                aria-expanded={open}
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[26rem] max-w-[92vw] overflow-hidden border border-ink-200 bg-white shadow-pop dark:border-white/10 dark:bg-ink-900">
                    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 dark:border-white/10">
                        <span className="eyebrow">Notifications{items.length ? ` · ${items.length}` : ""}</span>
                        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide">
                            {unread > 0 && <button type="button" onClick={readAll} className="text-brand-600 hover:underline focus-ring">Mark all read</button>}
                            {items.length > 0 && <button type="button" onClick={clearAll} className="text-ink-500 hover:text-rose-600 focus-ring">Close all</button>}
                        </div>
                    </div>

                    <div className="max-h-[26rem] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink-400">
                                <Bell size={22} />
                                <span className="text-xs">You are all caught up</span>
                            </div>
                        ) : items.map((n) => (
                            <div key={n.id} className={cn("relative flex gap-3 border-b border-ink-100 py-3 pl-4 pr-2 last:border-0 dark:border-white/5", !n.read && "bg-brand-50/60 dark:bg-brand-500/10")}>
                                <span className={cn("mt-0.5 w-1 shrink-0 self-stretch", BAR[n.level] ?? BAR.info)} aria-hidden />
                                <div className="min-w-0 flex-1" onMouseEnter={() => { if (!n.read) read(n.id); }}>
                                    <p className="text-[13px] font-semibold leading-snug text-ink-900 dark:text-white">{n.title}</p>
                                    {n.body && <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-snug text-ink-600 dark:text-ink-300">{n.body}</p>}
                                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-400">
                                        <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                                        {n.linkUrl && (
                                            n.linkUrl.startsWith("/")
                                                ? <Link to={n.linkUrl} onClick={() => { read(n.id); setOpen(false); }} className="font-bold uppercase tracking-wide text-brand-600 hover:underline">Open</Link>
                                                : <a href={n.linkUrl} target="_blank" rel="noreferrer" onClick={() => read(n.id)} className="font-bold uppercase tracking-wide text-brand-600 hover:underline">Open</a>
                                        )}
                                    </div>
                                </div>
                                <button type="button" onClick={() => dismiss(n.id)} aria-label={`Close ${n.title}`} className="flex h-7 w-7 shrink-0 items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-900 focus-ring dark:hover:bg-white/10 dark:hover:text-white">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
