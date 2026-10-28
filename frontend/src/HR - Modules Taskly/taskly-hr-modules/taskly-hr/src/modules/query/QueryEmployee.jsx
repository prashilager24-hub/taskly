import { useState } from "react";
import { Plus, Send, Star, AlertTriangle } from "lucide-react";
import { Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "../../../../../../components/ui";
import {
  Screen, Field, BackLink, Scale, ScaleLegend, Section, Pill,
  Empty, ContextBar, Thread, OpenPoint, THead,
} from "../../components/ui";
import { QUERY_QUESTIONS } from "../../lib/questions";
import { avg, one, queryScore } from "../../lib/metrics";

const CATEGORIES = {
  HR: ["Payroll", "Leave", "Policy/process", "Benefits", "Attendance", "Other"],
  "L&D": ["Training", "Certification", "Nomination", "Other"],
};

export default function QueryEmployee({ queries = [], currentUser, onRaise, onRate, onReopen, onReply }) {
  const [view, setView] = useState("list");
  const [team, setTeam] = useState("HR");
  const [category, setCategory] = useState("Payroll");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("Normal");

  const [rateId, setRateId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reply, setReply] = useState("");

  const mine = queries.filter((q) => q.employee === currentUser.name);
  const target = queries.find((q) => q.id === rateId);
  const opened = queries.find((q) => q.id === openId);
  const qs = target ? QUERY_QUESTIONS(target.team) : [];
  const complete = qs.length > 0 && qs.every((_, i) => ratings[i]);
  const runningAvg = complete ? avg(qs.map((_, i) => ratings[i])) : null;

  if (target) {
    return (
      <Screen id="2.3" title={`${target.team} Query / Support Survey`} sub="Sent when the resolver marks the query resolved">
        <BackLink onClick={() => setRateId(null)} />
        <ContextBar
          title={`${target.id} · ${target.subject}`}
          meta={`Routed to ${target.team} · Raised ${target.raisedOn} · Resolved`}
        />
        <Thread messages={target.thread} />

        <ScaleLegend />
        <Section>Rate the support you received</Section>
        {qs.map((q, i) => (
          <Field key={i} label={`${i + 1}. ${q}`}>
            <Scale compact value={ratings[i]} onChange={(n) => setRatings({ ...ratings, [i]: n })} />
          </Field>
        ))}
        <Field label="Any comments on the resolution?">
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional…" variant="bordered" />
        </Field>

        {runningAvg !== null && runningAvg < 5 && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5 mb-3.5">
            <AlertTriangle size={14} /> Not satisfied? You can reopen this query instead of closing it.
          </div>
        )}

        <div className="flex gap-2.5">
          <Button
            size="sm"
            color="primary"
            className="text-white"
            isDisabled={!complete}
            startContent={<Star size={14} />}
            onPress={() => {
              onRate(target.id, qs.map((_, i) => ratings[i]), comment);
              setRateId(null); setRatings({}); setComment("");
            }}
          >
            Submit &amp; close query
          </Button>
          {onReopen && <Button size="sm" variant="flat" onPress={() => { setReopenReason("Issue still persists"); setReopenOpen(true); }}>Reopen query</Button>}
        </div>

        <OpenPoint>
          Six ratings per ticket is heavy. Q1–Q5 measure the {target.team} service in general; only Q6 is about this
          specific query. Pending decision: full set per ticket, or Q6 per ticket plus the full set quarterly.
        </OpenPoint>

        <Modal isOpen={reopenOpen} onClose={() => setReopenOpen(false)} size="sm">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Reopen {target.id}</ModalHeader>
                <ModalBody>
                  <Input
                    label="Reason (optional)"
                    placeholder="Issue still persists"
                    value={reopenReason}
                    onValueChange={setReopenReason}
                    variant="bordered"
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>Cancel</Button>
                  <Button
                    color="primary"
                    className="text-white"
                    onPress={() => {
                      onReopen(target.id, reopenReason.trim());
                      setReopenReason("");
                      onClose();
                    }}
                  >
                    Reopen
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </Screen>
    );
  }

  if (opened) {
    return (
      <Screen id="2.2b" title="Query detail" sub="Your conversation with the support team">
        <BackLink onClick={() => setOpenId(null)}>Back to my queries</BackLink>
        <ContextBar
          title={`${opened.id} · ${opened.subject}`}
          meta={`Routed to ${opened.team} · ${opened.category} · ${opened.priority} · Raised ${opened.raisedOn}`}
        />
        <div className="mb-3">
          {opened.status === "open" && <Pill tone="open">Open</Pill>}
          {opened.status === "in_progress" && <Pill tone="open">In progress</Pill>}
          {opened.status === "resolved" && <Pill tone="grey">Awaiting your rating</Pill>}
          {opened.status === "closed" && <Pill tone="done">Closed · {one(opened.supportScore ?? queryScore(opened))}/10</Pill>}
        </div>
        <Thread messages={opened.thread} />
        {opened.status === "open" || opened.status === "in_progress" ? (
          <Field label="Add a message to the support team">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a follow-up…" variant="bordered" />
          </Field>
        ) : (
          <div className="text-[11px] text-ink-400 mt-2 mb-2">This query is {opened.status === "resolved" ? "awaiting your rating" : "closed"} — messaging is disabled.</div>
        )}
        <div className="flex gap-2.5 flex-wrap">
          {(opened.status === "open" || opened.status === "in_progress") && (
            <Button
              size="sm"
              color="primary"
              className="text-white"
              isDisabled={!reply.trim()}
              startContent={<Send size={14} />}
              onPress={() => {
                if (onReply) onReply(opened.id, reply);
                setReply("");
              }}
            >
              Send reply
            </Button>
          )}
          {opened.status === "resolved" && (
            <Button size="sm" color="primary" className="text-white" onPress={() => { setRateId(opened.id); setOpenId(null); }}>
              Rate this resolution
            </Button>
          )}
          <Button size="sm" variant="flat" onPress={() => { setOpenId(null); setReply(""); }}>Back</Button>
        </div>
      </Screen>
    );
  }

  return (
    <>
      <Screen id="2.1" title="Raise a query" sub="Open to every employee">
        {view === "list" ? (
          <Button size="sm" color="primary" className="text-white" startContent={<Plus size={14} />} onPress={() => setView("form")}>
            Raise a new query
          </Button>
        ) : (
          <>
            <Field label="Route to">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
                {["HR", "L&D"].map((t) => (
                  <Button
                    key={t}
                    size="lg"
                    variant={team === t ? "solid" : "bordered"}
                    color={team === t ? "primary" : "default"}
                    className={team === t ? "text-white justify-start" : "justify-start"}
                    onPress={() => { setTeam(t); setCategory(CATEGORIES[t][0]); }}
                  >
                    <div className="text-left">
                      <div>{t === "HR" ? "HR Team" : "L&D Team"}</div>
                      <div className="text-[11px] font-normal opacity-70">
                        {t === "HR" ? "Payroll, leave, policy, benefits" : "Training, certification, upskilling"}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </Field>

            <Field label="Category">
              <Select variant="bordered" selectedKeys={[category]} onSelectionChange={(keys) => setCategory(Array.from(keys)[0])} aria-label="Category">
                {CATEGORIES[team].map((c) => <SelectItem key={c}>{c}</SelectItem>)}
              </Select>
            </Field>
            <Field label="Subject">
              <Input variant="bordered" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line summary" />
            </Field>
            <Field label="Describe your query">
              <Textarea variant="bordered" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Details…" />
            </Field>
            <Field label="Priority">
              <Select variant="bordered" selectedKeys={[priority]} onSelectionChange={(keys) => setPriority(Array.from(keys)[0])} className="w-40" aria-label="Priority">
                <SelectItem key="Low">Low</SelectItem>
                <SelectItem key="Normal">Normal</SelectItem>
                <SelectItem key="High">High</SelectItem>
              </Select>
            </Field>

            <div className="flex gap-2.5">
              <Button
                size="sm"
                color="primary"
                className="text-white"
                isDisabled={!subject.trim() || !desc.trim()}
                startContent={<Send size={14} />}
                onPress={() => {
                  onRaise({ team, category, subject, desc, priority });
                  setSubject(""); setDesc(""); setView("list");
                }}
              >
                Submit query
              </Button>
              <Button size="sm" variant="flat" onPress={() => setView("list")}>Cancel</Button>
            </div>
          </>
        )}
      </Screen>

      <Screen id="2.2" title="My queries" sub="Your tickets and their status">
        <table className="w-full text-sm">
          <THead cols={["ID", "Subject", "Routed to", "Raised", "Status", ""]} />
          <tbody>
            {mine.map((q) => (
              <tr key={q.id} className="border-b border-ink-100 dark:border-white/10 last:border-0">
                <td className="py-3 text-ink-500 dark:text-ink-400 font-secondary text-xs">{q.id}</td>
                <td className="py-3">{q.subject}</td>
                <td className="py-3 text-[13px]">{q.team}</td>
                <td className="py-3 text-ink-500 dark:text-ink-400 text-[13px]">{q.raisedOn}</td>
                <td className="py-3">
                  {q.status === "open" && <Pill tone="open">Open</Pill>}
                  {q.status === "in_progress" && <Pill tone="open">In progress</Pill>}
                  {q.status === "resolved" && <Pill tone="grey">Awaiting your rating</Pill>}
                  {q.status === "closed" && <Pill tone="done">Closed · {one(q.supportScore ?? queryScore(q))}/10</Pill>}
                </td>
                <td className="py-3 text-right">
                  {q.status === "resolved" && (
                    <Button size="sm" variant="flat" onPress={() => setRateId(q.id)} className="mr-2">Rate</Button>
                  )}
                  <Button size="sm" variant={q.status === "resolved" ? "bordered" : "flat"} onPress={() => setOpenId(q.id)}>Open</Button>
                </td>
              </tr>
            ))}
            {mine.length === 0 && (
              <tr><td colSpan={6} className="py-6"><Empty>You have not raised any queries.</Empty></td></tr>
            )}
          </tbody>
        </table>
      </Screen>
    </>
  );
}
