import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

/** Shown instead of a page the signed-in person has no access to */
export default function AccessDenied({ module }: { module?: string }) {
    return (
        <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 border border-ink-200 bg-white p-10 text-center dark:border-white/10 dark:bg-ink-900">
            <ShieldOff size={28} className="text-brand-600" aria-hidden />
            <h1 className="text-lg font-bold uppercase tracking-wide text-ink-900 dark:text-white">No access</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400">
                Your account does not have access to this page{module ? ` (${module})` : ""}. Ask an administrator if you need it.
            </p>
            <Link to="/dashboard" className="mt-2 text-xs font-bold uppercase tracking-wide text-brand-600 hover:underline">Back to dashboard</Link>
        </div>
    );
}
