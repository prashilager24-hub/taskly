import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { CheckCircle2, Handshake, Hourglass, MessageSquareWarning } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type Round, type RoundPerson } from "./api";
import { LEVEL_LABEL, SHARE_COLOR, SHARE_LABEL, day, inr, parseAmount, periodLabel, showAmount } from "./format";
import { AmountBox, Banner, BudgetBar, BudgetLog, HikeField, RoundChip, SplitTable, TextBox } from "./parts";

const th = "px-4 py-2.5 text-left";
const Name = ({ p }: { p: RoundPerson }) => (
    <div><Link to={`/appraisal/person/${p.cycleId}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline dark:text-white">{p.name}</Link><p className="text-xs text-ink-500">{LEVEL_LABEL[p.level]}{p.pmsAvg != null ? ` · PMS ${p.pmsAvg}` : ""}</p></div>
);
const Why = ({ p }: { p: RoundPerson }) => p.why ? <p className="line-clamp-2 max-w-[34ch] whitespace-normal break-words text-xs text-ink-500" title={p.why}>{p.why}</p> : <span className="text-xs text-ink-400">No reason given</span>;

// ── Before the budget: waiting for the Finance Head ──────────────────────────────────────────────

function Waiting({ r }: { r: Round }) {
    return (
        <div className="flex flex-col gap-4">
            <Banner>{r.status === "READY_FOR_FINANCE" ? "Everyone has appealed. The Finance Head is reviewing your department and will send you its budget." : `Waiting for everyone to appeal: ${r.totals.submitted} of ${r.totals.people} so far. The Finance Head sets the budget once the department is complete.`}</Banner>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Expected", "Target", "Why", "Appeal"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>{r.people.map((p) => (
                        <tr key={p.cycleId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                            <td className="px-4 py-3"><Name p={p} /></td><td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td><td className="px-4 py-3 tabular-nums">{inr(p.target)}</td>
                            <td className="px-4 py-3"><Why p={p} /></td><td className="px-4 py-3 text-xs">{p.submittedAt ? `Submitted ${day(p.submittedAt)}` : "Not yet"}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            {r.notStarted.length > 0 && <p className="text-xs text-ink-500">Not opened their appraisal yet: {r.notStarted.map((n) => n.name).join(", ")}</p>}
        </div>
    );
}

// ── The budget from the Finance Head: accept it or negotiate ─────────────────────────────────────

function BudgetAnswer({ r, onDone }: { r: Round; onDone: () => void }) {
    const waitingOnFinance = r.status === "BUDGET_NEGOTIATION";
    const [mode, setMode] = useState<"accept" | "negotiate" | null>(null);
    const [comment, setComment] = useState("");
    const [ask, setAsk] = useState("");
    const [busy, setBusy] = useState(false);
    const send = async () => {
        if (mode === "negotiate" && !comment.trim()) { addToast({ title: "Write what you would like changed and why", color: "warning" }); return; }
        setBusy(true);
        try {
            await appraisalApi.respondBudget(r.departmentId, r.period, { accept: mode === "accept", comment: comment.trim() || undefined, amount: mode === "negotiate" ? parseAmount(ask) : undefined });
            addToast(mode === "accept" ? { title: "Budget accepted", description: "You can split it now.", color: "success" } : { title: "Sent to the Finance Head", description: "They will revise the budget and send it back to you.", color: "success" });
            setMode(null); setComment(""); setAsk(""); onDone();
        } catch (e) { addToast({ title: "Could not send", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-4">
                <div className={waitingOnFinance ? "border border-ink-200 p-5 dark:border-white/10" : "border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10"}>
                    <p className="eyebrow">{waitingOnFinance ? "Budget offered by the Finance Head" : `Budget proposed by the Finance Head · ${day(r.budgetSetAt)}`}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.budget)}</p>
                    {r.financeComment && <p className="mt-3 max-w-[80ch] whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{r.financeComment}</p>}
                    <p className="mt-3 text-xs text-ink-500">Department total expected {inr(r.totals.expected)} · targeted {inr(r.totals.target)}</p>
                </div>
                {waitingOnFinance ? (
                    <Banner>You asked the Finance Head to change this budget. It comes back to you here once they revise it.</Banner>
                ) : mode == null ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-ink-600 dark:text-ink-300">Accept the budget to start splitting it, or negotiate it with the Finance Head. You split it only after you accept it.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button color="success" startContent={<Handshake size={16} />} onPress={() => setMode("accept")}>Accept budget</Button>
                            <Button variant="bordered" color="warning" startContent={<MessageSquareWarning size={16} />} onPress={() => setMode("negotiate")}>Negotiate budget</Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 border border-ink-200 p-4 dark:border-white/10">
                        <p className="text-sm font-semibold text-ink-900 dark:text-white">{mode === "accept" ? `Accept ${inr(r.budget)} for ${r.department}?` : "Negotiate the budget"}</p>
                        {mode === "negotiate" && (
                            <label className="flex flex-col gap-1.5">
                                <span className="eyebrow">Amount you ask for (optional)</span>
                                <input inputMode="numeric" placeholder="₹ per year" value={ask} onChange={(e) => setAsk(showAmount(parseAmount(e.target.value)))} className="h-10 w-60 border border-ink-200 bg-transparent px-3 font-bold tabular-nums text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:text-white" />
                            </label>
                        )}
                        <Textarea label={mode === "accept" ? "Comment (optional)" : "What would you like changed, and why (required)"} minRows={3} value={comment} onValueChange={setComment} description="The Finance Head sees it, and it stays in the budget log." />
                        <div className="flex justify-end gap-2">
                            <Button variant="light" isDisabled={busy} onPress={() => setMode(null)}>Back</Button>
                            <Button color={mode === "accept" ? "success" : "warning"} isLoading={busy} isDisabled={mode === "negotiate" && !comment.trim()} onPress={send}>{mode === "accept" ? "Accept budget" : "Send to the Finance Head"}</Button>
                        </div>
                    </div>
                )}
            </div>
            <Panel title="Budget discussion"><BudgetLog log={r.budgetLog} budget={r.budget} /></Panel>
        </div>
    );
}

// ── The split ────────────────────────────────────────────────────────────────────────────────────

function SplitForm({ r, onDone }: { r: Round; onDone: () => void }) {
    const own = r.people.find((p) => p.source === "EL_OWN");
    const direct = r.people.filter((p) => p.source === "EL_DIRECT");
    const [ownAmt, setOwnAmt] = useState<number | null>(own?.allocation ?? null);
    const [ownNote, setOwnNote] = useState(own?.reason ?? "");
    const [dir, setDir] = useState<Record<number, { amount: number | null; reason: string }>>(() => Object.fromEntries(direct.map((p) => [p.cycleId, { amount: p.allocation, reason: p.reason }])));
    const [sh, setSh] = useState<Record<number, { amount: number | null; comment: string }>>(() => Object.fromEntries(r.shares.map((s) => [s.flUserId, { amount: s.status === "PLANNED" && !s.amount ? null : s.amount, comment: s.elComment }])));
    const [busy, setBusy] = useState<"draft" | "send" | null>(null);
    const [confirm, setConfirm] = useState(false);

    const sum = (o: Record<number, { amount: number | null }>) => Object.values(o).reduce((t, x) => t + (x.amount ?? 0), 0);
    const total = (ownAmt ?? 0) + sum(dir) + sum(sh);
    const over = r.budget != null && total > r.budget;
    const missing = [own && ownAmt == null ? "your own hike" : "", ...direct.filter((p) => dir[p.cycleId]?.amount == null).map((p) => p.name), ...r.shares.filter((s) => sh[s.flUserId]?.amount == null).map((s) => `${s.name}'s share`)].filter(Boolean);

    const save = async (send: boolean) => {
        setBusy(send ? "send" : "draft");
        try {
            await appraisalApi.saveSplit(r.departmentId, r.period, {
                own: own && ownAmt != null ? { amount: ownAmt, comment: ownNote } : undefined,
                direct: direct.filter((p) => dir[p.cycleId]?.amount != null).map((p) => ({ cycleId: p.cycleId, amount: dir[p.cycleId].amount!, reason: dir[p.cycleId].reason })),
                shares: r.shares.map((s) => ({ flUserId: s.flUserId, amount: sh[s.flUserId]?.amount ?? 0, comment: sh[s.flUserId]?.comment ?? "" })),
                send,
            });
            addToast({ title: send ? "Shares sent to the FLs" : "Split saved", description: send ? "Each FL has been told their budget. Your own hike and your direct reports' hikes are out." : undefined, color: "success" });
            setConfirm(false); onDone();
        } catch (e) { addToast({ title: send ? "Could not send" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(null); }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10">
                <p className="eyebrow">Agreed budget · you accepted it {day(r.elAcceptedAt)}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.budget)}</p>
                {r.financeComment && <p className="mt-3 max-w-[80ch] whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{r.financeComment}</p>}
                <p className="mt-3 text-xs text-ink-500">Department total expected {inr(r.totals.expected)} · targeted {inr(r.totals.target)}. Discuss the split with your assessors, then enter it here.</p>
            </div>
            <BudgetBar total={r.budget ?? 0} parts={[
                ...(own ? [{ label: "My own hike", amount: ownAmt ?? 0, color: "bg-emerald-500" }] : []),
                ...(direct.length ? [{ label: "Direct reports", amount: sum(dir), color: "bg-sky-500" }] : []),
                ...r.shares.map((s, i) => ({ label: s.name, amount: sh[s.flUserId]?.amount ?? 0, color: ["bg-brand-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"][i % 5] })),
            ]} />

            {own && (
                <div className="grid grid-cols-1 gap-4 border border-emerald-500/40 p-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2"><p className="eyebrow !text-emerald-700 dark:!text-emerald-400">My own hike · agreed with Management</p><HikeField label="My hike (per year)" value={ownAmt} onChange={setOwnAmt} level={own.level} hint={own.expected != null ? `You asked for ${inr(own.expected)}` : undefined} /></div>
                    <Textarea label="Comment from Management" minRows={4} value={ownNote} onValueChange={setOwnNote} description="What Management told you about your hike." />
                </div>
            )}

            {direct.length > 0 && (
                <Panel flush title="Reporting to me directly">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-sm">
                            <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Expected", "Target", "Why", "Hike", "Reason"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                            <tbody>{direct.map((p) => (
                                <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                    <td className="px-4 py-3"><Name p={p} /></td><td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td><td className="px-4 py-3 tabular-nums">{inr(p.target)}</td><td className="px-4 py-3"><Why p={p} /></td>
                                    <td className="w-40 px-4 py-3"><AmountBox label={`Hike for ${p.name}`} value={dir[p.cycleId]?.amount ?? null} onChange={(v) => setDir((d) => ({ ...d, [p.cycleId]: { ...d[p.cycleId], amount: v } }))} /></td>
                                    <td className="w-64 px-4 py-3"><TextBox label={`Reason for ${p.name}`} placeholder="Why this hike" value={dir[p.cycleId]?.reason ?? ""} onChange={(v) => setDir((d) => ({ ...d, [p.cycleId]: { ...d[p.cycleId], reason: v } }))} /></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                </Panel>
            )}

            <Panel flush title="A share for each FL">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["FL / Manager", "People", "Team expected", "Share", "Note to this FL"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {r.shares.map((s) => (
                                <tr key={s.flUserId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                    <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{s.name}</td>
                                    <td className="px-4 py-3 tabular-nums">{s.people}</td>
                                    <td className="px-4 py-3 tabular-nums">{inr(s.teamExpected + (r.people.find((p) => p.userId === s.flUserId)?.expected ?? 0))}</td>
                                    <td className="w-40 px-4 py-3"><AmountBox label={`Share for ${s.name}`} value={sh[s.flUserId]?.amount ?? null} onChange={(v) => setSh((x) => ({ ...x, [s.flUserId]: { ...x[s.flUserId], amount: v } }))} /></td>
                                    <td className="w-80 px-4 py-3"><TextBox label={`Note to ${s.name}`} placeholder="Why this share" value={sh[s.flUserId]?.comment ?? ""} onChange={(v) => setSh((x) => ({ ...x, [s.flUserId]: { ...x[s.flUserId], comment: v } }))} /></td>
                                </tr>
                            ))}
                            {!r.shares.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">No FL in this department. Everyone reports to you directly.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {confirm ? (
                <div className="flex flex-col gap-3 border border-brand-600 p-4">
                    <p className="text-sm text-ink-800 dark:text-ink-100"><b>Send the split?</b> Each FL is told their share and your note. {own || direct.length ? "Your own hike and your direct reports' hikes go out to them now. " : ""}You cannot change the split afterwards.</p>
                    <div className="flex justify-end gap-2"><Button variant="bordered" isDisabled={busy !== null} onPress={() => setConfirm(false)}>Back</Button><Button color="primary" isLoading={busy === "send"} onPress={() => save(true)}>Send to the FLs</Button></div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <p className="mr-auto text-xs text-ink-500">{over ? <span className="font-semibold text-rose-600">{inr(total - (r.budget ?? 0))} over the budget</span> : missing.length ? `Still to enter: ${missing.join(", ")}` : "Everything is filled in."}</p>
                    <Button variant="bordered" isLoading={busy === "draft"} isDisabled={busy !== null || over} onPress={() => save(false)}>Save draft</Button>
                    <Button color="primary" isDisabled={busy !== null || over || missing.length > 0} onPress={() => setConfirm(true)}>Send shares to FLs</Button>
                </div>
            )}
        </div>
    );
}

// ── After the split: FL proposals to approve, everyone's hike ────────────────────────────────────

function Proposal({ r, flUserId, onDone }: { r: Round; flUserId: number; onDone: () => void }) {
    const s = r.shares.find((x) => x.flUserId === flUserId)!;
    const people = r.people.filter((p) => p.flUserId === flUserId);
    const [busy, setBusy] = useState(false);
    const approve = async () => {
        setBusy(true);
        try { await appraisalApi.approveShare(r.departmentId, r.period, flUserId); addToast({ title: `${s.name}'s allocation approved`, description: "The hikes are out to the team.", color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not approve", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <Panel flush title={`${s.name} · team allocation`} actions={<Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>}>
            <div className="flex flex-col gap-4 p-5">
                <BudgetBar total={s.amount} parts={[{ label: "Team", amount: people.filter((p) => p.source === "FL_TEAM").reduce((t, p) => t + (p.allocation ?? 0), 0), color: "bg-brand-500" }, { label: `${s.name}'s own`, amount: people.find((p) => p.source === "FL_OWN")?.allocation ?? 0, color: "bg-violet-500" }]} />
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Expected", "Target", "Hike", "Reason"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>{people.map((p) => (
                            <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                <td className="px-4 py-3"><Name p={p} />{p.source === "FL_OWN" && <Chip size="sm" variant="flat" className="mt-1">FL's own</Chip>}</td>
                                <td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td><td className="px-4 py-3 tabular-nums">{inr(p.target)}</td>
                                <td className="px-4 py-3 font-semibold tabular-nums text-ink-900 dark:text-white">{inr(p.allocation)}</td>
                                <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-300">{p.reason || "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
                {s.justification && <div><p className="eyebrow">Justification</p><p className="mt-1 whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{s.justification}</p></div>}
                {s.status === "SUBMITTED" && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
                        <p className="mr-auto text-xs text-ink-500">There is no reject: this was agreed in your discussion. Approving makes the hikes final and sends them out.</p>
                        <Button color="success" isLoading={busy} startContent={<CheckCircle2 size={16} />} onPress={approve}>Approve</Button>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function DirectReturned({ r, p, onDone }: { r: Round; p: RoundPerson; onDone: () => void }) {
    const [amount, setAmount] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const send = async () => {
        if (amount == null) return;
        setBusy(true);
        try { await appraisalApi.offerDirect(r.departmentId, r.period, p.cycleId, amount, reason); addToast({ title: `New hike sent to ${p.name}`, color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not send", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <div className="grid grid-cols-1 items-end gap-3 border border-amber-500/40 p-4 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto]">
            <div><p className="eyebrow">Back from postponement</p><Name p={p} /></div>
            <AmountBox label={`New hike for ${p.name}`} value={amount} onChange={setAmount} />
            <TextBox label="Reason" placeholder="Why this hike" value={reason} onChange={setReason} />
            <Button color="primary" isLoading={busy} isDisabled={amount == null} onPress={send}>Send hike</Button>
        </div>
    );
}

function After({ r, onDone }: { r: Round; onDone: () => void }) {
    const waiting = r.shares.filter((s) => s.status === "SUBMITTED");
    const others = r.shares.filter((s) => s.status !== "SUBMITTED");
    const returned = r.people.filter((p) => p.source === "EL_DIRECT" && p.status === "SUBMITTED");
    return (
        <div className="flex flex-col gap-6">
            <BudgetBar total={r.budget ?? 0} parts={[
                { label: "My own and direct reports", amount: r.people.filter((p) => p.source === "EL_OWN" || p.source === "EL_DIRECT").reduce((t, p) => t + (p.allocation ?? 0), 0), color: "bg-emerald-500" },
                ...r.shares.map((s, i) => ({ label: s.name, amount: s.amount, color: ["bg-brand-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"][i % 5] })),
            ]} />
            {returned.map((p) => <DirectReturned key={p.cycleId} r={r} p={p} onDone={onDone} />)}
            {waiting.map((s) => <Proposal key={s.flUserId} r={r} flUserId={s.flUserId} onDone={onDone} />)}
            {!waiting.length && r.status !== "FINALISED" && <Banner>Waiting for the FLs to send their team allocation. You are told as soon as one arrives.</Banner>}
            {r.status === "FINALISED" && <Banner>Every hike in {r.department} is decided.</Banner>}
            {others.length > 0 && (
                <Panel flush title="FL shares">
                    {others.map((s) => (
                        <div key={s.flUserId} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3 last:border-0 dark:border-white/5">
                            <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</p><p className="text-xs text-ink-500">{inr(s.allocated)} of {inr(s.amount)} · {s.people} {s.people === 1 ? "person" : "people"}{s.elComment ? ` · your note: ${s.elComment}` : ""}</p></div>
                            <Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>
                        </div>
                    ))}
                </Panel>
            )}
            <Panel flush title={r.status === "FINALISED" ? "Final split" : "Split so far"}><SplitTable r={r} /></Panel>
            <Panel title="Budget discussion"><BudgetLog log={r.budgetLog} budget={r.budget} /></Panel>
        </div>
    );
}

// Budget split (EL): the budget from the Finance Head, split between the EL's own hike, direct reports and a share per FL;
// then the FL proposals to approve.
export default function Split() {
    const [rounds, setRounds] = useState<Round[] | null>(null);
    const [pick, setPick] = useState(0);
    const load = useCallback(async () => {
        try { setRounds(await appraisalApi.split()); }
        catch (e) { addToast({ title: "Could not load your departments", description: errorText(e), color: "danger" }); setRounds([]); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const r = rounds?.[pick];
    const todo = useMemo(() => (rounds ?? []).map((x) => (x.status === "BUDGET_WITH_EL" || x.status === "BUDGET_ACCEPTED" ? 1 : 0) + x.shares.filter((s) => s.status === "SUBMITTED").length), [rounds]);
    if (!rounds) return <div className="flex justify-center py-20"><Spinner /></div>;
    if (!rounds.length || !r) return <Panel><p className="py-10 text-center text-sm text-ink-500">Nobody in the departments you lead has an appraisal yet.</p></Panel>;

    return (
        <div className="flex flex-col gap-6">
            {rounds.length > 1 && (
                <div className="flex flex-wrap gap-2">{rounds.map((x, i) => <Button key={`${x.departmentId}-${x.period}`} size="sm" variant={i === pick ? "solid" : "bordered"} color={i === pick ? "primary" : "default"} onPress={() => setPick(i)}>{x.department} · {periodLabel(x.period)}{todo[i] ? ` (${todo[i]})` : ""}</Button>)}</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-2xl font-bold text-ink-900 dark:text-white">{r.department}</h2><p className="text-sm text-ink-500">{periodLabel(r.period)}</p></div>
                <RoundChip status={r.status} />
            </div>
            <SummaryBar className="mb-0" items={[
                { label: "Appeals in", value: `${r.totals.submitted} / ${r.totals.people}` },
                { label: "Department total expected", value: inr(r.totals.expected), hint: `Targeted ${inr(r.totals.target)}` },
                { label: "Budget", value: r.elAcceptedAt ? inr(r.budget) : r.status === "BUDGET_WITH_EL" ? "Not accepted" : r.status === "BUDGET_NEGOTIATION" ? "Negotiating" : "Not set yet", hint: r.status === "BUDGET_WITH_EL" ? "Accept it below to split it" : r.status === "BUDGET_NEGOTIATION" ? "With the Finance Head" : undefined },
                { label: "FLs", value: r.shares.length || r.fls.length },
            ]} />
            {r.budget == null || r.status === "COLLECTING" || r.status === "READY_FOR_FINANCE" ? <Panel title="Waiting for the budget"><Waiting r={r} /></Panel>
                : r.status === "BUDGET_WITH_EL" || r.status === "BUDGET_NEGOTIATION" ? <BudgetAnswer key={`${r.departmentId}-${r.period}-${r.budgetLog.length}`} r={r} onDone={load} />
                : r.status === "BUDGET_ACCEPTED" ? <SplitForm key={`${r.departmentId}-${r.period}`} r={r} onDone={load} />
                : <After r={r} onDone={load} />}
            {r.status === "BUDGET_ACCEPTED" && <p className="flex items-center gap-2 text-xs text-ink-500"><Hourglass size={12} />Nothing is sent until you press Send shares to FLs.</p>}
        </div>
    );
}
