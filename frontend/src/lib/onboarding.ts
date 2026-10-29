// The Onboarding Experience is for new joiners: it is shown for their first 1.5 months (45 days) after joining,
// then hidden. Super Admin and HR keep it to follow up on the surveys they send.
export const ONBOARDING_DAYS = 45;

export function showOnboarding(user: { userRole?: number; joinedAt?: string | null } | null | undefined): boolean {
    if (!user) return false;
    if (user.userRole === 1 || user.userRole === 4) return true;
    if (!user.joinedAt) return true; // joining date not known yet (older sign-in): do not hide
    const joined = new Date(user.joinedAt).getTime();
    if (Number.isNaN(joined)) return true;
    return Date.now() - joined <= ONBOARDING_DAYS * 24 * 3600 * 1000;
}
