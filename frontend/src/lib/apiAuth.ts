import axios from "axios";

import { endSession } from "./session";

// The old Java backend left /t2.0/authentificationUtilization/** open, so many
// calls in this app never send a token. The Node backend requires one — attach
// the logged-in user's token to every API request that doesn't set its own.
//
// It also handles an ended session in one place (AUTH-05): a 401 carrying a SESSION_*
// code (signed in elsewhere, expired, signed out) returns to sign-in with the reason.

const API_PREFIXES = ["/t2.0/", "/api/"];

function isApiUrl(url: string): boolean {
    try {
        const u = new URL(url, window.location.origin);
        return u.origin === window.location.origin && API_PREFIXES.some((p) => u.pathname.startsWith(p));
    } catch {
        return false;
    }
}

function currentToken(): string | null {
    try {
        const raw = localStorage.getItem("authUserLD");
        return raw ? JSON.parse(raw)?.token ?? null : null;
    } catch {
        return null;
    }
}

/** Only a request made with a session token can end that session */
function handleUnauthorized(status: number, body: any, hadToken: boolean) {
    if (status !== 401 || !hadToken) return;
    const code = typeof body?.code === "string" ? body.code : undefined;
    if (code?.startsWith("SESSION_")) endSession(code);
}

export function installApiAuth() {
    axios.interceptors.request.use((config) => {
        const token = currentToken();
        if (token && config.url && isApiUrl(config.url) && !config.headers.has("Authorization")) {
            config.headers.set("Authorization", `Bearer ${token}`);
        }
        return config;
    });
    axios.interceptors.response.use(undefined, (error) => {
        const res = error?.response;
        if (res && error.config?.url && isApiUrl(error.config.url)) {
            handleUnauthorized(res.status, res.data, !!error.config.headers?.get?.("Authorization"));
        }
        return Promise.reject(error);
    });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        const token = currentToken();
        if (!isApiUrl(url)) return nativeFetch(input, init);

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        const res = await nativeFetch(input, { ...init, headers });
        if (res.status === 401 && headers.has("Authorization")) {
            res.clone().json().then((body) => handleUnauthorized(401, body, true)).catch(() => undefined);
        }
        return res;
    };
}
