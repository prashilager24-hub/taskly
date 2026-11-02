// The Onboarding Experience is for new joiners. A person is flagged "new" when they are added and stays so until
// they submit the survey. Super Admin and HR keep it to follow up on the surveys they send.
// (Sessions from before the flag existed fall back to the old rule: the first 45 days after joining.)
export const ONBOARDING_DAYS = 45;

export function showOnboarding(user: { userRole?: number; joinedAt?: string | null; isNewJoiner?: boolean; feedbackresolverteam?: string | null } | null | undefined): boolean {
    if (!user) return false;
    if (user.userRole === 1 || user.userRole === 4) return true;
    // HR / L&D team members (whatever their role) send the surveys and follow up on them
    if (user.feedbackresolverteam === "HR" || user.feedbackresolverteam === "L_D") return true;
    if (typeof user.isNewJoiner === "boolean") return user.isNewJoiner;
    if (!user.joinedAt) return true; // joining date not known yet (older sign-in): do not hide
    const joined = new Date(user.joinedAt).getTime();
    if (Number.isNaN(joined)) return true;
    return Date.now() - joined <= ONBOARDING_DAYS * 24 * 3600 * 1000;
}
