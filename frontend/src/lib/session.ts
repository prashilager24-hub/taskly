// Signed-in session storage (requirements AUTH-01, AUTH-02, AUTH-05).
//
// "Keep me signed in" → the session lives in localStorage (survives closing the browser).
// Otherwise it is tab-level: it lives in sessionStorage and ends when the tab closes.
//
// The app reads the session as localStorage.getItem("authUserLD") in many places, so rather
// than change every caller, installSessionStorage() routes just the session keys to
// sessionStorage while the tab-level mode is on. Every other key is untouched.

const SESSION_KEYS = new Set(["authUserLD", "roles", "originalAuthUserLD", "originalRoles"]);
const MODE_KEY = "sessionMode"; // "tab" | "persist" — kept in the real localStorage

const proto = Storage.prototype;
const nativeGet = proto.getItem;
const nativeSet = proto.setItem;
const nativeRemove = proto.removeItem;

function isTabMode() {
    return nativeGet.call(window.localStorage, MODE_KEY) === "tab";
}

function target(store: Storage, key: string): Storage {
    return store === window.localStorage && SESSION_KEYS.has(key) && isTabMode() ? window.sessionStorage : store;
}

let installed = false;
export function installSessionStorage() {
    if (installed) return;
    installed = true;
    proto.getItem = function (this: Storage, key: string) {
        return nativeGet.call(target(this, key), key);
    };
    proto.setItem = function (this: Storage, key: string, value: string) {
        nativeSet.call(target(this, key), key, value);
    };
    proto.removeItem = function (this: Storage, key: string) {
        nativeRemove.call(target(this, key), key);
    };
}

/** Removes the session from both stores */
export function clearSession() {
    for (const key of SESSION_KEYS) {
        nativeRemove.call(window.localStorage, key);
        nativeRemove.call(window.sessionStorage, key);
    }
    nativeRemove.call(window.localStorage, MODE_KEY);
}

/** Stores a freshly verified session in the store its "Keep me signed in" choice calls for */
export function saveSession(user: unknown, keepSignedIn: boolean) {
    clearSession();
    nativeSet.call(window.localStorage, MODE_KEY, keepSignedIn ? "persist" : "tab");
    window.localStorage.setItem("authUserLD", JSON.stringify(user));
}

export const SIGN_OUT_MESSAGES: Record<string, string> = {
    SESSION_REPLACED: "You were signed out because your account was used on another device.",
    SESSION_EXPIRED: "Your session expired. Please sign in again.",
    SESSION_REVOKED: "You have been signed out.",
    SESSION_INVALID: "Please sign in again.",
};

let signingOut = false;
/** A 401 for an ended session: drop it and go to sign-in, saying why (AUTH-05) */
export function endSession(code?: string) {
    if (signingOut) return;
    signingOut = true;
    clearSession();
    const reason = code && SIGN_OUT_MESSAGES[code] ? code : "SESSION_EXPIRED";
    window.location.replace(`/?reason=${reason}`);
}
