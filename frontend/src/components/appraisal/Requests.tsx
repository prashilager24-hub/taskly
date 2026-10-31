import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type ChangeRequest, type Decision, type InboxItem } from "./api";
import { LEVEL_LABEL, REQ_COLOR, REQ_LABEL, inr } from "./format";
import { TextBox } from "./parts";

const fieldLabel = (r: ChangeRequest) => (r.field === "DESIGNATION" ? "Designation" : "Team");

/** FL: comment and recommend, then it goes to the EL */
function Forward({ item, onDone }: { item: InboxItem; onDone: () => void }) {
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState<"yes" | "no" | null>(null);
    const send = async (recommend: boolean) => {
        setBusy(recommend ? "yes" : "no");
        try { await appraisalApi.forward(item.cycleId, { comment: comment.trim() || undefined, recommend }); addToast({ title: "Forwarded to the EL", color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not forward", description: errorText(e), color: "danger" }); }
        finally { setBusy(null); }
    };
    return (
        <div className="flex flex-col gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
            <Textarea label="Your comment for the EL" minRows={2} value={comment} onValueChange={setComment} />
            <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="mr-auto text-xs text-ink-500">Either way it goes to the EL, who decides. {item.name} does not see your comment.</p>
                <Button variant="bordered" startContent={<ThumbsDown size={14} />} isLoading={busy === "no"} isDisabled={busy !== null} onPress={() => send(false)}>Do not recommend</Button>
                <Button color="primary" startContent={<ThumbsUp size={14} />} isLoading={busy === "yes"} isDisabled={busy !== null} onPress={() => send(true)}>Recommend</Button>
            </div>
        </div>
    );
}

/** EL: approve or not, each request with a comment */
function Decide({ item, onDone }: { item: InboxItem; onDone: () => void }) {
    const open = item.requests.filter((r) => r.stage === "WITH_EL");
    const [pick, setPick] = useState<Record<string, { decision: Decision | ""; comment: string }>>(() => Object.fromEntries(open.map((r) => [r.field, { decision: "", comment: "" }])));
    const [busy, setBusy] = useState(false);
    const ready = open.every((r) => pick[r.field]?.decision);
    const save = async () => {
        setBusy(true);
        const of = (f: "DESIGNATION" | "TEAM") => (pick[f]?.decision ? { decision: pick[f].decision as Decision, comment: pick[f].comment.trim() || undefined } : undefined);
        try { await appraisalApi.decide(item.cycleId, { designation: of("DESIGNATION"), team: of("TEAM") }); addToast({ title: "Decision saved", description: `${item.name} can see it now.`, color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not save the decision", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    return (
        <div className="flex flex-col gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
            {open.map((r) => (
                <div key={r.field} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_auto_minmax(0,1fr)]">
                    <p className="text-sm text-ink-700 dark:text-ink-200">{fieldLabel(r)}: <b>{r.value}</b></p>
                    <div className="flex gap-2">
                        <Button size="sm" variant={pick[r.field]?.decision === "APPROVED" ? "solid" : "bordered"} color={pick[r.field]?.decision === "APPROVED" ? "success" : "default"} onPress={() => setPick((p) => ({ ...p, [r.field]: { ...p[r.field], decision: "APPROVED" } }))}>Approve</Button>
                        <Button size="sm" variant={pick[r.field]?.decision === "REJECTED" ? "solid" : "bordered"} onPress={() => setPick((p) => ({ ...p, [r.field]: { ...p[r.field], decision: "REJECTED" } }))}>Not approve</Button>
                    </div>
                    <TextBox label={`Comment on the ${fieldLabel(r).toLowerCase()} request`} placeholder="Comment (optional)" value={pick[r.field]?.comment ?? ""} onChange={(v) => setPick((p) => ({ ...p, [r.field]: { ...p[r.field], comment: v } }))} />
                </div>
            ))}
            <div className="flex justify-end"><Button color="primary" isLoading={busy} isDisabled={!ready} onPress={save}>Save decision</Button></div>
        </div>
    );
}

function Item({ item, onDone }: { item: InboxItem; onDone: () => void }) {
    return (
        <div className="flex flex-col gap-4 border-b border-ink-200 p-5 last:border-0 dark:border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link to={`/appraisal/person/${item.cycleId}`} className="text-base font-bold text-ink-900 hover:text-brand-700 hover:underline dark:text-white">{item.name}</Link>
                    <p className="text-xs text-ink-500">{LEVEL_LABEL[item.level]}{item.department ? ` · ${item.department}` : ""}{item.approved ? ` · accepted ${inr(item.approved.annual)} a year` : ""}{item.source === "FL_TEAM" && item.fl ? ` · FL ${item.fl.name}` : ""}</p>
                </div>
            </div>
            <ul className="flex flex-col gap-3">
                {item.requests.map((r) => (
                    <li key={r.field} className="flex flex-col gap-1.5 border border-ink-200 p-3 dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-ink-900 dark:text-white"><span className="text-ink-500">{fieldLabel(r)}:</span> <b>{r.value}</b></p>
                            <Chip size="sm" variant="flat" color={REQ_COLOR[r.stage]}>{REQ_LABEL[r.stage]}</Chip>
                        </div>
                        {r.why && <p className="text-xs text-ink-600 dark:text-ink-300">{item.name.split(" ")[0]}: “{r.why}”</p>}
                        {r.fl?.recommendation && <p className="text-xs text-ink-600 dark:text-ink-300"><b className={r.fl.recommendation === "SUPPORT" ? "text-emerald-600" : "text-amber-600"}>{r.fl.recommendation === "SUPPORT" ? "FL recommends" : "FL does not recommend"}</b>{r.fl.comment ? `: ${r.fl.comment}` : ""}</p>}
                        {r.elComment && <p className="text-xs text-ink-600 dark:text-ink-300">EL: {r.elComment}</p>}
                    </li>
                ))}
            </ul>
            {item.can.forward && <Forward item={item} onDone={onDone} />}
            {item.can.decide && <Decide item={item} onDone={onDone} />}
        </div>
    );
}

// Change requests: an Associate's / Intern's designation or team request comes to their FL first, who forwards it to the EL
// with a recommendation. An FL's own request goes straight to the EL. The EL's approval opens the person's celebration.
export default function Requests() {
    const [items, setItems] = useState<InboxItem[] | null>(null);
    const load = useCallback(async () => {
        try { setItems(await appraisalApi.requests()); }
        catch (e) { addToast({ title: "Could not load the requests", description: errorText(e), color: "danger" }); setItems([]); }
    }, []);
    useEffect(() => { load(); }, [load]);
    if (!items) return <div className="flex justify-center py-20"><Spinner /></div>;
    const todo = items.filter((i) => i.can.forward || i.can.decide);
    const rest = items.filter((i) => !i.can.forward && !i.can.decide);
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[
                { label: "Waiting for you", value: todo.length },
                { label: "Approved", value: items.flatMap((i) => i.requests).filter((r) => r.stage === "APPROVED").length },
                { label: "All requests", value: items.flatMap((i) => i.requests).length },
            ]} />
            <Panel flush title="Waiting for you">{todo.length ? todo.map((i) => <Item key={i.cycleId} item={i} onDone={load} />) : <p className="px-5 py-10 text-center text-sm text-ink-500">Nothing is waiting for you.</p>}</Panel>
            {rest.length > 0 && <Panel flush title="Other requests">{rest.map((i) => <Item key={i.cycleId} item={i} onDone={load} />)}</Panel>}
        </div>
    );
}
