/** PMS years start in 2025 */
export const FIRST_YEAR = 2025;

/** FIRST_YEAR up to the current year, plus `ahead` more (for forms that look forward) */
export const yearRange = (ahead = 0): number[] => {
    const last = Math.max(new Date().getFullYear() + ahead, FIRST_YEAR);
    return Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
};
