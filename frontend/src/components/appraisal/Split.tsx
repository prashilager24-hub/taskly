import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { CheckCircle2, Handshake, Hourglass, MessageSquareWarning, RotateCcw, Undo2 } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Tab, Tabs, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type Round, type RoundPerson } from "./api";
import { LEVEL_LABEL, SHARE_COLOR, SHARE_LABEL, ctcRise, day, inr, parseAmount, pctOf, periodLabel, showAmount, splitPreview } from "./format";
import { Banner, BudgetBar, BudgetLog, HikeCell, HikeField, RoundChip, SplitTable, TextBox, ownFrom, ownInvalid, ownToSend, type OwnVariable } from "./parts";

const th = "px-4 py-2.5 text-left";
const COLORS = ["bg-brand-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"];
/** A hike already out to the person (on offer, accepted or postponed) is not decided again */
const decided = (p: RoundPerson) => p.status !== "EMPLOYEE_OPEN" && p.status !== "SUBMITTED";
const Name = ({ p }: { p: RoundPerson }) => (
    <div><Link to={`/appraisal/person/${p.cycleId}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline dark:text-white">{p.name}</Link><p className="text-xs text-ink-500">{LEVEL_LABEL[p.level]}{p.pmsAvg != null ? ` · PMS ${p.pmsAvg}` : ""}</p></div>
);
const Why = ({ p }: { p: RoundPerson }) => p.why ? <p className="line-clamp-2 max-w-[34ch] whitespace-normal break-words text-xs text-ink-500" title={p.why}>{p.why}</p> : <span className="text-xs text-ink-400">No reason given</span>;
/** An amount and what it adds to the person's CTC */
const OnCtc = ({ p, amount }: { p: RoundPerson; amount: number | null }) => {
    const rise = ctcRise(p.currentAnnualCtc, amount);
    return <><p className="tabular-nums">{inr(amount)}</p>{rise && <p className="text-xs tabular-nums text-ink-500">+{rise.pct}% on CTC</p>}</>;
};

// ── Appeals tab ──────────────────────────────────────────────────────────────────────────────────

function Appeals({ r }: { r: Round }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Current CTC", "Expected", "Target", "Why", "Appeal"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>{r.people.map((p) => (
                        <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                            <td className="px-4 py-3"><Name p={p} /></td>
                            <td className="px-4 py-3 tabular-nums">{inr(p.currentAnnualCtc)}</td>
                            <td className="px-4 py-3"><OnCtc p={p} amount={p.expected} /></td>
                            <td className="px-4 py-3"><OnCtc p={p} amount={p.target} /></td>
                            <td className="px-4 py-3"><Why p={p} /></td>
                            <td className="px-4 py-3 text-xs">{p.submittedAt ? `Submitted ${day(p.submittedAt)}` : "Not yet"}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            {r.notStarted.length > 0 && <p className="text-xs text-ink-500">Not opened their appraisal yet: {r.notStarted.map((n) => n.name).join(", ")}</p>}
        </div>
    );
}

// ── Budget discussion tab: the budget from the Finance Head, accepted or negotiated, and the log ─────

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
            addToast(mode === "accept" ? { title: "Budget accepted", description: "Split it in the Budget split tab.", color: "success" } : { title: "Sent to the Finance Head", description: "They will revise the budget and send it back to you.", color: "success" });
            setMode(null); setComment(""); setAsk(""); onDone();
        } catch (e) { addToast({ title: "Could not send", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    return (
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
                    <Textarea label={mode === "accept" ? "Comment (optional)" : "What would you like changed, and why (required)"} minRows={3} value={comment} onValueChange={setComment} description="The Finance Head sees it, and it stays in the budget discussion." />
                    <div className="flex justify-end gap-2">
                        <Button variant="light" isDisabled={busy} onPress={() => setMode(null)}>Back</Button>
                        <Button color={mode === "accept" ? "success" : "warning"} isLoading={busy} isDisabled={mode === "negotiate" && !comment.trim()} onPress={send}>{mode === "accept" ? "Accept budget" : "Send to the Finance Head"}</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BudgetTab({ r, onDone }: { r: Round; onDone: () => void }) {
    const noBudget = r.budget == null || r.status === "COLLECTING" || r.status === "READY_FOR_FINANCE";
    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-4">
                {noBudget ? (
                    <Banner>{r.status === "READY_FOR_FINANCE" ? "Everyone has appealed. The Finance Head is reviewing your department and will propose its budget here." : `Waiting for everyone to appeal: ${r.totals.submitted} of ${r.totals.people} so far. The Finance Head proposes the budget once the department is complete.`}</Banner>
                ) : r.status === "BUDGET_WITH_EL" || r.status === "BUDGET_NEGOTIATION" ? (
                    <BudgetAnswer key={r.budgetLog.length} r={r} onDone={onDone} />
                ) : (
                    <div className="border border-emerald-500/50 bg-emerald-50 p-5 dark:bg-emerald-500/10">
                        <p className="eyebrow !text-emerald-700 dark:!text-emerald-400">Agreed budget · you accepted it {day(r.elAcceptedAt)}</p>
                        <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.budget)}</p>
                        {r.financeComment && <p className="mt-3 max-w-[80ch] whitespace-pre-wrap border-l-2 border-emerald-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{r.financeComment}</p>}
                        <p className="mt-3 text-xs text-ink-500">Department total expected {inr(r.totals.expected)} · targeted {inr(r.totals.target)}</p>
                    </div>
                )}
            </div>
            <Panel title="Budget discussion"><BudgetLog log={r.budgetLog} budget={r.budget} /></Panel>
        </div>
    );
}

// ── Budget split tab: the EL's own hike, direct reports, then the rest of the budget to the FLs ──────

/** The rest of the budget, spread over the FLs by what their teams (and they) expected; equally when nobody expected anything */
function spread(rest: number, r: Round) {
    const weights = r.shares.map((s) => s.teamExpected + (r.people.find((p) => p.userId === s.flUserId)?.expected ?? 0));
    const all = weights.reduce((t, w) => t + w, 0);
    const out: Record<number, number> = {};
    let given = 0;
    r.shares.forEach((s, i) => {
        const last = i === r.shares.length - 1;
        const v = last ? Math.max(0, rest) - given : Math.floor((Math.max(0, rest) * (all ? weights[i] / all : 1 / r.shares.length)));
        out[s.flUserId] = v; given += v;
    });
    return out;
}

function SplitForm({ r, onDone }: { r: Round; onDone: () => void }) {
    const own = r.people.find((p) => p.source === "EL_OWN");
    const direct = r.people.filter((p) => p.source === "EL_DIRECT");
    const ownLocked = !!own && decided(own);
    const [ownAmt, setOwnAmt] = useState<number | null>(own?.allocation ?? null);
    const [ownVar, setOwnVar] = useState<OwnVariable>(ownFrom(own?.variable));
    const [ownNote, setOwnNote] = useState(own?.reason ?? "");
    const [dir, setDir] = useState<Record<number, { amount: number | null; reason: string; own: OwnVariable }>>(() => Object.fromEntries(direct.map((p) => [p.cycleId, { amount: p.allocation, reason: p.reason, own: ownFrom(p.variable) }])));
    const [manual, setManual] = useState(() => r.shares.some((s) => s.amount > 0));
    const [typed, setTyped] = useState<Record<number, number | null>>(() => Object.fromEntries(r.shares.map((s) => [s.flUserId, s.amount])));
    const [notes, setNotes] = useState<Record<number, string>>(() => Object.fromEntries(r.shares.map((s) => [s.flUserId, s.elComment])));
    const [busy, setBusy] = useState<"draft" | "send" | null>(null);
    const [confirm, setConfirm] = useState(false);

    const budget = r.budget ?? 0;
    const dirSum = direct.reduce((t, p) => t + (dir[p.cycleId]?.amount ?? 0), 0);
    const rest = budget - (ownAmt ?? 0) - dirSum;
    const auto = useMemo(() => spread(rest, r), [rest, r]);
    const share = (id: number) => (manual ? typed[id] ?? null : auto[id] ?? 0);
    const shareSum = r.shares.reduce((t, s) => t + (share(s.flUserId) ?? 0), 0);
    const total = (ownAmt ?? 0) + dirSum + shareSum;
    const over = total > budget;
    const badVar = (!ownLocked && ownInvalid(ownVar, ownAmt)) || direct.some((p) => !decided(p) && ownInvalid(dir[p.cycleId]?.own ?? null, dir[p.cycleId]?.amount ?? null));
    const missing = [own && !ownLocked && ownAmt == null ? "your own hike" : "", ...direct.filter((p) => !decided(p) && dir[p.cycleId]?.amount == null).map((p) => p.name), ...r.shares.filter((s) => share(s.flUserId) == null).map((s) => `${s.name}'s share`)].filter(Boolean);
    const setD = (id: number, patch: Partial<{ amount: number | null; reason: string; own: OwnVariable }>) => setDir((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

    const save = async (send: boolean) => {
        setBusy(send ? "send" : "draft");
        try {
            await appraisalApi.saveSplit(r.departmentId, r.period, {
                own: own && !ownLocked && ownAmt != null ? { amount: ownAmt, comment: ownNote, variable: ownToSend(ownVar) } : undefined,
                direct: direct.filter((p) => !decided(p) && dir[p.cycleId]?.amount != null).map((p) => ({ cycleId: p.cycleId, amount: dir[p.cycleId].amount!, reason: dir[p.cycleId].reason, variable: ownToSend(dir[p.cycleId].own) })),
                shares: r.shares.map((s) => ({ flUserId: s.flUserId, amount: share(s.flUserId) ?? 0, comment: notes[s.flUserId] ?? "" })),
                send,
            });
            addToast({ title: send ? "Budget split sent" : "Split saved", description: send ? "Each FL has been told their share. Your own hike and your direct reports' hikes are released." : undefined, color: "success" });
            setConfirm(false); onDone();
        } catch (e) { addToast({ title: send ? "Could not send" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(null); }
    };

    return (
        <div className="flex flex-col gap-6">
            <BudgetBar total={budget} parts={[
                ...(own ? [{ label: "My own hike", amount: ownAmt ?? 0, color: "bg-emerald-500" }] : []),
                ...(direct.length ? [{ label: "Direct reports", amount: dirSum, color: "bg-sky-500" }] : []),
                ...r.shares.map((s, i) => ({ label: s.name, amount: share(s.flUserId) ?? 0, color: COLORS[i % 5] })),
            ]} />

            {own && (
                <div className="grid grid-cols-1 gap-4 border border-emerald-500/40 p-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <p className="eyebrow !text-emerald-700 dark:!text-emerald-400">My own hike · agreed with Management</p>
                        {ownLocked ? <><p className="text-2xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(own.allocation)}</p><p className="text-xs text-ink-500">Already accepted; it stays as it is.</p></>
                            : <HikeField label="My hike (per year)" value={ownAmt} onChange={setOwnAmt} level={own.level} own={ownVar} onOwn={setOwnVar}
                                hint={[own.expected != null ? `You asked for ${inr(own.expected)}` : "", ctcRise(own.currentAnnualCtc, ownAmt) ? `CTC ${inr(own.currentAnnualCtc)} → ${inr(ctcRise(own.currentAnnualCtc, ownAmt)!.now)} (+${ctcRise(own.currentAnnualCtc, ownAmt)!.pct}%)` : ""].filter(Boolean).join(" · ") || undefined} />}
                    </div>
                    <Textarea label="Comment from Management" minRows={4} isDisabled={ownLocked} value={ownNote} onValueChange={setOwnNote} description="What Management told you about your hike." />
                </div>
            )}

            {direct.length > 0 && (
                <Panel flush title="Reporting to me directly">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-sm">
                            <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Expected", "Target", "Why", "Hike", "Reason"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                            <tbody>{direct.map((p) => (
                                <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                    <td className="px-4 py-3"><Name p={p} /><p className="text-xs text-ink-500">CTC {inr(p.currentAnnualCtc)}</p></td>
                                    <td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td><td className="px-4 py-3 tabular-nums">{inr(p.target)}</td><td className="px-4 py-3"><Why p={p} /></td>
                                    <td className="w-64 px-4 py-3"><HikeCell label={`Hike for ${p.name}`} value={dir[p.cycleId]?.amount ?? null} onChange={(v) => setD(p.cycleId, { amount: v })} level={p.level} own={dir[p.cycleId]?.own ?? null} onOwn={(v) => setD(p.cycleId, { own: v })} disabled={decided(p)} ctc={p.currentAnnualCtc} /></td>
                                    <td className="w-64 px-4 py-3"><TextBox label={`Reason for ${p.name}`} placeholder="Why this hike" value={dir[p.cycleId]?.reason ?? ""} disabled={decided(p)} onChange={(v) => setD(p.cycleId, { reason: v })} /></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                </Panel>
            )}

            <Panel flush title="FL shares · the rest of the budget" actions={r.shares.length > 1 && manual ? <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => setManual(false)}>Spread the rest automatically</Button> : undefined}>
                <p className="border-b border-ink-100 px-5 py-3 text-xs text-ink-500 dark:border-white/5">
                    {manual ? "You set the shares yourself." : r.shares.length > 1 ? `What is left after your own hike and your direct reports (${inr(Math.max(0, rest))}) goes to the FLs, in proportion to what each team expected. Change a share to set it yourself.` : `What is left after your own hike and your direct reports (${inr(Math.max(0, rest))}) goes to the FL.`}
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["FL / Manager", "People", "Team expected", "Share", "Note to this FL"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {r.shares.map((s) => {
                                const exp = s.teamExpected + (r.people.find((p) => p.userId === s.flUserId)?.expected ?? 0);
                                return (
                                    <tr key={s.flUserId} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                        <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{s.name}</td>
                                        <td className="px-4 py-3 tabular-nums">{s.people}</td>
                                        <td className="px-4 py-3 tabular-nums">{inr(exp)}</td>
                                        <td className="w-48 px-4 py-3">
                                            {r.shares.length > 1
                                                ? <input aria-label={`Share for ${s.name}`} inputMode="numeric" className="h-9 w-full border border-ink-200 bg-transparent px-2.5 text-right text-[13px] font-semibold tabular-nums text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:text-white" value={showAmount(share(s.flUserId))}
                                                    onChange={(e) => { const v = parseAmount(e.target.value); setTyped(manual ? (t) => ({ ...t, [s.flUserId]: v }) : { ...auto, [s.flUserId]: v }); setManual(true); }} />
                                                : <p className="text-right text-base font-bold tabular-nums text-ink-900 dark:text-white">{inr(share(s.flUserId))}</p>}
                                            <p className="mt-1 text-right text-xs text-ink-500">{pctOf(share(s.flUserId), exp)} of expected</p>
                                        </td>
                                        <td className="w-80 px-4 py-3"><TextBox label={`Note to ${s.name}`} placeholder="Why this share" value={notes[s.flUserId] ?? ""} onChange={(v) => setNotes((x) => ({ ...x, [s.flUserId]: v }))} /></td>
                                    </tr>
                                );
                            })}
                            {!r.shares.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">No FL in this department. Everyone reports to you directly.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {confirm ? (
                <div className="flex flex-col gap-3 border border-brand-600 p-4">
                    <p className="text-sm text-ink-800 dark:text-ink-100"><b>Send the budget split?</b> Each FL is told their share and your note. {own || direct.length ? "Your own hike and your direct reports' hikes are released to them now. " : ""}After this you can still reset the budget from an FL's proposal.</p>
                    <div className="flex justify-end gap-2"><Button variant="bordered" isDisabled={busy !== null} onPress={() => setConfirm(false)}>Back</Button><Button color="primary" isLoading={busy === "send"} onPress={() => save(true)}>Send the split</Button></div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <p className="mr-auto text-xs text-ink-500">{over ? <span className="font-semibold text-rose-600">{inr(total - budget)} over the budget</span> : badVar ? <span className="font-semibold text-rose-600">Fix the variable pay override</span> : missing.length ? `Still to enter: ${missing.join(", ")}` : "Everything is filled in."}</p>
                    <Button variant="bordered" isLoading={busy === "draft"} isDisabled={busy !== null || over || badVar} onPress={() => save(false)}>Save draft</Button>
                    <Button color="primary" isDisabled={busy !== null || over || badVar || missing.length > 0} onPress={() => setConfirm(true)}>Send budget split</Button>
                </div>
            )}
        </div>
    );
}

// ── After the split: FL proposals (reset the budget, revise, approve), everyone's hike ────────────

function Proposal({ r, flUserId, onDone }: { r: Round; flUserId: number; onDone: () => void }) {
    const s = r.shares.find((x) => x.flUserId === flUserId)!;
    const people = r.people.filter((p) => p.flUserId === flUserId);
    const [mode, setMode] = useState<"reset" | "revise" | null>(null);
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const act = async (what: "approve" | "reset" | "revise") => {
        if (what === "reset" && !comment.trim()) { addToast({ title: "Write why you are resetting the budget", color: "warning" }); return; }
        setBusy(true);
        try {
            if (what === "approve") { await appraisalApi.approveShare(r.departmentId, r.period, flUserId); addToast({ title: `${s.name}'s proposal approved`, description: "The hikes are released to the team.", color: "success" }); }
            if (what === "revise") { await appraisalApi.reviseShare(r.departmentId, r.period, flUserId, comment.trim()); addToast({ title: `Sent back to ${s.name}`, description: "Their hikes are cleared; they allocate the same share again.", color: "success" }); }
            if (what === "reset") { await appraisalApi.resetSplit(r.departmentId, r.period, comment.trim()); addToast({ title: "Budget reset", description: "Accept or negotiate the Finance Head's budget again, then split it.", color: "success" }); }
            setMode(null); setComment(""); onDone();
        } catch (e) { addToast({ title: "Could not do that", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <Panel flush title={`${s.name} · proposal for approval`} actions={<Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>}>
            <div className="flex flex-col gap-4 p-5">
                <BudgetBar total={s.amount} parts={[{ label: "Team", amount: people.filter((p) => p.source === "FL_TEAM").reduce((t, p) => t + (p.allocation ?? 0), 0), color: "bg-brand-500" }, { label: `${s.name}'s own`, amount: people.find((p) => p.source === "FL_OWN")?.allocation ?? 0, color: "bg-violet-500" }]} />
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">{["Person", "Expected", "Target", "Hike", "Current CTC → New CTC", "Reason"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>{people.map((p) => {
                            const sp = p.allocation != null ? splitPreview(p.allocation, p.level, p.variable) : null;
                            const rise = ctcRise(p.currentAnnualCtc, p.allocation);
                            return (
                                <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                    <td className="px-4 py-3"><Name p={p} />{p.source === "FL_OWN" && <Chip size="sm" variant="flat" className="mt-1">FL's own</Chip>}</td>
                                    <td className="px-4 py-3 tabular-nums">{inr(p.expected)}</td><td className="px-4 py-3 tabular-nums">{inr(p.target)}</td>
                                    <td className="px-4 py-3 tabular-nums"><p className="font-semibold text-ink-900 dark:text-white">{inr(p.allocation)}</p>{sp && <p className="text-xs text-ink-500">Fixed {inr(sp.fixed)} · Variable {inr(sp.variable)}{p.variable ? ` (${sp.pct}% own)` : ""}</p>}</td>
                                    <td className="px-4 py-3 tabular-nums">{rise ? <>{inr(p.currentAnnualCtc)} → <b className="text-ink-900 dark:text-white">{inr(rise.now)}</b> <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">+{rise.pct}%</span></> : <span className="text-xs text-ink-400">No CTC on record</span>}</td>
                                    <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-300">{p.reason || "—"}</td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                </div>
                {s.justification && <div><p className="eyebrow">Justification</p><p className="mt-1 whitespace-pre-wrap border-l-2 border-brand-500 pl-3 text-sm text-ink-700 dark:text-ink-200">{s.justification}</p></div>}
                {s.status === "SUBMITTED" && (mode ? (
                    <div className={mode === "reset" ? "flex flex-col gap-3 border border-rose-500/60 bg-rose-50 p-4 dark:bg-rose-500/10" : "flex flex-col gap-3 border border-amber-500/60 bg-amber-50 p-4 dark:bg-amber-500/10"}>
                        <p className="text-sm font-semibold text-ink-900 dark:text-white">{mode === "reset" ? "Reset the budget?" : `Send the proposal back to ${s.name}?`}</p>
                        <p className="text-sm text-ink-700 dark:text-ink-200">{mode === "reset"
                            ? "Everything from your acceptance of the budget onwards is cleared: your split, every FL's share and proposal, and the hikes not yet answered (hikes already released are withdrawn). The Finance Head's budget comes back to you to accept or negotiate. Hikes people have already accepted stay."
                            : `The hikes ${s.name} entered for the team and their own are cleared. They allocate the same ${inr(s.amount)} again and send it back to you.`}</p>
                        <Textarea label={mode === "reset" ? "Why you are resetting the budget (required)" : `What ${s.name} should change (optional)`} minRows={3} value={comment} onValueChange={setComment} description={mode === "reset" ? "The Finance Head sees it in the budget discussion." : `${s.name} sees it with the proposal.`} />
                        <div className="flex justify-end gap-2">
                            <Button variant="light" isDisabled={busy} onPress={() => { setMode(null); setComment(""); }}>Back</Button>
                            <Button color={mode === "reset" ? "danger" : "warning"} isLoading={busy} isDisabled={mode === "reset" && !comment.trim()} onPress={() => act(mode)}>{mode === "reset" ? "Reset budget" : "Send back to revise"}</Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 pt-4 dark:border-white/10">
                        <p className="mr-auto max-w-[60ch] text-xs text-ink-500">Approve sends the hikes out. Revise sends it back to {s.name}. Reset budget starts again from the Finance Head's budget.</p>
                        <Button variant="bordered" color="danger" startContent={<RotateCcw size={16} />} isDisabled={busy} onPress={() => setMode("reset")}>Reset budget</Button>
                        <Button variant="bordered" color="warning" startContent={<Undo2 size={16} />} isDisabled={busy} onPress={() => setMode("revise")}>Revise proposal</Button>
                        <Button color="success" isLoading={busy} startContent={<CheckCircle2 size={16} />} onPress={() => act("approve")}>Approve proposal</Button>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function DirectReturned({ r, p, onDone }: { r: Round; p: RoundPerson; onDone: () => void }) {
    const [amount, setAmount] = useState<number | null>(null);
    const [own, setOwn] = useState<OwnVariable>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const send = async () => {
        if (amount == null || ownInvalid(own, amount)) return;
        setBusy(true);
        try { await appraisalApi.offerDirect(r.departmentId, r.period, p.cycleId, amount, reason, ownToSend(own)); addToast({ title: `New hike released to ${p.name}`, color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not send", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <div className="grid grid-cols-1 items-start gap-3 border border-amber-500/40 p-4 md:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)_auto]">
            <div><p className="eyebrow">Back from postponement</p><Name p={p} /></div>
            <HikeCell label={`New hike for ${p.name}`} value={amount} onChange={setAmount} level={p.level} own={own} onOwn={setOwn} ctc={p.currentAnnualCtc} />
            <TextBox label="Reason" placeholder="Why this hike" value={reason} onChange={setReason} />
            <Button color="primary" isLoading={busy} isDisabled={amount == null || ownInvalid(own, amount)} onPress={send}>Release hike</Button>
        </div>
    );
}

function After({ r, onDone }: { r: Round; onDone: () => void }) {
    const waiting = r.shares.filter((s) => s.status === "SUBMITTED");
    const returned = r.people.filter((p) => p.source === "EL_DIRECT" && p.status === "SUBMITTED");
    return (
        <div className="flex flex-col gap-6">
            <BudgetBar total={r.budget ?? 0} parts={[
                { label: "My own and direct reports", amount: r.people.filter((p) => p.source === "EL_OWN" || p.source === "EL_DIRECT").reduce((t, p) => t + (p.allocation ?? 0), 0), color: "bg-emerald-500" },
                ...r.shares.map((s, i) => ({ label: s.name, amount: s.amount, color: COLORS[i % 5] })),
            ]} />
            {returned.map((p) => <DirectReturned key={p.cycleId} r={r} p={p} onDone={onDone} />)}
            {waiting.map((s) => <Proposal key={s.flUserId} r={r} flUserId={s.flUserId} onDone={onDone} />)}
            {!waiting.length && r.status !== "FINALISED" && <Banner>Waiting for the FLs to send their proposals. You are told as soon as one arrives.</Banner>}
            {r.status === "FINALISED" && <Banner>Every hike in {r.department} is decided.</Banner>}
            <Panel flush title={r.status === "FINALISED" ? "Final split" : "Split so far"}><SplitTable people={r.people} budget={r.budget} ctc /></Panel>
            {r.shares.length > 0 && (
                <Panel flush title="FL shares">
                    {r.shares.map((s) => (
                        <div key={s.flUserId} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3 last:border-0 dark:border-white/5">
                            <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</p><p className="text-xs text-ink-500">{inr(s.allocated)} of {inr(s.amount)} · {s.people} {s.people === 1 ? "person" : "people"}{s.elComment ? ` · your note: ${s.elComment}` : ""}{s.returnedAt && s.status !== "APPROVED" ? ` · sent back ${day(s.returnedAt)}` : ""}</p></div>
                            <Chip size="sm" variant="flat" color={SHARE_COLOR[s.status]}>{SHARE_LABEL[s.status]}</Chip>
                        </div>
                    ))}
                </Panel>
            )}
        </div>
    );
}

type TabKey = "budget" | "appeals" | "split";
const splitOpen = (r: Round) => r.status === "BUDGET_ACCEPTED" || r.status === "SHARES_WITH_FLS" || r.status === "FINALISED";

function RoundView({ r, onDone }: { r: Round; onDone: () => void }) {
    // Budget discussion comes first; once the budget is agreed the page opens on the split, where the work is
    const [tab, setTab] = useState<TabKey>(splitOpen(r) ? "split" : "budget");
    useEffect(() => { if (!splitOpen(r) && tab === "split") setTab("budget"); }, [r, tab]);
    const waiting = r.shares.filter((s) => s.status === "SUBMITTED").length;
    return (
        <Panel flush>
            <div className="px-5 pt-3">
                <Tabs aria-label="Budget split sections" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)}>
                    <Tab key="budget" title={<span className="flex items-center gap-2">Budget discussion{r.status === "BUDGET_WITH_EL" && <span className="h-2 w-2 bg-brand-600" aria-label="Waiting for you" />}</span>}>
                        <div className="pb-5 pt-3"><BudgetTab r={r} onDone={onDone} /></div>
                    </Tab>
                    <Tab key="appeals" title={`Appeals (${r.totals.submitted}/${r.totals.people})`}>
                        <div className="pb-5 pt-3"><Appeals r={r} /></div>
                    </Tab>
                    {splitOpen(r) ? (
                        <Tab key="split" title={<span className="flex items-center gap-2">Budget split{(r.status === "BUDGET_ACCEPTED" || waiting > 0) && <span className="h-2 w-2 bg-brand-600" aria-label="Waiting for you" />}</span>}>
                            <div className="flex flex-col gap-3 pb-5 pt-3">
                                {r.status === "BUDGET_ACCEPTED" ? <SplitForm key={`${r.departmentId}-${r.period}-${r.budgetLog.length}`} r={r} onDone={onDone} /> : <After r={r} onDone={onDone} />}
                                {r.status === "BUDGET_ACCEPTED" && <p className="flex items-center gap-2 text-xs text-ink-500"><Hourglass size={12} />Nothing is sent until you press Send budget split.</p>}
                            </div>
                        </Tab>
                    ) : null}
                </Tabs>
            </div>
        </Panel>
    );
}

// Budget split (EL): the budget from the Finance Head (accept or negotiate), the department's appeals, and the split between
// the EL's own hike, direct reports and the FLs; then each FL's proposal to approve, revise or reset.
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
                { label: "Budget", value: r.elAcceptedAt ? inr(r.budget) : r.status === "BUDGET_WITH_EL" ? "Not accepted" : r.status === "BUDGET_NEGOTIATION" ? "Negotiating" : "Not set yet", hint: r.status === "BUDGET_WITH_EL" ? "Accept it in Budget discussion" : r.status === "BUDGET_NEGOTIATION" ? "With the Finance Head" : undefined },
                { label: "FLs", value: r.shares.length || r.fls.length },
            ]} />
            <RoundView key={`${r.departmentId}-${r.period}`} r={r} onDone={load} />
        </div>
    );
}
