// utils/userSwitch.ts
//
// Handles "switch into another user" for admins/EL/FL.
// - authUserLD          -> whoever is currently "active" in the app (what everything else reads)
// disp- originalAuthUserLD -> the real logged-in user, stashed only while a switch is active
//
// Only ONE level of switching is tracked: if you switch again while already
// switched, the "original" stays the same person you can always get back to.

import axios from "axios";

const CURRENT_KEY = "authUserLD";
const ORIGINAL_KEY = "originalAuthUserLD";
const ROLES_KEY = "roles";
const ORIGINAL_ROLES_KEY = "originalRoles";

export function isSwitchedUser(): boolean {
    return !!localStorage.getItem(ORIGINAL_KEY);
}

export function getOriginalUser(): any | null {
    const raw = localStorage.getItem(ORIGINAL_KEY);
    return raw ? JSON.parse(raw) : null;
}

export function getCurrentUser(): any | null {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
}

/**
 * Calls the switch API and makes the returned user the active session,
 * while preserving the real logged-in user so we can come back to them.
 */
export async function switchToUser(userID: number, currentToken: string) {
    const res = await axios.post(
        "/t2.0/authentificationUtilization/user/switch",
        { userID },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`,
            },
        }
    );

    const newUserData = res.data;

    // Stash the original identity only if we're not already switched —
    // switching a second time shouldn't overwrite who to return to.
    if (!localStorage.getItem(ORIGINAL_KEY)) {
        const current = localStorage.getItem(CURRENT_KEY);
        if (current) localStorage.setItem(ORIGINAL_KEY, current);

        const currentRoles = localStorage.getItem(ROLES_KEY);
        if (currentRoles) localStorage.setItem(ORIGINAL_ROLES_KEY, currentRoles);
    }

    localStorage.setItem(CURRENT_KEY, JSON.stringify(newUserData));

    // Fetch AMRole for the switched user
    const roleId = newUserData.userRole;
    if (roleId) {
        try {
            const roleRes = await axios.get(
                `/t2.0/authentificationUtilization/AMRole/${roleId}`,
                {
                    headers: {
                        Authorization: `Bearer ${newUserData.token}`,
                    },
                }
            );
            if (roleRes.data?.status) {
                localStorage.setItem(ROLES_KEY, JSON.stringify(roleRes.data.response || {}));
            }
        } catch (err) {
            console.error("AMRole fetch failed during switch:", err);
        }
    }

    return newUserData;
}

/**
 * Restores the original logged-in user and clears the "switched" marker.
 * Returns the restored user, or null if there was nothing to switch back to.
 */
export function switchBackToOriginal(): any | null {
    const original = localStorage.getItem(ORIGINAL_KEY);
    if (!original) return null;

    localStorage.setItem(CURRENT_KEY, original);
    localStorage.removeItem(ORIGINAL_KEY);

    // Restore original roles
    const originalRoles = localStorage.getItem(ORIGINAL_ROLES_KEY);
    if (originalRoles) {
        localStorage.setItem(ROLES_KEY, originalRoles);
        localStorage.removeItem(ORIGINAL_ROLES_KEY);
    }

    return JSON.parse(original);
}