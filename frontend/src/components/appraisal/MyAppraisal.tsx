import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Textarea, Input, Chip, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleView, type RequestField } from "./api";
import { LEVEL_LABEL, STATUS_LABEL, day, inr } from "./format";
import Offer from "./Offer";
import { ANSWER_QUESTIONS, Banner, COLS2, HikeField, MoneyCard, ReadText, Stepper } from "./parts";
import PmsTable from "./PmsTable";

const emptyRequest = { newDesignation: "", designationComment: "", newTeam: "", teamComment: "" };

/** The EL's decision on a change the person asked for, shown once the offer is out */
function Decision({ view, field }: { view: CycleView; field: RequestField }) {
    const d = view.requestReviews?.[field]?.A2;
    if (!d || !d.decision) return null;
    return (
        <div className="flex flex-col gap-1 border-l-4 border-ink-300 pl-3 dark:border-white/20">
            <Chip size="sm" variant="flat" color={d.decision === "APPROVED" ? "success" : "danger"} className="w-fit">{d.decision === "APPROVED" ? "Approved" : "Not approved"}</Chip>
            {d.comment && <p className="text-sm text-ink-700 dark:text-ink-200">{d.comment}</p>}
        </div>
    );
}

// My Appraisal: the cycle at a glance; Part A from PMS; Part B and C while my window is open; read-only once it closes; then the offer.
export default function MyAppraisal() {
    const [view, setView] = useState<CycleView | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [expected, setExpected] = useState<number | null>(null);
    const [target, setTarget] = useState<number | null>(null);
    const [request, setRequest] = useState(emptyRequest);

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.my();
            setView(v);
            if (v) {
                setAnswers(v.self?.answers ?? {});
                setExpected(v.expected?.annual ?? null);
                setTarget(v.target?.annual ?? null);
                setRequest({ ...emptyRequest, ...(v.request ?? {}) });
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

    const save = async (submit: boolean) => {
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.selfReview(c.id, { answers, expectedHike: expected, targetHike: target, request, submit });
            addToast({ title: submit ? "Submitted for review" : "Draft saved", description: submit ? "Your manager will review it after your window closes." : undefined, color: "success" });
            await load();
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: "Cycle", value: c.year, hint: `Starts ${day(c.start)}` },
                { label: "Status", value: <span className="text-xl">{STATUS_LABEL[c.status]}</span> },
                { label: "Level", value: LEVEL_LABEL[c.level], hint: `${c.variablePct}% of any hike is variable` },
                { label: "Current annual CTC", value: inr(c.currentAnnualCtc), hint: "For reference only" },
            ]} />
            <Stepper cycle={c} />

            {view.financeComment && c.status === "FINANCE_REVIEW" && (
                <Banner tone="warn"><b>Note from Finance about the budget:</b> {view.financeComment}</Banner>
            )}
            {(view.can.respond || c.status === "ACCEPTED" || c.status === "POSTPONED") && <Offer view={view} onDone={load} />}

            {editable ? (
                <Banner>Your form is open until <b>{day(c.employeeWindowEnd)}</b>. After that it closes for you and your manager reviews it. {view.self?.submittedAt ? "You have submitted it. You can still change it until the window closes." : "Save a draft any time, and submit when you are done."}</Banner>
            ) : c.status === "EMPLOYEE_OPEN" ? (
                <Banner tone="warn">Appraisal window is closed. Your form was open until {day(c.employeeWindowEnd)}.</Banner>
            ) : c.late ? (
                <Banner tone="warn">Your form closed on {day(c.employeeWindowEnd)} and was not submitted. What you saved stays as a draft.</Banner>
            ) : (
                <Banner>Your form closed on {day(c.employeeWindowEnd)}. It is shown below as you submitted it.</Banner>
            )}

            <Panel title="Part A · Goals and targets by quarter">
                <div className="flex flex-col gap-4">
                    <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Your four quarters of the year, taken from your PMS Quarterly Reviews. You do not fill this in.</p>
                    <PmsTable quarters={view.pms ?? []} />
                </div>
            </Panel>

            <Panel title="Part B · Self review">
                <div className="flex flex-col gap-4">
                    <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Look back at the whole year and all four quarters, and justify your rating. Every answer is optional, but a short note helps your manager.</p>
                    {editable ? (
                        <div className={COLS2}>
                            {ANSWER_QUESTIONS.map(([key, label]) => <Textarea key={key} label={label} minRows={3} value={answers[key] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [key]: v }))} />)}
                        </div>
                    ) : (
                        <div className={COLS2}>{ANSWER_QUESTIONS.map(([key, label]) => <ReadText key={key} label={label} value={answers[key]} />)}</div>
                    )}
                </div>
            </Panel>

            <Panel title="Part C · Hike proposal">
                <div className="flex flex-col gap-5">
                    <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Enter each amount as an <b>annual</b> figure. It is split into fixed and variable for your level, so you never type the split.</p>
                    {editable ? (
                        <div className={COLS2}>
                            <HikeField label="Expected hike (per year)" value={expected} onChange={setExpected} level={c.level} />
                            <HikeField label="Target hike (per year)" value={target} onChange={setTarget} level={c.level} />
                        </div>
                    ) : (
                        <div className={COLS2}><MoneyCard title="Expected hike" money={view.expected} /><MoneyCard title="Target hike" money={view.target} /></div>
                    )}
                    <div className="flex flex-col gap-4 border-t border-ink-200 pt-5 dark:border-white/10">
                        <p className="eyebrow">Ask for a change (optional)</p>
                        {editable ? (
                            <div className={COLS2}>
                                <Input label="New designation" value={request.newDesignation} onValueChange={(v) => setRequest((r) => ({ ...r, newDesignation: v }))} />
                                <Input label="Why (designation)" value={request.designationComment} onValueChange={(v) => setRequest((r) => ({ ...r, designationComment: v }))} />
                                <Input label="New team" value={request.newTeam} onValueChange={(v) => setRequest((r) => ({ ...r, newTeam: v }))} />
                                <Input label="Why (team)" value={request.teamComment} onValueChange={(v) => setRequest((r) => ({ ...r, teamComment: v }))} />
                            </div>
                        ) : (
                            <div className={COLS2}>
                                <div className="flex flex-col gap-3"><ReadText label="New designation" value={request.newDesignation} /><ReadText label="Why" value={request.designationComment} /><Decision view={view} field="DESIGNATION" /></div>
                                <div className="flex flex-col gap-3"><ReadText label="New team" value={request.newTeam} /><ReadText label="Why" value={request.teamComment} /><Decision view={view} field="TEAM" /></div>
                            </div>
                        )}
                    </div>
                </div>
            </Panel>

            {editable && (
                <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border border-ink-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-900">
                    <p className="mr-auto text-xs text-ink-500">{view.self?.submittedAt ? `Submitted ${day(view.self.submittedAt)}` : "Not submitted yet"}</p>
                    <Button variant="bordered" isLoading={saving === "draft"} isDisabled={saving !== null} onPress={() => save(false)}>Save draft</Button>
                    <Button color="primary" isLoading={saving === "submit"} isDisabled={saving !== null} onPress={() => save(true)}>Submit for review</Button>
                </div>
            )}
        </div>
    );
}
