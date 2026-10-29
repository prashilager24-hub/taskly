import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";

import { Segmented, SummaryBar } from "@/components/page";
import { addToast } from "@/components/ui";
import { accessApi, errorText, type LogRow } from "./api";

type Security = Awaited<ReturnType<typeof accessApi.security>>;

/** Two-factor sign-in for the whole organisation, plus the trail of who changed access */
export default function SecurityTab({ onChanged }: { onChanged: () => void }) {
    const [sec, setSec] = useState<Security | null>(null);
    const [log, setLog] = useState<LogRow[]>([]);

    const load = useCallback(() => {
        accessApi.security().then(setSec).catch((e) => addToast({ title: "Could not load security", description: errorText(e), color: "danger" }));
        accessApi.log().then(setLog).catch(() => undefined);
    }, []);
    useEffect(load, [load]);

    const change = async (value: "on" | "off") => {
        try {
            await accessApi.setDefaultTwoFactor(value);
            addToast({ title: `Two-factor is ${value} by default`, description: value === "on" ? "People sign in with a password and an emailed code." : "People sign in with a password only, unless set otherwise for them.", color: "success" });
            load(); onChanged();
        } catch (e) { addToast({ title: "Could not change", description: errorText(e), color: "danger" }); }
    };

    return (
        <div className="flex flex-col gap-6">
            {sec && (
                <SummaryBar className="lg:grid-cols-3" items={[
                    { label: "Default", value: sec.twoFactorDefault === "on" ? "Two-factor on" : "Two-factor off", hint: "For everyone without their own setting" },
                    { label: "Signing in with a code", value: sec.totals.withTwoFactor, hint: `of ${sec.totals.users} people` },
                    { label: "Password only", value: sec.totals.withoutTwoFactor, hint: "No emailed code" },
                ]} />
            )}

            <section className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Two-factor sign-in</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
                    When on, a correct password is followed by a 6-digit code emailed to the person. The default below applies to everyone. You can still turn it on or off for one person from the Users tab (Access → Sign-in security).
                </p>
                {sec && <div className="mt-4"><Segmented label="Two-factor default" value={sec.twoFactorDefault} onChange={change} options={[{ key: "on", label: "On for everyone" }, { key: "off", label: "Off by default" }]} /></div>}
            </section>

            <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <h2 className="border-b border-ink-200 px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-ink-900 dark:border-white/10 dark:text-white">Recent changes</h2>
                <ul className="divide-y divide-ink-100 dark:divide-white/5">
                    {log.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                            <span className="text-ink-900 dark:text-white">{l.summary}</span>
                            <span className="text-xs text-ink-500 dark:text-ink-400">{l.actor} · {format(new Date(l.at), "dd MMM yyyy, HH:mm")}</span>
                        </li>
                    ))}
                    {!log.length && <li className="px-5 py-8 text-center text-sm text-ink-500">Nothing has changed yet.</li>}
                </ul>
            </section>
        </div>
    );
}
