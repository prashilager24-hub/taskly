import axios from "axios";

// The old Java backend left /t2.0/authentificationUtilization/** open, so many
// calls in this app never send a token. The Node backend requires one — attach
// the logged-in user's token to every API request that doesn't set its own.

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

export function installApiAuth() {
    axios.interceptors.request.use((config) => {
        const token = currentToken();
        if (token && config.url && isApiUrl(config.url) && !config.headers.has("Authorization")) {
            config.headers.set("Authorization", `Bearer ${token}`);
        }
        return config;
    });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        const token = currentToken();
        if (!token || !isApiUrl(url)) return nativeFetch(input, init);

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        return nativeFetch(input, { ...init, headers });
    };
}
