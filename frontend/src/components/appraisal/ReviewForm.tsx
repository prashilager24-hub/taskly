import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@heroui/theme";

import { Panel, Segmented } from "@/components/page";
import { Button, Chip, Input, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type BudgetOverview, type CycleView, type Decision, type RequestField } from "./api";
import { LEVEL_LABEL, addDaysIso, day, inr } from "./format";
import { ANSWER_QUESTIONS, Banner, COLS2, HikeField, MoneyCard, ReadText } from "./parts";
import PmsTable from "./PmsTable";
import QuarterGrid from "./QuarterGrid";

type Ask = { comment: string; decision: Decision | "" };
const rate = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

// The review of one appraisal. Only fields the server sent are drawn, so a hidden field leaves no empty box.
// FL: comment on the requested changes, propose a hike inside the team budget. EL: the same, decide each request, then approve the final hike.
// Finance: approve an EL's hike, or write to that EL about the budget.
export default function ReviewForm() {
    const { cycleId } = useParams();
    const nav = useNavigate();
    const id = Number(cycleId);
    const [view, setView] = useState<CycleView | null>(null);
    const [budget, setBudget] = useState<BudgetOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<"draft" | "submit" | "approve" | "note" | null>(null);

    const [overall, setOverall] = useState("");
    const [comment, setComment] = useState("");
    const [feedback, setFeedback] = useState("");
    const [proposed, setProposed] = useState<number | null>(null);
    const [asks, setAsks] = useState<Record<RequestField, Ask>>({ DESIGNATION: { comment: "", decision: "" }, TEAM: { comment: "", decision: "" } });
    const [approved, setApproved] = useState<number | null>(null);
    const [approveNote, setApproveNote] = useState("");
    const [financeNote, setFinanceNote] = useState("");

    const load = useCallback(async () => {
        try {
            const v = await appraisalApi.cycle(id);
            setView(v);
            const me = v.role === "A1" || v.role === "A2" ? v.role : null;
            const mine = me ? v.assessors?.[me] : null;
            setOverall(mine?.overallRating != null ? String(mine.overallRating) : "");
            setComment(mine?.comment ?? "");
            setFeedback(mine?.managerFeedback ?? "");
            setProposed(me ? v.minimal?.[me]?.annual ?? null : null);
            const from = (f: RequestField): Ask => { const r = me ? v.requestReviews?.[f]?.[me] : null; return { comment: r?.comment ?? "", decision: (r && "decision" in r ? r.decision : null) ?? "" }; };
            setAsks({ DESIGNATION: from("DESIGNATION"), TEAM: from("TEAM") });
            setApproved((cur) => cur ?? v.approved?.annual ?? v.minimal?.A2?.annual ?? v.minimal?.A1?.annual ?? null);
            setFinanceNote(v.financeComment ?? "");
            if (me) appraisalApi.budget().then(setBudget).catch(() => setBudget(null));
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
    const asked: { field: RequestField; label: string; value: string; why: string }[] = [
        ...(view.request?.newDesignation ? [{ field: "DESIGNATION" as const, label: "designation", value: view.request.newDesignation, why: view.request.designationComment }] : []),
        ...(view.request?.newTeam ? [{ field: "TEAM" as const, label: "team", value: view.request.newTeam, why: view.request.teamComment }] : []),
    ];
    const setAsk = (f: RequestField, patch: Partial<Ask>) => setAsks((a) => ({ ...a, [f]: { ...a[f], ...patch } }));

    // The share of the hike budget this person works inside, so they see what is left while they propose
    const share = budget && "shares" in budget ? budget.shares[0] : null;
    const dept = budget && "departments" in budget ? budget.departments.find((d) => d.fls.some((f) => f.userId === c.assessor1?.userId)) ?? budget.departments[0] : null;

    const save = async (submit: boolean) => {
        setSaving(submit ? "submit" : "draft");
        try {
            await appraisalApi.assessorReview(c.id, {
                overallRating: rate(overall), comment, ...(me === "A1" ? { managerFeedback: feedback } : {}), minimalHike: proposed,
                submit,
            });
            addToast({ title: submit ? "Review submitted" : "Draft saved", color: "success" });
            await load();
        } catch (e) { addToast({ title: submit ? "Could not submit" : "Could not save", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const approve = async () => {
        if (approved == null) return;
        setSaving("approve");
        try {
            await appraisalApi.approve(c.id, { approvedHike: approved, comment: approveNote.trim() || undefined });
            addToast({ title: "Hike approved", description: "The offer is now with the employee.", color: "success" });
            await load();
        } catch (e) { addToast({ title: "Could not approve", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const decide = async () => {
        const pick = (f: RequestField) => (asked.some((a) => a.field === f) && asks[f].decision ? { decision: asks[f].decision as Decision, comment: asks[f].comment.trim() || undefined } : undefined);
        setSaving("approve");
        try {
            await appraisalApi.decideRequests(c.id, { designation: pick("DESIGNATION"), team: pick("TEAM") });
            addToast({ title: "Decision saved", description: "The employee can see it now.", color: "success" });
            await load();
        } catch (e) { addToast({ title: "Could not save the decision", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const sendNote = async () => {
        setSaving("note");
        try { await appraisalApi.financeNote(c.id, financeNote.trim()); addToast({ title: "Note sent to the EL", color: "success" }); await load(); }
        catch (e) { addToast({ title: "Could not send the note", description: errorText(e), color: "danger" }); }
        finally { setSaving(null); }
    };

    const ratingBox = (label: string, v: string, set: (s: string) => void) => (
        <Input label={label} type="number" min={1} max={5} step={0.1} value={v} onValueChange={set} placeholder="1 to 5" />
    );

    return (
        <div className="flex flex-col gap-6">
            <div><Button size="sm" variant="light" startContent={<ArrowLeft size={14} />} onPress={() => nav(view.role === "FINANCE" ? "/appraisal/budget" : "/appraisal/team")}>Back</Button></div>
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-ink-900 dark:text-white">{c.employeeName}</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400">{LEVEL_LABEL[c.level]}{c.assessor1 ? ` · reports to ${c.assessor1.name}` : ""}</p>
            </div>

            {editable ? <Banner>{view.timed ? <>Your review is open until <b>{day(c.assessorWindowEnd)}</b>. You can change it until the window closes.</> : "Your review is open. You can change it until the final hike is approved."}</Banner>
                : c.status === "EMPLOYEE_OPEN" ? <Banner tone="warn">{view.timed ? <>This opens for you on {day(addDaysIso(c.start, 15))}, after the employee's window closes. Appraisal window is closed for you until then.</> : "Waiting for the employee to submit. It comes to you as soon as they do."}</Banner>
                : me && c.status === "ASSESSOR_OPEN" ? <Banner tone="warn">Appraisal window is closed. Your review is shown below as it was saved.</Banner> : null}

            {view.pms !== undefined && (
                <Panel title="Goals and targets by quarter">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-3"><p className="eyebrow">From PMS Quarterly Reviews</p><PmsTable quarters={view.pms} /></div>
                        {view.slots && <div className="flex flex-col gap-3"><p className="eyebrow">Comments, achievements and failures from PMS</p><QuarterGrid slots={view.slots} pms={view.pms} /></div>}
                    </div>
                </Panel>
            )}

            {view.self !== undefined && (
                <Panel title="The employee's hike proposal" actions={view.self?.submittedAt ? <Chip size="sm" variant="flat" color="success">Submitted {day(view.self.submittedAt)}</Chip> : <Chip size="sm" variant="flat" color="warning">Not submitted yet</Chip>}>
                    <div className="flex flex-col gap-6">
                        <div className={COLS2}><MoneyCard title="Expected hike" money={view.expected} /><MoneyCard title="Target hike" money={view.target} /></div>
                        <div className="flex flex-col gap-4 border-t border-ink-200 pt-5 dark:border-white/10">
                            <p className="eyebrow">Why this hike</p>
                            {ANSWER_QUESTIONS.some(([k]) => view.self?.answers?.[k])
                                ? <div className={COLS2}>{ANSWER_QUESTIONS.map(([key, label]) => <ReadText key={key} label={label} value={view.self?.answers?.[key]} />)}</div>
                                : <p className="text-sm text-ink-500">No reasons written yet.</p>}
                        </div>
                    </div>
                </Panel>
            )}

            {me && (
                <Panel title="Your review">
                    <div className="flex flex-col gap-6">
                        {(share || dept) && (
                            <div className="grid grid-cols-1 gap-4 border border-ink-200 p-4 dark:border-white/10 sm:grid-cols-3">
                                {share ? <>
                                    <div><p className="eyebrow">Your team budget</p><p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{inr(share.allocation)}</p></div>
                                    <div><p className="eyebrow">Proposed or approved so far</p><p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{inr(share.used)}</p></div>
                                    <div><p className="eyebrow">Left to give</p><p className={cn("mt-1 text-xl font-bold", share.remaining < 0 ? "text-rose-600" : "text-emerald-600")}>{inr(share.remaining)}</p></div>
                                </> : dept && <>
                                    <div><p className="eyebrow">{dept.name} budget</p><p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{dept.budget == null ? "Not set" : inr(dept.budget)}</p></div>
                                    <div><p className="eyebrow">Proposed or approved so far</p><p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{inr(dept.used)}</p></div>
                                    <div><p className="eyebrow">Left in the department</p><p className={cn("mt-1 text-xl font-bold", dept.budget != null && dept.budget - dept.used < 0 ? "text-rose-600" : "text-emerald-600")}>{dept.budget == null ? "—" : inr(dept.budget - dept.used)}</p></div>
                                </>}
                            </div>
                        )}

                        <div className={COLS2}>
                            {editable ? ratingBox("Overall rating", overall, setOverall) : <ReadText label="Overall rating" value={overall} />}
                            <div>{editable ? <HikeField label="Proposed hike (per year)" value={proposed} onChange={setProposed} level={c.level} /> : <MoneyCard title="Proposed hike" money={view.minimal?.[me]} />}</div>
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
                                    {view.minimal?.[other] && <MoneyCard title="Proposed hike" money={view.minimal[other]} />}
                                </div>
                            </div>
                        )}
                    </div>
                </Panel>
            )}

            {!me && view.assessors && (
                <Panel title="Everything on this appraisal">
                    <div className="flex flex-col gap-6">
                        {(["A1", "A2"] as const).map((k) => {
                            const a = view.assessors![k];
                            const who = k === "A1" ? c.assessor1?.name : c.assessor2?.name;
                            return (
                                <div key={k} className="flex flex-col gap-3 border-t border-ink-200 pt-5 dark:border-white/10">
                                    <p className="eyebrow">{k === "A1" ? "FL / Manager" : "EL"}{who ? ` · ${who}` : ""} · {a?.submittedAt ? "submitted" : "not submitted"}</p>
                                    <div className={COLS2}><ReadText label="Overall rating" value={a?.overallRating?.toString()} /><ReadText label="Comment" value={a?.comment} /></div>
                                    {a?.managerFeedback !== undefined && a.managerFeedback && <ReadText label="Manager feedback" value={a.managerFeedback} />}
                                    {view.minimal?.[k] && <MoneyCard title="Proposed hike" money={view.minimal[k]} />}
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            {(view.can.approve || view.approved) && (
                <Panel title={c.level === "HEAD_EL" ? "Finance approval" : "Final approval"}>
                    <div className="flex flex-col gap-5">
                        {view.can.approve ? (
                            <>
                                <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">{c.level === "HEAD_EL" ? "Check the EL's hike against the budget. Approve it to send the offer, or write to the EL about the budget; the note goes to the EL only." : "Set the hike that goes to the employee as an offer. It starts from what you and the first assessor proposed."}</p>
                                <div className={COLS2}>
                                    <HikeField label="Approved hike (per year)" value={approved} onChange={setApproved} level={c.level} />
                                    <Textarea label="Comment (optional)" minRows={2} value={approveNote} onValueChange={setApproveNote} />
                                </div>
                                {view.can.financeNote && (
                                    <div className="grid grid-cols-1 items-end gap-4 border-t border-ink-200 pt-5 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <Textarea label="Note to the EL about the budget (EL only)" minRows={2} value={financeNote} onValueChange={setFinanceNote} />
                                        <Button variant="bordered" isLoading={saving === "note"} isDisabled={saving !== null || !financeNote.trim()} onPress={sendNote}>Send note to the EL</Button>
                                    </div>
                                )}
                                <div className="flex justify-end"><Button color="primary" isLoading={saving === "approve"} isDisabled={saving !== null || approved == null} onPress={approve}>Approve and send the offer</Button></div>
                            </>
                        ) : <MoneyCard title="Approved hike" money={view.approved} accent />}
                    </div>
                </Panel>
            )}

            {asked.length > 0 && (c.status === "ACCEPTED" || view.can.decideRequests) && (
                <Panel title="Requested changes">
                    <div className="flex flex-col gap-4">
                        <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">{view.can.decideRequests ? "The employee accepted the hike and asked for these changes. Give the final decision on each; it is shown to the employee." : "Asked for by the employee when accepting the hike. The EL gives the final decision."}</p>
                        {asked.map((a) => {
                            const d = view.requestReviews?.[a.field]?.A2;
                            const open = !!view.can.decideRequests && !d?.decision;
                            return (
                                <div key={a.field} className="flex flex-col gap-3 border border-ink-200 p-4 dark:border-white/10">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-ink-900 dark:text-white">New {a.label}: {a.value}</p>
                                        {d?.decision && <Chip size="sm" variant="flat" color={d.decision === "APPROVED" ? "success" : "danger"}>{d.decision === "APPROVED" ? "Approved" : "Not approved"}</Chip>}
                                        {!d?.decision && !open && view.role !== "A1" && <Chip size="sm" variant="flat" color="warning">Waiting for EL decision</Chip>}
                                    </div>
                                    {a.why && <p className="text-sm text-ink-600 dark:text-ink-300">The employee says: {a.why}</p>}
                                    {d?.comment && <p className="text-sm text-ink-600 dark:text-ink-300"><b>{c.assessor2?.name ?? "EL"}</b>: {d.comment}</p>}
                                    {open && (
                                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <Textarea label="Your comment (optional)" minRows={2} value={asks[a.field].comment} onValueChange={(v) => setAsk(a.field, { comment: v })} />
                                            <Segmented label={`Decision on the ${a.label} change`} value={(asks[a.field].decision || "") as Decision} onChange={(v) => setAsk(a.field, { decision: v })} options={[{ key: "APPROVED", label: "Approve" }, { key: "REJECTED", label: "Reject" }]} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {view.can.decideRequests && (
                            <div className="flex justify-end"><Button color="primary" isLoading={saving === "approve"} isDisabled={saving !== null || !asked.some((a) => !view.requestReviews?.[a.field]?.A2?.decision && asks[a.field].decision)} onPress={decide}>Save final decision</Button></div>
                        )}
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
