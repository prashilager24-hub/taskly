import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Button, Textarea } from "../../../../../../components/ui";
import {
  Screen, Field, BackLink, Pill, Cards, CardStat,
  ContextBar, Thread, THead,
} from "../../components/ui";
import { one, avg } from "../../lib/metrics";

export default function QueryResolver({
  queries = [], defaultTeam = "HR", slaHours = 72, onReply, onResolve, onReassign,
}) {
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");

  const teamQueries = queries.filter((q) => q.team === defaultTeam);
  const openOnes = teamQueries.filter((q) => q.status === "open" || q.status === "in_progress");
  const rated = teamQueries.filter((q) => q.supportScore != null);
  const active = queries.find((q) => q.id === openId);

  if (active) {
    const settled = active.status === "resolved" || active.status === "closed";
    return (
      <Screen id="2.5" title="Query detail — respond & resolve">
        <BackLink onClick={() => { setOpenId(null); setReply(""); }}>Back to queue</BackLink>
        <ContextBar
          title={`${active.id} · ${active.subject}`}
          meta={`${active.employee} · ${active.category} · Raised ${active.raisedOn} · ${active.ageHrs}h ago`}
        />

        <Thread messages={active.replies || active.thread || []} />

        <Field label="Reply">
          <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your response…" variant="bordered" />
        </Field>

        <div className="flex gap-2.5 flex-wrap">
          <Button size="sm" color="primary" className="text-white" isDisabled={!reply.trim()} startContent={<Send size={14} />}
            onPress={() => { onReply(active.id, reply); setReply(""); }}>
            Send reply
          </Button>
          <Button size="sm" variant="flat" isDisabled={settled} startContent={<CheckCircle2 size={14} />}
            onPress={() => { onResolve(active.id); setOpenId(null); }}>
            Mark resolved
          </Button>
          {onReassign && (
            <Button size="sm" variant="flat" onPress={() => onReassign(active.id)}>
              Reassign
            </Button>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-2.5">
          Marking resolved sends the employee the 6-question support survey. The ticket closes only after they submit it.
        </div>
      </Screen>
    );
  }

  return (
    <Screen id="2.4" title={`${defaultTeam} Query queue`} sub="Resolver sees only queries routed to their team">
      <Cards>
        <CardStat label="Open" value={openOnes.length} />
        <CardStat label="Overdue" value={openOnes.filter((q) => q.ageHrs > slaHours).length} note={`Past ${slaHours}h SLA`} />
        <CardStat label="Resolved / closed" value={teamQueries.filter((q) => q.status === "resolved" || q.status === "closed").length} />
        <CardStat hero label="Avg support score" value={rated.length ? one(avg(rated.map((q) => q.supportScore))) : "—"} unit="/10" note={`${rated.length} surveys`} />
      </Cards>

      <table className="w-full text-sm">
        <THead cols={["ID", "Employee", "Subject", "Category", "Status", ""]} />
        <tbody>
          {teamQueries.map((q) => (
            <tr key={q.id} className="border-b border-gray-100 last:border-0">
              <td className="py-3 text-gray-500 font-mono text-xs">{q.id}</td>
              <td className="py-3">{q.employee}</td>
              <td className="py-3 text-[13px]">{q.subject}</td>
              <td className="py-3 text-[13px] text-gray-600">{q.category}</td>
              <td className="py-3">
                {(q.status === "open" || q.status === "in_progress") &&
                  (q.ageHrs > slaHours
                    ? <Pill tone="warn">Overdue</Pill>
                    : <Pill tone="open">{q.status === "open" ? "Open" : "In progress"}</Pill>)}
                {q.status === "resolved" && <Pill tone="grey">Awaiting survey</Pill>}
                {q.status === "closed" && <Pill tone="done">Closed · {one(q.supportScore ?? 0)}/10</Pill>}
              </td>
              <td className="py-3 text-right">
                <Button size="sm" variant="flat" onPress={() => setOpenId(q.id)}>Open</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Screen>
  );
}
