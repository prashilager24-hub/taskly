// Dark / Light theme (requirements THEME-01, THEME-02).
// The choice lives in localStorage "theme"; index.html applies it before first paint.
// Saving it to the user's profile (so it follows them across devices) comes with the
// sign-in work (AUTH-11) — setTheme is the one place to add that call.

export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<(t: Theme) => void>();

export function getTheme(): Theme {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
        localStorage.setItem(KEY, theme);
    } catch {
        /* storage unavailable: the theme still applies for this page view */
    }
    listeners.forEach((fn) => fn(theme));
}

export function onThemeChange(fn: (t: Theme) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
