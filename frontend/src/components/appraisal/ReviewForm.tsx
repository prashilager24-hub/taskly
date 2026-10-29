import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { ArrowLeft } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Input, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleView } from "./api";
import { LEVEL_LABEL, STATUS_LABEL, addDaysIso, day } from "./format";
import { ANSWER_QUESTIONS, Banner, COLS2, COLS4, HikeField, MoneyCard, ReadText, Stepper } from "./parts";

type Q = { quarter: number; finalRating: string; comments: string };
const rate = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

// The review form for one appraisal. Only fields the server sent are drawn, so a hidden field leaves no empty box.
export default function ReviewForm() {
    const { cycleId } = useParams();
    const nav = useNavigate();
    const id = Number(cycleId);
    const [view, setView] = useState<CycleView | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

    const [qs, setQs] = useState<Q[]>([]);
    const [overall, setOverall] = useState("");
    const [comment, setComment] = useState("");
    const [feedback, setFeedback] = useState("");
    const [minimal, setMinimal] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.cycle(id);
            setView(v);
            const me = v.role === "A1" || v.role === "A2" ? v.role : null;
            setQs([1, 2, 3, 4].map((n) => { const r = me ? v.quarters?.find((q) => q.quarter === n)?.ratings?.[me] : null; return { quarter: n, finalRating: r?.finalRating != null ? String(r.finalRating) : "", comments: r?.comments ?? "" }; }));
            const mine = me ? v.assessors?.[me] : null;
            setOverall(mine?.overallRating != null ? String(mine.overallRating) : "");
            setComment(mine?.comment ?? "");
            setFeedback(mine?.managerFeedback ?? "");
            setMinimal(me ? v.minimal?.[me]?.annual ?? null : null);
        } catch (e) { addToast({ title: "Could not open this appraisal", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, [id]);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    if (!view) return <Panel><p className="py-10 text-center text-sm text-ink-500">This appraisal could not be opened.</p></Panel>;

    const c = view.cycle;
    const me = view.role === "A1" || view.role === "A2" ? view.role : null;
    const editable = !!view.can.assessorReview;
    const other = me === "A1" ? "A2" : "A1";
    const setQ = (n: number, k: "finalRating" | "comments", v: string) => setQs((all) => all.map((q) => (q.quarter === n ? { ...q, [k]: v } : q)));

    const save = async (submit: boolean) => {
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.assessorReview(c.id, {
                quarters: qs.map((q) => ({ quarter: q.quarter, finalRating: rate(q.finalRating), comments: q.comments })),
                overallRating: rate(overall), comment, ...(me === "A1" ? { managerFeedback: feedback } : {}), minimalHike: minimal, submit,
            });
            addToast({ title: submit ? "Review submitted" : "Draft saved", color: "success" });
            await load();
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const ratingBox = (label: string, v: string, set: (s: string) => void) => (
        <Input label={label} type="number" min={1} max={5} step={0.1} value={v} onValueChange={set} placeholder="1 to 5" />
    );

    return (
        <div className="flex flex-col gap-6">
            <div><Button size="sm" variant="light" startContent={<ArrowLeft size={14} />} onPress={() => nav("/appraisal/team")}>Back to team</Button></div>
            <SummaryBar className="mb-0" items={[
                { label: "Employee", value: <span className="text-xl">{c.employeeName}</span>, hint: `${LEVEL_LABEL[c.level]} · cycle ${c.year}` },
                { label: "Status", value: <span className="text-xl">{STATUS_LABEL[c.status]}</span> },
                { label: "Assessor window", value: <span className="text-base">{day(addDaysIso(c.start, 15))} → {day(c.assessorWindowEnd)}</span> },
                view.self !== undefined
                    ? { label: "Self review", value: <span className="text-xl">{view.self?.submittedAt ? "Submitted" : c.late ? "Not submitted" : "In progress"}</span> }
                    : { label: "Variable share", value: <span className="text-xl">{c.variablePct}%</span>, hint: "Of every hike, for this level" },
            ]} />
            <Stepper cycle={c} />

            {editable ? <Banner>Your review is open until <b>{day(c.assessorWindowEnd)}</b>. You can change it until the window closes.</Banner>
                : c.status === "EMPLOYEE_OPEN" ? <Banner tone="warn">This opens for you on {day(addDaysIso(c.start, 15))}, after the employee's window closes. Appraisal window is closed for you until then.</Banner>
                : me ? <Banner tone="warn">Appraisal window is closed. Your review is shown below as it was saved.</Banner> : null}

            {view.self !== undefined && (
                <Panel title="The employee's self review">
                    <details className="group" open>
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brand-700 focus-ring dark:text-brand-400">Show or hide</summary>
                        <div className="mt-5 flex flex-col gap-6">
                            {view.quarters?.map((q) => (
                                <div key={q.quarter} className="flex flex-col gap-3">
                                    <span className="flex h-7 w-7 items-center justify-center bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">Q{q.quarter}</span>
                                    <div className={COLS4}>
                                        {q.goals !== undefined && <ReadText label="Goals" value={q.goals} />}
                                        {q.targets !== undefined && <ReadText label="Targets" value={q.targets} />}
                                        {q.biggestAchievements !== undefined && <ReadText label="Biggest achievements" value={q.biggestAchievements} />}
                                        {q.biggestFailures !== undefined && <ReadText label="Biggest failures" value={q.biggestFailures} />}
                                    </div>
                                </div>
                            ))}
                            <div className={`${COLS2} border-t border-ink-200 pt-5 dark:border-white/10`}>
                                {ANSWER_QUESTIONS.map(([key, label]) => <ReadText key={key} label={label} value={view.self?.answers?.[key]} />)}
                            </div>
                            {view.request && (view.request.newDesignation || view.request.newTeam) && (
                                <div className={`${COLS2} border-t border-ink-200 pt-5 dark:border-white/10`}>
                                    <ReadText label="Asks for a new designation" value={view.request.newDesignation} /><ReadText label="Comment" value={view.request.designationComment} />
                                    <ReadText label="Asks for a new team" value={view.request.newTeam} /><ReadText label="Comment" value={view.request.teamComment} />
                                </div>
                            )}
                        </div>
                    </details>
                </Panel>
            )}

            {!me && view.assessors && (
                <Panel title="Assessor reviews">
                    <div className="flex flex-col gap-6">
                        {(["A1", "A2"] as const).map((k) => {
                            const a = view.assessors![k];
                            const who = k === "A1" ? c.assessor1?.name : c.assessor2?.name;
                            return (
                                <div key={k} className="flex flex-col gap-3">
                                    <p className="eyebrow">{k === "A1" ? "Assessor 1" : "Assessor 2"}{who ? ` · ${who}` : ""} · {a?.submittedAt ? "submitted" : "not submitted"}</p>
                                    <div className={COLS2}>
                                        <ReadText label="Overall rating" value={a?.overallRating?.toString()} />
                                        <ReadText label="Comment" value={a?.comment} />
                                    </div>
                                    {view.minimal?.[k] && <MoneyCard title="Minimal acceptable hike" money={view.minimal[k]} />}
                                </div>
                            );
                        })}
                        {(view.expected || view.target) && <div className={`${COLS2} border-t border-ink-200 pt-5 dark:border-white/10`}><MoneyCard title="Employee expects" money={view.expected} /><MoneyCard title="Employee's target" money={view.target} /></div>}
                        {view.approved && <MoneyCard title="Approved hike" money={view.approved} accent />}
                    </div>
                </Panel>
            )}

            {me && (
                <Panel title="Your review">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-4">
                            <p className="eyebrow">Rating for each quarter</p>
                            {qs.map((q) => {
                                const theirs = view.quarters?.find((x) => x.quarter === q.quarter)?.ratings?.[other];
                                return (
                                    <div key={q.quarter} className="grid grid-cols-1 items-start gap-4 md:grid-cols-[72px_160px_minmax(0,1fr)]">
                                        <span className="flex h-14 items-center text-sm font-bold text-ink-900 dark:text-white">Q{q.quarter}</span>
                                        {editable ? ratingBox("Final rating", q.finalRating, (v) => setQ(q.quarter, "finalRating", v)) : <ReadText label="Final rating" value={q.finalRating} />}
                                        {editable ? <Textarea label="Comments" minRows={1} value={q.comments} onValueChange={(v) => setQ(q.quarter, "comments", v)} /> : <ReadText label="Comments" value={q.comments} />}
                                        {theirs && <p className="text-xs text-ink-500 md:col-start-2 md:col-span-2">{other === "A1" ? "Assessor 1" : "Assessor 2"} gave <b className="text-ink-800 dark:text-ink-100">{theirs.finalRating ?? "—"}</b>{theirs.comments ? `: ${theirs.comments}` : ""}</p>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className={`${COLS2} border-t border-ink-200 pt-5 dark:border-white/10`}>
                            {editable ? ratingBox("Overall rating", overall, setOverall) : <ReadText label="Overall rating" value={overall} />}
                            <div className="md:row-span-1">{editable ? <HikeField label="Minimal acceptable hike (per year)" value={minimal} onChange={setMinimal} level={c.level} /> : <MoneyCard title="Minimal acceptable hike" money={view.minimal?.[me]} />}</div>
                            <div className="md:col-span-2">{editable ? <Textarea label="Comment" minRows={3} value={comment} onValueChange={setComment} /> : <ReadText label="Comment" value={comment} />}</div>
                            {me === "A1" && <div className="md:col-span-2">{editable ? <Textarea label="Manager feedback (the employee never sees this)" minRows={3} value={feedback} onValueChange={setFeedback} /> : <ReadText label="Manager feedback" value={feedback} />}</div>}
                        </div>

                        {view.assessors?.[other] && (
                            <div className="flex flex-col gap-3 border-t border-ink-200 pt-5 dark:border-white/10">
                                <p className="eyebrow">{other === "A1" ? "Assessor 1" : "Assessor 2"} · {view.assessors[other]!.submittedAt ? "submitted" : "draft"}</p>
                                <div className={COLS2}>
                                    <ReadText label="Overall rating" value={view.assessors[other]!.overallRating?.toString()} />
                                    <ReadText label="Comment" value={view.assessors[other]!.comment} />
                                    {view.assessors[other]!.managerFeedback !== undefined && <div className="md:col-span-2"><ReadText label="Manager feedback" value={view.assessors[other]!.managerFeedback} /></div>}
                                    {view.minimal?.[other] && <MoneyCard title="Minimal acceptable hike" money={view.minimal[other]} />}
                                </div>
                            </div>
                        )}
                        {me === "A2" && view.approved && <MoneyCard title="Approved hike" money={view.approved} accent />}
                    </div>
                </Panel>
            )}

            {editable && (
                <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border border-ink-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-ink-900">
                    <p className="mr-auto text-xs text-ink-500">{me && view.assessors?.[me]?.submittedAt ? "Submitted. You can still change it until the window closes." : "Not submitted yet"}</p>
                    <Button variant="bordered" isLoading={saving === "draft"} isDisabled={saving !== null} onPress={() => save(false)}>Save draft</Button>
                    <Button color="primary" isLoading={saving === "submit"} isDisabled={saving !== null} onPress={() => save(true)}>Submit review</Button>
                </div>
            )}
        </div>
    );
}
