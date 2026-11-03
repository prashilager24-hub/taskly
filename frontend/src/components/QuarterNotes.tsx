import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Spinner } from "@heroui/react";
import { Lock } from "lucide-react";

import { Panel } from "@/components/page";
import { Button, Select, SelectItem, Textarea, addToast } from "@/components/ui";
import { errorText } from "@/components/appraisal/api";
import { yearRange } from "@/lib/years";

const URL = "/t2.0/authentificationUtilization/quarter-reflection";
const MAX = 1000;

interface Reflection { biggestAchievement: string; biggestFailure: string; updatedAt: string }
interface QuarterRow { quarter: string; started: boolean; locked: boolean; reflection: Reflection | null }
interface Draft { achievement: string; failure: string }

const RANGE: Record<string, string> = { Q1: "Jan – Mar", Q2: "Apr – Jun", Q3: "Jul – Sep", Q4: "Oct – Dec" };

/** One quarter: the two notes, saved by the employee. Locked once the manager's review for the quarter is in. */
function QuarterCard({ year, row, onSaved }: { year: number; row: QuarterRow; onSaved: () => void }) {
    const saved = row.reflection;
    const [draft, setDraft] = useState<Draft>({ achievement: saved?.biggestAchievement ?? "", failure: saved?.biggestFailure ?? "" });
    const [busy, setBusy] = useState(false);
    useEffect(() => { setDraft({ achievement: saved?.biggestAchievement ?? "", failure: saved?.biggestFailure ?? "" }); }, [saved?.biggestAchievement, saved?.biggestFailure, year]);

    const editable = row.started && !row.locked;
    const filled = draft.achievement.trim() && draft.failure.trim();
    const changed = draft.achievement.trim() !== (saved?.biggestAchievement ?? "") || draft.failure.trim() !== (saved?.biggestFailure ?? "");

    const save = async () => {
        setBusy(true);
        try {
            await axios.put(`${URL}/mine`, { quarter: row.quarter, year, biggestAchievement: draft.achievement, biggestFailure: draft.failure });
            addToast({ title: `${row.quarter} ${year} notes saved`, color: "success" });
            onSaved();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    const status = row.locked ? "Review submitted – locked" : !row.started ? "Opens when the quarter starts" : saved ? "Saved" : "Not entered yet";
    return (
        <Panel title={`${row.quarter} ${year} · ${RANGE[row.quarter]}`} actions={<span className="flex items-center gap-1.5 text-xs text-ink-500">{row.locked && <Lock size={12} />}{status}</span>}>
            <div className="grid gap-4 md:grid-cols-2">
                <Textarea label="Biggest achievement" placeholder="The one thing you are proudest of this quarter" minRows={4} maxLength={MAX} isRequired isDisabled={!editable}
                    value={draft.achievement} onValueChange={(v) => setDraft((d) => ({ ...d, achievement: v }))} description={editable ? `${draft.achievement.length}/${MAX}` : undefined} />
                <Textarea label="Biggest failure" placeholder="What went wrong, and what you learned from it" minRows={4} maxLength={MAX} isRequired isDisabled={!editable}
                    value={draft.failure} onValueChange={(v) => setDraft((d) => ({ ...d, failure: v }))} description={editable ? `${draft.failure.length}/${MAX}` : undefined} />
            </div>
            {editable && (
                <div className="mt-4 flex items-center justify-end gap-3">
                    {!saved && <p className="mr-auto text-xs text-ink-500">Your manager can submit your quarterly review only after you save both.</p>}
                    <Button color="primary" isLoading={busy} isDisabled={!filled || !changed} onPress={save}>{saved ? "Update" : "Save"}</Button>
                </div>
            )}
        </Panel>
    );
}

/** Quarter Highlights: each person writes their own biggest achievement and biggest failure for every quarter */
export default function QuarterNotes() {
    const years = yearRange();
    const [year, setYear] = useState(new Date().getFullYear());
    const [rows, setRows] = useState<QuarterRow[] | null>(null);
    const [failed, setFailed] = useState<string | null>(null);

    const load = useCallback(() => {
        axios.get(`${URL}/mine`, { params: { year } })
            .then((r) => { setRows(r.data.data.quarters); setFailed(null); })
            .catch((e) => setFailed(errorText(e, "Could not load your notes.")));
    }, [year]);
    useEffect(() => { setRows(null); load(); }, [load]);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="max-w-[70ch] text-sm text-ink-500 dark:text-ink-400">
                    For each quarter, write your biggest achievement and your biggest failure. Only you can write these. Your manager reads them while reviewing your quarter, and they appear in your appraisal.
                </p>
                <Select aria-label="Year" label="Year" size="sm" className="w-32" disallowEmptySelection selectedKeys={[String(year)]} onSelectionChange={(k) => setYear(Number(Array.from(k)[0]))}>
                    {years.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
                </Select>
            </div>
            {failed && <p className="text-sm text-danger">{failed}</p>}
            {!rows && !failed && <div className="flex justify-center py-10"><Spinner /></div>}
            {rows?.map((row) => <QuarterCard key={`${year}-${row.quarter}`} year={year} row={row} onSaved={load} />)}
        </div>
    );
}
