import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { Hourglass, Send, Undo2 } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type FlShare, type FlWaiting } from "./api";
import { LEVEL_LABEL, SHARE_COLOR, SHARE_LABEL, STATUS_LABEL, day, inr, periodLabel } from "./format";
import { Banner, BudgetBar, HikeCell, HikeField, SplitTable, TextBox, ownFrom, ownInvalid, ownToSend, type OwnVariable } from "./parts";

const th = "px-4 py-2.5 text-left";
/** People whose hike is already out (accepted, or on offer) are not decided again */
const decidedAlready = (status: string) => status === "OFFERED" || status === "ACCEPTED" || status === "POSTPONED";

function ShareCard({ s, onDone }: { s: FlShare; onDone: () => void }) {
    const team = s.people.filter((p) => !p.own);
    const me = s.people.find((p) => p.own);
    const editable = s.share.status === "SHARE_RECEIVED" || s.share.status === "DRAFT";
    const [rows, setRows] = useState<Record<number, { amount: number | null; reason: string; own: OwnVariable }>>(() => Object.fromEntries(s.people.map((p) => [p.cycleId, { amount: p.allocation, reason: p.reason, own: ownFrom(p.variable) }])));
    const [justification, setJustification] = useState(s.share.justification);
    const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
    const set = (id: number, patch: Partial<{ amount: number | null; reason: string; own: OwnVariable }>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

    const teamTotal = team.reduce((t, p) => t + (rows[p.cycleId]?.amount ?? 0), 0);
    const ownAmt = me ? rows[me.cycleId]?.amount ?? 0 : 0;
    const over = teamTotal + ownAmt > s.share.amount;
    const open = s.people.filter((p) => !decidedAlready(p.status));
    const badVar = open.some((p) => ownInvalid(rows[p.cycleId]?.own ?? null, rows[p.cycleId]?.amount ?? null));
    const missing = [...open.filter((p) => rows[p.cycleId]?.amount == null).map((p) => (p.own ? "your own hike" : p.name)), ...open.filter((p) => !p.own && !rows[p.cycleId]?.reason.trim()).map((p) => `why ${p.name}`), ...(justification.trim() ? [] : ["the justification"])];

    const save = async (submit: boolean) => {
        setBusy(submit ? "submit" : "draft");
        try {
            await appraisalApi.saveAllocation(s.departmentId, s.period, { items: open.map((p) => ({ cycleId: p.cycleId, amount: rows[p.cycleId]?.amount ?? null, reason: rows[p.cycleId]?.reason ?? "", variable: ownToSend(rows[p.cycleId]?.own ?? null) })), justification, submit });
            addToast({ title: submit ? `Sent to ${s.el?.name ?? "your EL"}` : "Draft saved", description: submit ? "Your EL approves it, then the hikes go out to your team." : undefined, color: "success" });
            onDone();
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(null); }
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-2xl font-bold text-ink-900 dark:text-white">{s.department}</h2><p className="text-sm text-ink-500">{periodLabel(s.period)} · your EL {s.el?.name ?? "—"}</p></div>
                <Chip variant="flat" color={SHARE_COLOR[s.share.status]}>{SHARE_LABEL[s.share.status]}</Chip>
            </div>
            <div className="border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10">
                <p className="eyebrow">Your team budget from {s.el?.name ?? "your EL"}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(s.share.amount)}</p>
                {s.share.elComment && <p className="mt-3 max-w-[80ch] whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{s.share.elComment}</p>}
            </div>
            {editable && s.share.returnedAt && (
                <div role="status" className="flex flex-col gap-1.5 border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-500/10">
                    <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200"><Undo2 size={16} />{s.el?.name ?? "Your EL"} sent your proposal back to revise · {day(s.share.returnedAt)}</p>
                    {s.share.returnComment && <p className="whitespace-pre-wrap border-l-2 border-amber-500 pl-3 text-sm text-ink-800 dark:text-ink-100">{s.share.returnComment}</p>}
                    <p className="text-xs text-ink-600 dark:text-ink-300">Enter the hikes again and submit.</p>
                </div>
            )}
            {s.share.status === "SUBMITTED" && <Banner>Sent to {s.el?.name ?? "your EL"} for approval. You cannot change it now.</Banner>}
            {s.share.status === "APPROVED" && <Banner>Approved by {s.el?.name ?? "your EL"}. Your team's hikes are released.</Banner>}
            {!editable && (
                <>
                    <Panel flush title={s.share.status === "APPROVED" ? "Final split · my team and me" : "Proposal sent · my team and me"}><SplitTable people={s.people} budget={s.share.amount} budgetLabel="% of team budget" /></Panel>
                    {s.share.justification && <div className="flex flex-col gap-1"><p className="eyebrow">Justification for the team</p><p className="whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-800 dark:text-ink-100">{s.share.justification}</p></div>}
                </>
            )}
            {editable && (
                <>
            <p className="max-w-[80ch] text-sm text-ink-500 dark:text-ink-400">Agree the hikes with your EL in person, then enter them here with the reason for each. Your own hike goes in its own box. When you submit, your EL approves it and the hikes go out.</p>
            <BudgetBar total={s.share.amount} parts={[{ label: "Team", amount: teamTotal, color: "bg-brand-500" }, ...(me ? [{ label: "My own hike", amount: ownAmt, color: "bg-violet-500" }] : [])]} />

            <Panel flush title={`My team · ${team.length} ${team.length === 1 ? "person" : "people"}`}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "PMS", "Expected", "Target", "Why they expect it", "Hike", "Reason for this hike"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {team.map((p) => {
                                const locked = !editable || decidedAlready(p.status);
                                return (
                                    <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                        <td className="px-4 py-3"><Link to={`/appraisal/person/${p.cycleId}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline dark:text-white">{p.name}</Link><p className="text-xs text-ink-500">{LEVEL_LABEL[p.level]}{decidedAlready(p.status) ? ` · ${STATUS_LABEL[p.status as "OFFERED"]}` : !p.submittedAt ? " · not appealed" : ""}</p></td>
                                        <td className="px-4 py-3 tabular-nums">{p.pmsAvg ?? "—"}</td>
                                        <td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td>
                                        <td className="px-4 py-3 tabular-nums">{inr(p.target)}</td>
                                        <td className="px-4 py-3">{p.why ? <p className="line-clamp-3 max-w-[30ch] whitespace-normal break-words text-xs text-ink-600 dark:text-ink-300" title={p.why}>{p.why}</p> : <span className="text-xs text-ink-400">—</span>}</td>
                                        <td className="w-64 px-4 py-3"><HikeCell label={`Hike for ${p.name}`} value={rows[p.cycleId]?.amount ?? null} disabled={locked} onChange={(v) => set(p.cycleId, { amount: v })} level={p.level} own={rows[p.cycleId]?.own ?? null} onOwn={(v) => set(p.cycleId, { own: v })} /></td>
                                        <td className="w-72 px-4 py-3"><TextBox label={`Reason for ${p.name}`} placeholder="Why this amount" value={rows[p.cycleId]?.reason ?? ""} disabled={locked} onChange={(v) => set(p.cycleId, { reason: v })} /></td>
                                    </tr>
                                );
                            })}
                            {!team.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">Nobody in your team has an appraisal in this cycle.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {me && (
                <div className="grid grid-cols-1 gap-4 border border-violet-500/40 p-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <p className="eyebrow !text-violet-700 dark:!text-violet-300">My own hike · agreed with {s.el?.name ?? "my EL"}</p>
                        {editable && !decidedAlready(me.status) ? <HikeField label="My hike (per year)" value={rows[me.cycleId]?.amount ?? null} onChange={(v) => set(me.cycleId, { amount: v })} level={me.level} own={rows[me.cycleId]?.own ?? null} onOwn={(v) => set(me.cycleId, { own: v })} hint={me.expected != null ? `You asked for ${inr(me.expected)}` : undefined} />
                            : <p className="text-2xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(rows[me.cycleId]?.amount)}</p>}
                    </div>
                    <Textarea label="Note on my own hike (optional)" minRows={3} isDisabled={!editable || decidedAlready(me.status)} value={rows[me.cycleId]?.reason ?? ""} onValueChange={(v) => set(me.cycleId, { reason: v })} />
                </div>
            )}

            <Textarea label="Justification for the team as a whole" minRows={3} value={justification} onValueChange={setJustification} description="Why the hikes are spread this way. Your EL sees it with the proposal." />

                </>
            )}

            {editable && (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <p className="mr-auto text-xs text-ink-500">{over ? <span className="font-semibold text-rose-600">{inr(teamTotal + ownAmt - s.share.amount)} over your budget</span> : badVar ? <span className="font-semibold text-rose-600">Fix the variable pay override</span> : missing.length ? `Still to fill in: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}` : "Ready to send."}</p>
                    <Button variant="bordered" isLoading={busy === "draft"} isDisabled={busy !== null || over || badVar} onPress={() => save(false)}>Save draft</Button>
                    <Button color="primary" startContent={<Send size={14} />} isLoading={busy === "submit"} isDisabled={busy !== null || over || badVar || missing.length > 0} onPress={() => save(true)}>Submit to {s.el?.name ?? "EL"} for approval</Button>
                </div>
            )}
        </div>
    );
}

// Team allocation (FL): the share the EL gave, turned into a hike for each team member and the FL's own, sent to the EL.
export default function Allocation() {
    const [data, setData] = useState<{ shares: FlShare[]; waiting: FlWaiting[] } | null>(null);
    const [pick, setPick] = useState(0);
    const load = useCallback(async () => {
        try { setData(await appraisalApi.allocation()); }
        catch (e) { addToast({ title: "Could not load your team budget", description: errorText(e), color: "danger" }); setData({ shares: [], waiting: [] }); }
    }, []);
    useEffect(() => { load(); }, [load]);
    if (!data) return <div className="flex justify-center py-20"><Spinner /></div>;
    const s = data.shares[pick];

    return (
        <div className="flex flex-col gap-6">
            {data.waiting.map((w) => (
                <Panel key={`${w.department}-${w.period}`} title={`${w.department} · ${periodLabel(w.period)}`}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-600/10"><Hourglass size={18} /></span>
                            <div><p className="text-base font-bold text-ink-900 dark:text-white">Your team's appraisal is in progress</p><p className="text-sm text-ink-500">We will let you know soon.</p></div>
                        </div>
                        <SummaryBar className="mb-0" items={[{ label: "In your team (and you)", value: w.team }, { label: "Appeals in", value: `${w.submitted} / ${w.team}` }]} />
                    </div>
                </Panel>
            ))}
            {data.shares.length > 1 && <div className="flex flex-wrap gap-2">{data.shares.map((x, i) => <Button key={x.roundId} size="sm" variant={i === pick ? "solid" : "bordered"} color={i === pick ? "primary" : "default"} onPress={() => setPick(i)}>{x.department} · {periodLabel(x.period)}</Button>)}</div>}
            {s ? <ShareCard key={`${s.roundId}-${s.share.status}`} s={s} onDone={load} /> : !data.waiting.length && <Panel><p className="py-10 text-center text-sm text-ink-500">You have no team budget yet.</p></Panel>}
        </div>
    );
}
