import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { Award, CheckCircle2, Clock, Gift } from "lucide-react";

import { Panel } from "@/components/page";
import { Button, Chip, Input, Tab, Tabs, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleView, type RequestField } from "./api";
import { day, inr } from "./format";
import OfferModal from "./OfferModal";
import { Banner, COLS2, HikeField, MoneyCard, ReadText } from "./parts";
import PmsTable from "./PmsTable";
import QuarterGrid, { EMPTY_NOTE, notesFrom, type QuarterNote } from "./QuarterGrid";

const emptyRequest = { newDesignation: "", designationComment: "", newTeam: "", teamComment: "" };

/** The EL's answer to a change the person asked for, once the offer is out: the decision only, never the assessor's words */
function Decision({ view, field }: { view: CycleView; field: RequestField }) {
    const d = view.requestReviews?.[field]?.A2;
    if (!d || !d.decision) return null;
    return <Chip size="sm" variant="flat" color={d.decision === "APPROVED" ? "success" : "danger"} className="w-fit">{d.decision === "APPROVED" ? "Approved" : "Not approved"}</Chip>;
}

// My Appraisal. One button, "Appeal for Appraisal", opens the appraisal on the page in two tabs.
// Only when the EL has approved the final amount does a pop-up appear, with Accept and Reject.
export default function MyAppraisal() {
    const [view, setView] = useState<CycleView | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [offerOpen, setOfferOpen] = useState(false);
    const [tab, setTab] = useState("goals");
    const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
    const popped = useRef(false);
    const formRef = useRef<HTMLDivElement>(null);

    const [notes, setNotes] = useState<Record<number, QuarterNote>>({});
    const [expected, setExpected] = useState<number | null>(null);
    const [target, setTarget] = useState<number | null>(null);
    const [request, setRequest] = useState(emptyRequest);

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.my();
            setView(v);
            if (v) {
                setNotes(notesFrom(v.quarters));
                setExpected(v.expected?.annual ?? null);
                setTarget(v.target?.annual ?? null);
                setRequest({ ...emptyRequest, ...(v.request ?? {}) });
                // the offer pops up by itself the first time the page opens with an approved amount
                if (v.can.respond && !popped.current) { popped.current = true; setOfferOpen(true); }
            }
        } catch (e) { addToast({ title: "Could not load your appraisal", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    if (!view) return (
        <Panel><p className="py-10 text-center text-sm text-ink-500">No appraisal is open for you right now. It opens on the anniversary of your joining date.</p></Panel>
    );

    const c = view.cycle;
    const editable = !!view.can.selfReview;
    const submitted = !!view.self?.submittedAt;
    const approved = view.approved;
    const slots = view.slots ?? [];

    const open = () => { setTab("goals"); setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
    const setNote = (n: number, patch: Partial<QuarterNote>) => setNotes((all) => ({ ...all, [n]: { ...(all[n] ?? EMPTY_NOTE), ...patch } }));

    const save = async (submit: boolean) => {
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.selfReview(c.id, {
                answers: {},
                quarters: slots.map((s) => ({ quarter: s.n, ...(notes[s.n] ?? EMPTY_NOTE) })),
                expectedHike: expected, targetHike: target, request, submit,
            });
            addToast({ title: submit ? "Submitted for review" : "Draft saved", description: submit ? "Your final amount will pop up here once it is approved." : undefined, color: "success" });
            if (submit) setShowForm(false);
            await load();
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    // What the top card says, depending only on where the person is
    const viewButton = <Button size="lg" variant="bordered" onPress={() => (showForm ? setShowForm(false) : open())}>{showForm ? "Hide my appraisal" : "View my appraisal"}</Button>;
    let icon = <Award size={26} />;
    let title = "Your appraisal is open";
    let text = `Fill in your four quarters and the hike you are asking for. This closes on ${day(c.employeeWindowEnd)}.`;
    let action = showForm ? <Button size="lg" variant="bordered" onPress={() => setShowForm(false)}>Hide appraisal</Button> : <Button size="lg" color="primary" onPress={open}>Appeal for Appraisal</Button>;
    if (!editable && c.status === "EMPLOYEE_OPEN") {
        icon = <Clock size={26} />;
        title = "Your appraisal window has closed";
        text = c.late ? `It closed on ${day(c.employeeWindowEnd)} and was not submitted.` : `It closed on ${day(c.employeeWindowEnd)}.`;
        action = viewButton;
    } else if (c.status === "ASSESSOR_OPEN" || c.status === "FINANCE_REVIEW") {
        icon = <Clock size={26} />;
        title = "Submitted for review";
        text = "Your appraisal is being reviewed. Your final amount will pop up here as soon as it is approved.";
        action = viewButton;
    } else if (c.status === "OFFERED") {
        icon = <Gift size={26} />;
        title = "Your final amount is ready";
        text = "Your appraisal has been approved. Open your offer to accept it or reject it.";
        action = <div className="flex flex-wrap justify-center gap-3"><Button size="lg" color="success" onPress={() => setOfferOpen(true)}>View my offer</Button>{viewButton}</div>;
    } else if (c.status === "ACCEPTED") {
        icon = <CheckCircle2 size={26} />;
        title = `You accepted ${inr(approved?.annual)} a year`;
        text = `Fixed pay ${inr(approved?.fixed)}, variable pay ${inr(approved?.variable)} paid in two halves of ${inr(approved?.variablePerHalfYear)}. This decision is final.`;
        action = viewButton;
    } else if (c.status === "POSTPONED") {
        icon = <Clock size={26} />;
        title = "Your hike is postponed";
        text = `You rejected the offer. It is postponed to ${day(c.postponedUntil)}${view.response?.hrStatus === "APPROVED" ? ", and HR has approved the postponement" : ""}.`;
        action = viewButton;
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
                            {submitted && editable && <Chip size="sm" variant="flat" color="success" className={showForm ? "" : "mx-auto"}>Submitted · you can still change it until the window closes</Chip>}
                        </div>
                    </div>
                    {action}
                </div>
            </Panel>

            {showForm && (
                <div ref={formRef} className="flex scroll-mt-4 flex-col gap-0">
                    <Panel flush>
                        <div className="px-5 pt-3">
                            <Tabs aria-label="Appraisal sections" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                                <Tab key="goals" title="Goals and targets by quarter">
                                    <div className="flex flex-col gap-6 pb-5 pt-3">
                                        <div className="flex flex-col gap-3">
                                            <p className="eyebrow">From your PMS Quarterly Reviews</p>
                                            <PmsTable quarters={view.pms ?? []} />
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <p className="eyebrow">{editable ? "Your notes for each quarter" : "What you wrote for each quarter"}</p>
                                            <QuarterGrid slots={slots} values={notes} onChange={editable ? setNote : undefined} />
                                        </div>
                                    </div>
                                </Tab>
                                <Tab key="hike" title="Hike proposal">
                                    <div className="flex flex-col gap-6 pb-5 pt-3">
                                        <div className="flex flex-col gap-4">
                                            <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Enter each amount as an <b>annual</b> figure. It is split into fixed and variable pay for your level, so you never type the split.</p>
                                            {editable ? (
                                                <div className={COLS2}>
                                                    <HikeField label="Expected hike (per year)" value={expected} onChange={setExpected} level={c.level} />
                                                    <HikeField label="Target hike (per year)" value={target} onChange={setTarget} level={c.level} />
                                                </div>
                                            ) : (
                                                <div className={COLS2}><MoneyCard title="Expected hike" money={view.expected} /><MoneyCard title="Target hike" money={view.target} /></div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-4 border-t border-ink-200 pt-5 dark:border-white/10">
                                            <p className="eyebrow">Ask for a change (optional)</p>
                                            {editable ? (
                                                <div className={COLS2}>
                                                    <Input label="New designation" value={request.newDesignation} onValueChange={(v) => setRequest((q) => ({ ...q, newDesignation: v }))} />
                                                    <Input label="Why (designation)" value={request.designationComment} onValueChange={(v) => setRequest((q) => ({ ...q, designationComment: v }))} />
                                                    <Input label="New team" value={request.newTeam} onValueChange={(v) => setRequest((q) => ({ ...q, newTeam: v }))} />
                                                    <Input label="Why (team)" value={request.teamComment} onValueChange={(v) => setRequest((q) => ({ ...q, teamComment: v }))} />
                                                </div>
                                            ) : (
                                                <div className={COLS2}>
                                                    <div className="flex flex-col gap-3"><ReadText label="New designation" value={request.newDesignation} /><ReadText label="Why" value={request.designationComment} /><Decision view={view} field="DESIGNATION" /></div>
                                                    <div className="flex flex-col gap-3"><ReadText label="New team" value={request.newTeam} /><ReadText label="Why" value={request.teamComment} /><Decision view={view} field="TEAM" /></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Tab>
                            </Tabs>
                        </div>
                    </Panel>
                    {editable && (
                        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border border-t-0 border-ink-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-900">
                            <p className="mr-auto text-xs text-ink-500">{submitted ? `Submitted ${day(view.self?.submittedAt)}` : "Not submitted yet"}</p>
                            <Button variant="bordered" isLoading={saving === "draft"} isDisabled={saving !== null} onPress={() => save(false)}>Save draft</Button>
                            <Button color="primary" isLoading={saving === "submit"} isDisabled={saving !== null} onPress={() => save(true)}>Submit for review</Button>
                        </div>
                    )}
                </div>
            )}

            {/* The offer: the only pop-up, once the EL has approved the final amount */}
            <OfferModal view={view} open={offerOpen} onOpenChange={setOfferOpen} onDone={load} />
        </div>
    );
}
