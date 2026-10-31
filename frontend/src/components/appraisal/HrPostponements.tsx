import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";

import { Panel, SummaryBar } from "@/components/page";
import { Button, Chip, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type HrItem } from "./api";
import { LEVEL_LABEL, day } from "./format";
import { COLS2, ReadText } from "./parts";

const HR_COLOR = { PENDING: "warning", APPROVED: "success", RETURNED: "danger" } as const;
const HR_LABEL = { PENDING: "Waiting for HR", APPROVED: "Approved", RETURNED: "Returned" } as const;

function Card({ item, onDone }: { item: HrItem; onDone: () => void }) {
    const r = item.response!;
    const [comment, setComment] = useState(r.hrComment ?? "");
    const [busy, setBusy] = useState<"APPROVED" | "RETURNED" | null>(null);
    const decide = async (status: "APPROVED" | "RETURNED") => {
        setBusy(status);
        try { await appraisalApi.hrDecide(item.cycle.id, { status, comment: comment.trim() || undefined }); addToast({ title: status === "APPROVED" ? "Postponement approved" : "Postponement returned", color: "success" }); onDone(); }
        catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(null); }
    };
    return (
        <div className="flex flex-col gap-4 border-b border-ink-200 p-5 last:border-0 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold text-ink-900 dark:text-white">{item.cycle.employeeName}</p><p className="text-xs text-ink-500">{LEVEL_LABEL[item.cycle.level]} · rejected on {day(r.decidedAt)}</p></div>
                <div className="flex items-center gap-3"><span className="text-xs text-ink-600 dark:text-ink-300">Postponed {r.postponeMonths} months, to <b>{day(item.cycle.postponedUntil)}</b></span><Chip size="sm" variant="flat" color={HR_COLOR[r.hrStatus ?? "PENDING"]}>{HR_LABEL[r.hrStatus ?? "PENDING"]}</Chip></div>
            </div>
            <div className={COLS2}><ReadText label="Reason" value={r.reason} /><ReadText label="What the employee expects" value={r.expectations} /></div>
            {r.comment && <ReadText label="Employee comment" value={r.comment} />}
            {item.can.hrDecision && (
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Textarea label="HR comment (optional)" minRows={1} value={comment} onValueChange={setComment} />
                    <Button variant="bordered" isLoading={busy === "RETURNED"} isDisabled={busy !== null} onPress={() => decide("RETURNED")}>Return</Button>
                    <Button color="primary" isLoading={busy === "APPROVED"} isDisabled={busy !== null} onPress={() => decide("APPROVED")}>Approve</Button>
                </div>
            )}
        </div>
    );
}

// HR Postponements: rejected offers. HR approves or returns the postponement; the cycle itself is not changed by HR.
export default function HrPostponements() {
    const [items, setItems] = useState<HrItem[]>([]);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        try { setItems(await appraisalApi.hr()); }
        catch (e) { addToast({ title: "Could not load postponements", description: errorText(e), color: "danger" }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
    const waiting = items.filter((i) => i.response?.hrStatus === "PENDING").length;
    return (
        <div className="flex flex-col gap-6">
            <SummaryBar className="mb-0" items={[{ label: "Waiting for HR", value: waiting }, { label: "All postponements", value: items.length }]} />
            <Panel flush title="Rejected offers">
                {items.length ? items.map((i) => <Card key={i.cycle.id} item={i} onDone={load} />) : <p className="px-5 py-12 text-center text-sm text-ink-500">No offer has been rejected.</p>}
            </Panel>
        </div>
    );
}
