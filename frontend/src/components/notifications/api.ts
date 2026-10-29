import axios from "axios";

// Notifications API. Responses are { status, response }.

const BASE = "/t2.0/authentificationUtilization/notifications";

export type Level = "info" | "success" | "warning" | "urgent";
export const LEVELS: { key: Level; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "success", label: "Good news" },
    { key: "warning", label: "Heads up" },
    { key: "urgent", label: "Urgent" },
];

export interface Audience { all: boolean; departments: number[]; roles: number[]; users: number[] }
export interface MyNotification { id: number; title: string; body: string; level: Level; linkUrl: string | null; createdAt: string; read: boolean }
export interface SentNotification {
    id: number; title: string; body: string; level: Level; linkUrl: string | null; createdAt: string; expiresAt: string | null;
    active: boolean; audience: Audience; createdBy: string; readCount: number; reach: number;
}
export interface NotificationDraft { title: string; body: string; level: Level; linkUrl: string; expiresAt: string | null; active: boolean; audience: Audience }

const unwrap = <T,>(p: Promise<{ data: { response: T } }>) => p.then((r) => r.data.response);

export const notificationsApi = {
    mine: () => unwrap<MyNotification[]>(axios.get(`${BASE}/mine`)),
    read: (id: number) => axios.post(`${BASE}/${id}/read`),
    dismiss: (id: number) => axios.post(`${BASE}/${id}/dismiss`),
    readAll: () => axios.post(`${BASE}/read-all`),
    dismissAll: () => axios.post(`${BASE}/dismiss-all`),
    list: () => unwrap<SentNotification[]>(axios.get(BASE)),
    reach: (audience: Audience) => unwrap<{ reach: number }>(axios.post(`${BASE}/reach`, { audience })).then((r) => r.reach),
    save: (draft: NotificationDraft, id?: number) => (id ? axios.put(`${BASE}/${id}`, draft) : axios.post(BASE, draft)),
    remove: (id: number) => axios.delete(`${BASE}/${id}`),
};
