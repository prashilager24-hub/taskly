import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "@heroui/react";
import { ArrowLeft } from "lucide-react";

import { Panel } from "@/components/page";
import { Button, Chip, addToast } from "@/components/ui";
import { appraisalApi, errorText, type MyView, type PersonView as View } from "./api";
import { LEVEL_LABEL, REQ_COLOR, REQ_LABEL, day, inr, periodLabel, periodOfDate } from "./format";
import { COLS2, MoneyCard, ReadText, StageChip, WHY_KEY, WHY_LABEL } from "./parts";
import PmsTable from "./PmsTable";
import QuarterGrid from "./QuarterGrid";

const DECIDER = { EL_OWN: "Their EL themselves, agreed with Management", EL_DIRECT: "The EL (reports to them directly)", FL_TEAM: "Their FL, approved by the EL", FL_OWN: "Themselves as FL, approved by the EL" } as const;

// One person's appraisal for the people who decide it (their FL, their EL, the Finance Head): read only.
export default function PersonView() {
    const { cycleId } = useParams();
    const nav = useNavigate();
    const [v, setV] = useState<View | MyView | null>(null);
    useEffect(() => { appraisalApi.cycle(Number(cycleId)).then(setV).catch((e) => addToast({ title: "Could not open this appraisal", description: errorText(e), color: "danger" })); }, [cycleId]);
    if (!v) return <div className="flex justify-center py-20"><Spinner /></div>;
    const c = v.cycle;
    const p = "allocation" in v ? v : null;

    return (
        <div className="flex flex-col gap-6">
            <div><Button size="sm" variant="light" startContent={<ArrowLeft size={14} />} onPress={() => nav(-1)}>Back</Button></div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold text-ink-900 dark:text-white">{c.employeeName}</h2>
                    <p className="text-sm text-ink-500">{LEVEL_LABEL[c.level]}{v.department ? ` · ${v.department}` : ""} · {periodLabel(periodOfDate(c.start))}</p>
                    <p className="text-xs text-ink-500">{v.route.source ? `Hike decided by: ${DECIDER[v.route.source]}` : ""}{v.route.fl ? ` · FL ${v.route.fl.name}` : ""}{v.route.el ? ` · EL ${v.route.el.name}` : ""}</p>
                </div>
                <StageChip stage={v.stage} />
            </div>

            <Panel title="Appeal">
                <div className="flex flex-col gap-5">
                    <div className={COLS2}><MoneyCard title="Expected hike" money={v.expected} /><MoneyCard title="Target hike" money={v.target} /></div>
                    <ReadText label={WHY_LABEL} value={v.self?.answers?.[WHY_KEY]} />
                    <p className="text-xs text-ink-500">{v.self?.submittedAt ? `Submitted ${day(v.self.submittedAt)}` : "Not submitted"}{c.currentAnnualCtc != null ? ` · current CTC ${inr(c.currentAnnualCtc)}` : ""}</p>
                </div>
            </Panel>

            {p && (p.allocation != null || v.approved) && (
                <Panel title="Hike">
                    <div className={COLS2}>
                        {v.approved ? <MoneyCard title="Final hike" money={v.approved} accent /> : <div className="flex flex-col gap-1 border border-ink-200 p-4 dark:border-white/10"><p className="eyebrow">Proposed hike</p><p className="text-2xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(p.allocation)}</p><p className="text-xs text-ink-500">Not approved yet</p></div>}
                        {p.reason !== undefined && <ReadText label="Reason for this hike" value={p.reason} />}
                    </div>
                </Panel>
            )}

            {v.requests.length > 0 && (
                <Panel title="Designation / team requests">
                    <ul className="flex flex-col gap-3">
                        {v.requests.map((r) => (
                            <li key={r.field} className="flex flex-col gap-1 border border-ink-200 p-3 dark:border-white/10">
                                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm"><span className="text-ink-500">{r.field === "DESIGNATION" ? "Designation" : "Team"}:</span> <b className="text-ink-900 dark:text-white">{r.value}</b></p><Chip size="sm" variant="flat" color={REQ_COLOR[r.stage]}>{REQ_LABEL[r.stage]}</Chip></div>
                                {r.why && <p className="text-xs text-ink-600 dark:text-ink-300">“{r.why}”</p>}
                                {r.fl?.recommendation && <p className="text-xs text-ink-600 dark:text-ink-300">{r.fl.recommendation === "SUPPORT" ? "FL recommends" : "FL does not recommend"}{r.fl.comment ? `: ${r.fl.comment}` : ""}</p>}
                                {r.elComment && <p className="text-xs text-ink-600 dark:text-ink-300">EL: {r.elComment}</p>}
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            {v.response?.decision === "REJECT" && (
                <Panel title="Rejected and postponed">
                    <div className={COLS2}><ReadText label="Reason" value={v.response.reason} /><ReadText label="What they expect" value={v.response.expectations} /></div>
                    <p className="mt-3 text-xs text-ink-500">Postponed {v.response.postponeMonths} months, to {day(c.postponedUntil)}.</p>
                </Panel>
            )}

            <Panel title="Goals and targets by quarter">
                <div className="flex flex-col gap-6"><PmsTable quarters={v.pms ?? []} /><QuarterGrid slots={v.slots ?? []} pms={v.pms ?? []} /></div>
            </Panel>
        </div>
    );
}
