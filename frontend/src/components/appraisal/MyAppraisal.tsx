import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";
import { Award, BadgeCheck, Check, CheckCircle2, Clock, Gift, Hourglass, PartyPopper, Sparkles, Users } from "lucide-react";

import { Panel } from "@/components/page";
import { Button, Chip, Tab, Tabs, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type ChangeRequest, type Money, type MyView, type Stage, type VariableOverride } from "./api";
import { REQ_COLOR, REQ_LABEL, day, inr } from "./format";
import { AcceptModal, RejectModal } from "./OfferModal";
import { Banner, COLS2, HikeField, MoneyCard, ReadText, WHY_KEY, WHY_LABEL, type OwnVariable } from "./parts";

/** The variable pay the person set themselves on a saved hike, back into the form */
const ownOf = (m: Money | null | undefined): OwnVariable => (m?.override ? { mode: m.override, value: m.override === "PCT" ? m.variablePct : m.variable } : null);
const sendOwn = (o: OwnVariable): VariableOverride | null => (o && o.value != null ? { mode: o.mode, value: o.value } : null);
import PmsTable from "./PmsTable";
import QuarterGrid from "./QuarterGrid";

type TabKey = "goals" | "hike" | "proposed";

/** A calm message for the Proposed hike tab while there is nothing to decide yet */
const Waiting = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
    <div className="flex flex-col items-center gap-3 border border-dashed border-ink-300 px-6 py-10 text-center dark:border-white/20">
        <span className="flex h-12 w-12 items-center justify-center bg-ink-100 text-ink-600 dark:bg-white/5 dark:text-ink-300">{icon}</span>
        <p className="text-base font-bold text-ink-900 dark:text-white">{title}</p>
        <p className="max-w-[56ch] text-sm text-ink-500 dark:text-ink-400">{children}</p>
    </div>
);

/** Where the hike is: the person sees the steps, never who wrote what */
const STEPS: { stage: Stage[]; label: string }[] = [
    { stage: ["APPEAL_OPEN"], label: "Your appeal" },
    { stage: ["SUBMITTED", "BUDGET_REVIEW"], label: "Department budget" },
    { stage: ["IN_ALLOCATION", "AWAITING_EL"], label: "Hike being decided" },
    { stage: ["OFFERED"], label: "Hike ready" },
    { stage: ["ACCEPTED", "POSTPONED"], label: "Your answer" },
];
function Tracker({ stage }: { stage: Stage }) {
    const at = STEPS.findIndex((s) => s.stage.includes(stage));
    return (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {STEPS.map((s, i) => (
                <li key={s.label} className={cn("flex items-center gap-2 border px-3 py-2.5 text-sm", i < at ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : i === at ? "border-brand-600 bg-brand-50 font-semibold text-ink-900 dark:bg-brand-600/10 dark:text-white" : "border-ink-200 text-ink-400 dark:border-white/10")}>
                    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold", i < at ? "bg-emerald-600 text-white" : i === at ? "bg-brand-600 text-white" : "bg-ink-100 dark:bg-white/10")}>{i < at ? <Check size={12} /> : i + 1}</span>
                    {s.label}
                </li>
            ))}
        </ol>
    );
}

/** A requested change not approved (or not decided yet): said quietly and kindly, never in red */
function ChangeRow({ r, route }: { r: ChangeRequest; route: MyView["route"] }) {
    const label = r.field === "DESIGNATION" ? "Designation" : "Team";
    const note = r.stage === "NOT_APPROVED" ? "Not this time. Keep building on this year's work; you can ask again at your next appraisal."
        : r.stage === "WITH_FL" ? `With ${route.fl?.name ?? "your FL"}, who will pass it to ${route.el?.name ?? "your EL"} with a recommendation.`
        : `With ${route.el?.name ?? "your EL"} for the decision.`;
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
                <p className="text-sm text-ink-900 dark:text-white"><span className="text-ink-500">{label}:</span> <b>{r.value}</b></p>
                <p className="mt-0.5 text-xs text-ink-500">{note}</p>
            </div>
            <Chip size="sm" variant="flat" color={REQ_COLOR[r.stage]}>{REQ_LABEL[r.stage]}</Chip>
        </li>
    );
}

/** An approved designation or team change: the moment to celebrate */
function Celebration({ name, won }: { name: string; won: ChangeRequest[] }) {
    const designation = won.find((w) => w.field === "DESIGNATION");
    const team = won.find((w) => w.field === "TEAM");
    return (
        <div className="relative overflow-hidden border border-emerald-500/50 bg-gradient-to-br from-emerald-50 via-white to-brand-50 p-6 dark:from-emerald-500/15 dark:via-ink-900 dark:to-brand-600/15 sm:p-8">
            <Sparkles aria-hidden size={140} strokeWidth={1} className="pointer-events-none absolute -right-6 -top-6 text-emerald-500/15" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"><PartyPopper size={32} /></span>
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="eyebrow !text-emerald-700 dark:!text-emerald-400">{designation ? "Promotion approved" : "Team change approved"}</p>
                    <p className="text-3xl font-bold leading-tight tracking-tight text-ink-900 dark:text-white">Congratulations, {name}!</p>
                    <p className="max-w-[60ch] text-[15px] text-ink-700 dark:text-ink-200">
                        {designation && <>You are now <b className="text-emerald-700 dark:text-emerald-400">{designation.value}</b>. </>}
                        {team && <>{designation ? "And you" : "You"} are moving to <b className="text-emerald-700 dark:text-emerald-400">{team.value}</b>. </>}
                        Your work this year has been recognised. Well deserved.
                    </p>
                </div>
            </div>
            <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {won.map((w) => (
                    <div key={w.field} className="flex items-center gap-3 border border-emerald-500/30 bg-white/70 px-4 py-3 dark:bg-ink-900/60">
                        {w.field === "DESIGNATION" ? <BadgeCheck size={22} className="shrink-0 text-emerald-600" /> : <Users size={22} className="shrink-0 text-emerald-600" />}
                        <div className="min-w-0"><p className="eyebrow">{w.field === "DESIGNATION" ? "New designation" : "New team"}</p><p className="truncate text-base font-bold text-ink-900 dark:text-white">{w.value}</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// My Appraisal. "Appeal for Appraisal" opens three tabs: Goals and targets by quarter (from PMS), Hike proposal
// (expected and target hike and why), Proposed hike (where it stands; the hike once it is decided, to accept or reject).
export default function MyAppraisal() {
    const [view, setView] = useState<MyView | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [tab, setTab] = useState<TabKey>("goals");
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
    const jumped = useRef(false);
    const formRef = useRef<HTMLDivElement>(null);

    const [why, setWhy] = useState("");
    const [expected, setExpected] = useState<number | null>(null);
    const [target, setTarget] = useState<number | null>(null);
    const [expectedOwn, setExpectedOwn] = useState<OwnVariable>(null);
    const [targetOwn, setTargetOwn] = useState<OwnVariable>(null);

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.my();
            setView(v);
            if (v) {
                setWhy(v.self?.answers?.[WHY_KEY] ?? "");
                setExpected(v.expected?.annual ?? null);
                setTarget(v.target?.annual ?? null);
                setExpectedOwn(ownOf(v.expected));
                setTargetOwn(ownOf(v.target));
                // once the hike is ready, the page opens straight on the Proposed hike tab
                if (v.cycle.status === "OFFERED" && !jumped.current) { jumped.current = true; setShowForm(true); setTab("proposed"); }
            }
        } catch (e) { addToast({ title: "Could not load your appraisal", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    if (!view) return (
        <Panel><p className="py-10 text-center text-sm text-ink-500">No appraisal is open for you right now. It opens with your appraisal cycle: April if you joined between December and May, October if you joined between June and November.</p></Panel>
    );

    const c = view.cycle;
    const editable = view.can.appeal;
    const submitted = !!view.self?.submittedAt;
    const approved = view.approved;
    const open = (t: TabKey) => { setTab(t); setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

    const save = async (submit: boolean) => {
        if (submit && (expected == null || target == null || !why.trim())) { addToast({ title: "Fill in all three", description: "Expected hike, target hike, and why you expect it.", color: "warning" }); return; }
        if ([expectedOwn, targetOwn].some((o) => o && o.value == null)) { addToast({ title: "Enter your variable pay", description: "Type the percentage or amount, or untick Variable pay override.", color: "warning" }); return; }
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.appeal(c.id, { answers: { [WHY_KEY]: why }, quarters: [], expectedHike: expected, targetHike: target, expectedVariable: sendOwn(expectedOwn), targetVariable: sendOwn(targetOwn), submit });
            addToast({ title: submit ? "Appeal submitted" : "Draft saved", description: submit ? "Your hike will appear in the Proposed hike tab once it is decided." : undefined, color: "success" });
            await load();
            if (submit) setTab("proposed");
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const won = c.status === "ACCEPTED" ? view.requests.filter((r) => r.stage === "APPROVED") : [];
    const notWon = view.requests.filter((r) => !won.includes(r));
    const firstName = c.employeeName.split(" ")[0];

    // The top card: one line on where the person is, and one button
    let icon = <Award size={26} />;
    let title = "Your appraisal is open";
    let text = `Look at your four quarters and tell us the hike you expect, the hike you target, and why.${view.timed ? ` This closes on ${day(c.employeeWindowEnd)}.` : ""}`;
    let action = <Button size="lg" color="primary" onPress={() => open("goals")}>Appeal for Appraisal</Button>;
    if (c.status === "EMPLOYEE_OPEN" && !editable) {
        icon = <Clock size={26} />; title = "Your appeal window has closed";
        text = `It closed on ${day(c.employeeWindowEnd)}. Your hike is still decided with the rest of your department.`;
        action = <Button size="lg" variant="bordered" onPress={() => open("proposed")}>View my appraisal</Button>;
    } else if (c.status === "SUBMITTED") {
        icon = <Hourglass size={26} />; title = "Appeal submitted";
        text = "Your department's budget is being set and your hike decided. It appears in the Proposed hike tab as soon as it is ready.";
        action = <Button size="lg" variant="bordered" onPress={() => open("proposed")}>See where it is</Button>;
    } else if (c.status === "OFFERED") {
        icon = <Gift size={26} />; title = "Your hike is ready";
        text = view.can.reject ? "Open the Proposed hike tab to accept it or reject it." : "Open the Proposed hike tab to accept it.";
        action = <Button size="lg" color="success" onPress={() => open("proposed")}>See my hike</Button>;
    } else if (c.status === "ACCEPTED" || c.status === "POSTPONED") {
        icon = <CheckCircle2 size={26} />; title = c.status === "ACCEPTED" ? `You accepted ${inr(approved?.annual)} a year` : "Your hike is postponed";
        text = c.status === "ACCEPTED" ? "See the final decision in the Proposed hike tab." : `It is postponed to ${day(c.postponedUntil)}.`;
        action = <Button size="lg" variant="bordered" onPress={() => open("proposed")}>View final decision</Button>;
        const promoted = won.find((w) => w.field === "DESIGNATION");
        if (won.length) {
            icon = <PartyPopper size={26} />;
            title = promoted ? `Congratulations, you are now ${promoted.value}!` : `Congratulations, you are moving to ${won[0].value}!`;
            text = `Your ${promoted ? "promotion" : "team change"} is approved, and you accepted ${inr(approved?.annual)} a year.`;
            action = <Button size="lg" color="success" startContent={<Sparkles size={16} />} onPress={() => open("proposed")}>See your {promoted ? "promotion" : "new team"}</Button>;
        }
    }

    const requestsBlock = notWon.length > 0 && (
        <div className="flex flex-col gap-2">
            <p className="eyebrow">{won.length ? "Your other request" : "Requested changes"}</p>
            <ul className="divide-y divide-ink-100 border border-ink-200 dark:divide-white/5 dark:border-white/10">{notWon.map((r) => <ChangeRow key={r.field} r={r} route={view.route} />)}</ul>
        </div>
    );

    let proposed: ReactNode;
    if (c.status === "OFFERED") {
        proposed = (
            <div className="flex flex-col gap-5">
                <div className="border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10">
                    <p className="eyebrow">Your hike per year</p>
                    <p className="mt-2 text-4xl font-bold leading-none tracking-tight text-ink-900 dark:text-white">{inr(approved?.annual)}</p>
                    <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[["Fixed pay", approved?.fixed], ["Variable pay", approved?.variable], ["Each half-year", approved?.variablePerHalfYear]].map(([k, v]) => (
                            <div key={k as string}><dt className="eyebrow">{k as string}</dt><dd className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{inr(v as number)}</dd></div>
                        ))}
                    </dl>
                </div>
                <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">
                    Variable pay is paid in two equal halves each year.{" "}
                    {view.can.reject ? "Accept it, or reject it and have it postponed by 3 or 6 months. " : "This is the hike agreed with you, so it is accepted here. "}
                    {view.can.ask && (view.route.source === "EL_OWN" ? "When you accept you can add a change in your designation or team that you agreed with Management; it is recorded straight away." : `When you accept you can ask for a change in designation or team; it goes to ${view.route.source === "FL_TEAM" ? `${view.route.fl?.name ?? "your FL"} first, then ${view.route.el?.name ?? "your EL"}` : view.route.el?.name ?? "your EL"}.`)}
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                    {view.can.reject && <Button size="lg" variant="bordered" color="danger" onPress={() => setRejectOpen(true)}>Reject</Button>}
                    <Button size="lg" color="success" onPress={() => setAcceptOpen(true)}>Accept</Button>
                </div>
            </div>
        );
    } else if (c.status === "ACCEPTED") {
        proposed = (
            <div className="flex flex-col gap-5">
                {won.length > 0 && <Celebration name={firstName} won={won} />}
                <p className="eyebrow">Final decision</p>
                <MoneyCard title="Hike accepted" money={approved} accent />
                {requestsBlock}
                {!view.requests.length && <p className="text-sm text-ink-500">You did not ask for a change in designation or team.</p>}
            </div>
        );
    } else if (c.status === "POSTPONED") {
        proposed = <Waiting icon={<Clock size={22} />} title={`Postponed to ${day(c.postponedUntil)}`}>You rejected the offer. {view.response?.hrStatus === "APPROVED" ? "HR has approved the postponement." : "HR has been asked to follow up."} Your hike will be decided again then.</Waiting>;
    } else {
        const waitText: Partial<Record<Stage, string>> = {
            APPEAL_OPEN: "Submit your hike proposal first. Once your department's budget is set and your hike decided, it appears here.",
            SUBMITTED: "Your appeal is in. When everyone in your department has appealed, the Finance Head sets the department's budget.",
            BUDGET_REVIEW: "Everyone in your department has appealed. The Finance Head is reviewing the department and setting its budget.",
            IN_ALLOCATION: "Your department has its budget. Your hike is being decided now.",
            AWAITING_EL: "Your hike has been decided and is waiting for the final approval.",
        };
        proposed = (
            <div className="flex flex-col gap-5">
                <Tracker stage={view.stage} />
                <Waiting icon={<Hourglass size={22} />} title={c.status === "EMPLOYEE_OPEN" ? "Nothing to show yet" : "Waiting for your hike"}>{waitText[view.stage] ?? ""}</Waiting>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Panel>
                <div className={showForm ? "flex flex-wrap items-center justify-between gap-4 px-2 py-2" : "flex flex-col items-center gap-5 px-4 py-12 text-center"}>
                    <div className={showForm ? "flex items-center gap-4" : "flex flex-col items-center gap-5"}>
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-600/10">{icon}</span>
                        <div className="flex max-w-[60ch] flex-col gap-1.5">
                            <h2 className="text-xl font-bold text-ink-900 dark:text-white">{title}</h2>
                            <p className="text-sm text-ink-500 dark:text-ink-400">{text}</p>
                        </div>
                    </div>
                    {showForm ? <Button size="lg" variant="bordered" onPress={() => setShowForm(false)}>Hide appraisal</Button> : action}
                </div>
            </Panel>

            {showForm && (
                <div ref={formRef} className="scroll-mt-4">
                    <Panel flush>
                        <div className="px-5 pt-3">
                            <Tabs aria-label="Appraisal sections" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)}>
                                <Tab key="goals" title="Goals and targets by quarter">
                                    <div className="flex flex-col gap-6 pb-5 pt-3">
                                        <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Everything here comes from your PMS Quarterly Reviews. There is nothing to fill in.</p>
                                        <PmsTable quarters={view.pms ?? []} />
                                        <QuarterGrid slots={view.slots ?? []} pms={view.pms ?? []} />
                                    </div>
                                </Tab>
                                <Tab key="hike" title="Hike proposal">
                                    <div className="flex flex-col gap-5 pb-5 pt-3">
                                        <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Enter each amount as an <b>annual</b> figure. It is split into fixed and variable pay for your level. To set your own variable pay, tick Variable pay override and enter a percentage or an amount.</p>
                                        {editable ? (
                                            <div className={COLS2}>
                                                <HikeField label="Expected hike (per year)" value={expected} onChange={setExpected} level={c.level} own={expectedOwn} onOwn={setExpectedOwn} />
                                                <HikeField label="Target hike (per year)" value={target} onChange={setTarget} level={c.level} own={targetOwn} onOwn={setTargetOwn} />
                                            </div>
                                        ) : (
                                            <div className={COLS2}><MoneyCard title="Expected hike" money={view.expected} /><MoneyCard title="Target hike" money={view.target} /></div>
                                        )}
                                        <div className="border-t border-ink-200 pt-5 dark:border-white/10">
                                            {editable ? <Textarea label={WHY_LABEL} minRows={4} value={why} onValueChange={setWhy} isRequired /> : <ReadText label={WHY_LABEL} value={why} />}
                                        </div>
                                        {editable && (
                                            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
                                                <p className="mr-auto text-xs text-ink-500">{submitted ? `Submitted ${day(view.self?.submittedAt)}.` : view.timed ? `Not submitted yet. Open until ${day(c.employeeWindowEnd)}.` : "Not submitted yet."}</p>
                                                <Button variant="bordered" isLoading={saving === "draft"} isDisabled={saving !== null} onPress={() => save(false)}>Save draft</Button>
                                                <Button color="primary" isLoading={saving === "submit"} isDisabled={saving !== null} onPress={() => save(true)}>Submit appeal</Button>
                                            </div>
                                        )}
                                    </div>
                                </Tab>
                                <Tab key="proposed" title={<span className="flex items-center gap-2">Proposed hike{c.status === "OFFERED" && <span className="h-2 w-2 bg-brand-600" aria-label="Ready" />}</span>}>
                                    <div className="flex flex-col gap-6 pb-5 pt-3">
                                        {c.status === "OFFERED" && <Banner>{view.route.source === "EL_OWN" ? "Your hike, as agreed with Management." : `Your hike was approved by ${view.route.el?.name ?? "your EL"}.`}</Banner>}
                                        {proposed}
                                    </div>
                                </Tab>
                            </Tabs>
                        </div>
                    </Panel>
                </div>
            )}

            <AcceptModal view={view} open={acceptOpen} onOpenChange={setAcceptOpen} onDone={load} />
            <RejectModal view={view} open={rejectOpen} onOpenChange={setRejectOpen} onDone={load} />
        </div>
    );
}
