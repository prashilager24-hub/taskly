// Dark / Light theme (requirements THEME-01, THEME-02, AUTH-11).
// The choice lives in localStorage "theme" (index.html applies it before first paint) and,
// when someone is signed in, on their profile — so it follows them to every device.

import axios from "axios";

export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<(t: Theme) => void>();

export function getTheme(): Theme {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Applies a theme; `save` also stores it on the signed-in user's profile */
export function setTheme(theme: Theme, { save = true }: { save?: boolean } = {}) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
        localStorage.setItem(KEY, theme);
    } catch {
        /* storage unavailable: the theme still applies for this page view */
    }
    listeners.forEach((fn) => fn(theme));
    if (save && localStorage.getItem("authUserLD")) {
        axios.put("/t2.0/authentificationUtilization/user/theme", { theme }).catch(() => {
            /* the theme still applies locally; it is saved again on the next change */
        });
    }
}

export function onThemeChange(fn: (t: Theme) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
