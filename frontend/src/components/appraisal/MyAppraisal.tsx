import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { Award, BadgeCheck, CheckCircle2, Clock, Gift, Hourglass, PartyPopper, Sparkles, Users } from "lucide-react";

import { Panel } from "@/components/page";
import { Button, Chip, Tab, Tabs, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleView, type RequestField } from "./api";
import { day, inr } from "./format";
import { AcceptModal, RejectModal } from "./OfferModal";
import { ANSWER_QUESTIONS, Banner, COLS2, HikeField, MoneyCard, ReadText } from "./parts";
import PmsTable from "./PmsTable";
import QuarterGrid from "./QuarterGrid";

type TabKey = "goals" | "hike" | "proposed";

/** A calm message for the Proposed Hike tab while there is nothing to decide yet */
const Waiting = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
    <div className="flex flex-col items-center gap-3 border border-dashed border-ink-300 px-6 py-12 text-center dark:border-white/20">
        <span className="flex h-12 w-12 items-center justify-center bg-ink-100 text-ink-600 dark:bg-white/5 dark:text-ink-300">{icon}</span>
        <p className="text-base font-bold text-ink-900 dark:text-white">{title}</p>
        <p className="max-w-[52ch] text-sm text-ink-500 dark:text-ink-400">{children}</p>
    </div>
);

type Asked = { field: RequestField; label: string; value: string; why: string };
const decisionOf = (view: CycleView, field: RequestField) => view.requestReviews?.[field]?.A2?.decision ?? null;

/** A requested change that was not approved (or not decided yet): said quietly and kindly, never in red */
function ChangeRow({ view, field, label, value, why }: { view: CycleView } & Asked) {
    const d = decisionOf(view, field);
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
                <p className="text-sm text-ink-900 dark:text-white"><span className="text-ink-500">{label}:</span> <b>{value}</b></p>
                <p className="mt-0.5 text-xs text-ink-500">{d === "REJECTED" ? "Not this time. Keep building on this year's work; you can ask again at your next appraisal." : why}</p>
            </div>
            <Chip size="sm" variant="flat" color={d === "REJECTED" ? "default" : "warning"}>{d === "REJECTED" ? "Not this cycle" : "Waiting for a decision"}</Chip>
        </li>
    );
}

/** An approved designation or team change: the moment to celebrate */
function Celebration({ name, won }: { name: string; won: Asked[] }) {
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

// My Appraisal. "Appeal for Appraisal" opens it on the page in three tabs:
// Goals and targets by quarter (all from PMS), Hike proposal (what I ask for), Proposed hike (the EL's approved amount, Accept or Reject).
export default function MyAppraisal() {
    const [view, setView] = useState<CycleView | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [tab, setTab] = useState<TabKey>("goals");
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
    const jumped = useRef(false);
    const formRef = useRef<HTMLDivElement>(null);

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [expected, setExpected] = useState<number | null>(null);
    const [target, setTarget] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.my();
            setView(v);
            if (v) {
                setAnswers(v.self?.answers ?? {});
                setExpected(v.expected?.annual ?? null);
                setTarget(v.target?.annual ?? null);
                // once the EL has approved the amount, the page opens straight on the Proposed hike tab
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
    const editable = !!view.can.selfReview;
    const submitted = !!view.self?.submittedAt;
    const approved = view.approved;
    const decided = c.status === "ACCEPTED" || c.status === "POSTPONED";

    const open = (t: TabKey) => { setTab(t); setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

    const save = async (submit: boolean) => {
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.selfReview(c.id, { answers, quarters: [], expectedHike: expected, targetHike: target, submit });
            addToast({ title: submit ? "Submitted for review" : "Draft saved", description: submit ? "You will see the approved amount in the Proposed hike tab." : undefined, color: "success" });
            await load();
            if (submit) setTab("proposed");
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    // Save draft / Submit for review, at the end of the Hike proposal tab
    const saveBar = (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
            <p className="mr-auto text-xs text-ink-500">{submitted ? `Submitted ${day(view.self?.submittedAt)}.` : view.timed ? `Not submitted yet. Open until ${day(c.employeeWindowEnd)}.` : "Not submitted yet. Submitting sends it to your FL, your EL and Finance."}</p>
            <Button variant="bordered" isLoading={saving === "draft"} isDisabled={saving !== null} onPress={() => save(false)}>Save draft</Button>
            <Button color="primary" isLoading={saving === "submit"} isDisabled={saving !== null} onPress={() => save(true)}>Submit for review</Button>
        </div>
    );

    // The designation / team changes asked for when accepting, and the ones that were approved
    const asked: Asked[] = [
        ...(view.request?.newDesignation ? [{ field: "DESIGNATION" as const, label: "Designation", value: view.request.newDesignation, why: view.request.designationComment }] : []),
        ...(view.request?.newTeam ? [{ field: "TEAM" as const, label: "Team", value: view.request.newTeam, why: view.request.teamComment }] : []),
    ];
    const won = c.status === "ACCEPTED" ? asked.filter((x) => decisionOf(view, x.field) === "APPROVED") : [];
    const notWon = asked.filter((x) => !won.includes(x));
    const firstName = c.employeeName.split(" ")[0];

    // The top card: one line on where the person is, and one button
    let icon = <Award size={26} />;
    let title = "Your appraisal is open";
    let text = `Look at your four quarters and enter the hike you are asking for, with your reasons.${view.timed ? ` This closes on ${day(c.employeeWindowEnd)}.` : ""}`;
    let action = <Button size="lg" color="primary" onPress={() => open("goals")}>Appeal for Appraisal</Button>;
    if (!editable && c.status === "EMPLOYEE_OPEN") {
        icon = <Clock size={26} />; title = "Your appraisal window has closed";
        text = c.late ? `It closed on ${day(c.employeeWindowEnd)} and was not submitted.` : `It closed on ${day(c.employeeWindowEnd)}.`;
        action = <Button size="lg" variant="bordered" onPress={() => open("goals")}>View my appraisal</Button>;
    } else if (c.status === "ASSESSOR_OPEN" || c.status === "FINANCE_REVIEW") {
        icon = <Hourglass size={26} />; title = "Submitted for review";
        text = "Your appraisal is being reviewed. The approved amount will appear in the Proposed hike tab.";
        action = <Button size="lg" variant="bordered" onPress={() => open("proposed")}>View my appraisal</Button>;
    } else if (c.status === "OFFERED") {
        icon = <Gift size={26} />; title = "Your hike is approved";
        text = "Open the Proposed hike tab to accept it or reject it.";
        action = <Button size="lg" color="success" onPress={() => open("proposed")}>See proposed hike</Button>;
    } else if (decided) {
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

    // What each assessor proposed for this person, and what they wrote, once each has submitted. The last one had the final say.
    const finalSlot = c.assessor2 ? "A2" : "A1";
    const byAssessor = (["A1", "A2"] as const).map((k) => ({ k, who: (k === "A1" ? c.assessor1?.name : c.assessor2?.name) ?? (k === "A1" ? "Assessor 1" : "Assessor 2"), role: k === finalSlot ? "Final decision" : "First review", money: view.minimal?.[k] ?? null, comment: view.assessors?.[k]?.comment ?? "" })).filter((x) => x.money || x.comment);
    const assessorsBlock = byAssessor.length > 0 && (
        <div className="flex flex-col gap-3">
            <p className="eyebrow">What your assessors proposed</p>
            <div className={COLS2}>
                {byAssessor.map((x) => (
                    <div key={x.k} className="flex flex-col gap-3 border border-ink-200 p-4 dark:border-white/10">
                        <p className="text-sm font-semibold text-ink-900 dark:text-white">{x.who} <span className="font-normal text-ink-500">· {x.role}</span></p>
                        {x.money && <p className="text-2xl font-bold leading-none text-ink-900 dark:text-white">{inr(x.money.annual)}<span className="ml-1.5 text-xs font-normal text-ink-500">per year · {inr(x.money.fixed)} fixed + {inr(x.money.variable)} variable</span></p>}
                        <ReadText label="Comment" value={x.comment} />
                    </div>
                ))}
            </div>
        </div>
    );
    let proposed: ReactNode;
    if (c.status === "OFFERED") {
        proposed = (
            <div className="flex flex-col gap-5">
                <div className="border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10">
                    <p className="eyebrow">Approved hike per year</p>
                    <p className="mt-2 text-4xl font-bold leading-none tracking-tight text-ink-900 dark:text-white">{inr(approved?.annual)}</p>
                    <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[["Fixed pay", approved?.fixed], ["Variable pay", approved?.variable], ["Half-yearly", approved?.variablePerHalfYear]].map(([k, v]) => (
                            <div key={k as string}><dt className="eyebrow">{k as string}</dt><dd className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{inr(v as number)}</dd></div>
                        ))}
                    </dl>
                </div>
                <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Variable pay is paid in two equal halves each year. Accept it, or reject it and have it postponed by 3 or 6 months. There is no counter-offer. When you accept you can also ask for a change in designation or team.</p>
                <div className="flex flex-wrap justify-end gap-3">
                    <Button size="lg" variant="bordered" color="danger" onPress={() => setRejectOpen(true)}>Reject</Button>
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
                {notWon.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="eyebrow">{won.length ? "Your other request" : "Requested changes"}</p>
                        <ul className="divide-y divide-ink-100 border border-ink-200 dark:divide-white/5 dark:border-white/10">
                            {notWon.map((x) => <ChangeRow key={x.field} view={view} {...x} />)}
                        </ul>
                    </div>
                )}
                {!asked.length && <p className="text-sm text-ink-500">You did not ask for a change in designation or team.</p>}
            </div>
        );
    } else if (c.status === "POSTPONED") {
        proposed = <Waiting icon={<Clock size={22} />} title={`Postponed to ${day(c.postponedUntil)}`}>You rejected the offer. {view.response?.hrStatus === "APPROVED" ? "HR has approved the postponement." : "HR has been asked to follow up."}</Waiting>;
    } else if (submitted || c.status === "ASSESSOR_OPEN" || c.status === "FINANCE_REVIEW") {
        proposed = <Waiting icon={<Hourglass size={22} />} title="Waiting for the final amount">Your hike proposal is with your reviewers. As soon as their reviews are in, the final amount appears here and you can accept or reject it.</Waiting>;
    } else {
        proposed = <Waiting icon={<Hourglass size={22} />} title="Nothing to show yet">Submit your hike proposal first. Once it has been reviewed and the EL approves the final amount, it appears here.</Waiting>;
    }

    return (
        <div className="flex flex-col gap-6">
            {view.financeComment && c.status === "FINANCE_REVIEW" && (
                <Banner tone="warn"><b>Note from Finance about the budget:</b> {view.financeComment}</Banner>
            )}
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
                                        <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Enter each amount as an <b>annual</b> figure. It is split into fixed and variable pay for your level, so you never type the split.</p>
                                        {editable ? (
                                            <div className={COLS2}>
                                                <HikeField label="Expected hike (per year)" value={expected} onChange={setExpected} level={c.level} />
                                                <HikeField label="Target hike (per year)" value={target} onChange={setTarget} level={c.level} />
                                            </div>
                                        ) : (
                                            <div className={COLS2}><MoneyCard title="Expected hike" money={view.expected} /><MoneyCard title="Target hike" money={view.target} /></div>
                                        )}
                                        <div className="flex flex-col gap-4 border-t border-ink-200 pt-5 dark:border-white/10">
                                            <p className="eyebrow">Why this hike</p>
                                            {editable ? (
                                                <div className={COLS2}>{ANSWER_QUESTIONS.map(([key, label]) => <Textarea key={key} label={label} minRows={3} value={answers[key] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [key]: v }))} />)}</div>
                                            ) : (
                                                <div className={COLS2}>{ANSWER_QUESTIONS.map(([key, label]) => <ReadText key={key} label={label} value={answers[key]} />)}</div>
                                            )}
                                        </div>
                                        {editable && saveBar}
                                    </div>
                                </Tab>
                                <Tab key="proposed" title={<span className="flex items-center gap-2">Proposed hike{c.status === "OFFERED" && <span className="h-2 w-2 bg-brand-600" aria-label="Ready" />}</span>}>
                                    <div className="flex flex-col gap-6 pb-5 pt-3">{proposed}{assessorsBlock}</div>
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
