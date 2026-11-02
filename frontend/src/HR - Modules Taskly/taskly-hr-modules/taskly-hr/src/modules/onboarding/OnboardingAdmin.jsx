import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "../../../../../../components/ui";
import {
  Screen, Section, Cards, CardStat, EmailPreview, Empty, THead, Pill,
} from "../../components/ui";
import { onboardingStructure } from "../../lib/surveyStructure";
import { avg, one, pct, surveyScore } from "../../lib/metrics";

const label = "text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400";

/** Every question with the rating this person gave, then the open comment */
function Answers({ s }) {
  if (!s.answers || !s.answers.length) {
    return <p className="py-3 text-xs text-ink-500 dark:text-ink-400">Has not responded yet. Due {s.due}.</p>;
  }
  const st = onboardingStructure(s);
  let n = 0;
  return (
    <div className="space-y-5 pt-3">
      <div className="grid grid-cols-3 gap-3">
        <div><div className={label}>Overall</div><div className="text-lg font-bold">{one(surveyScore(s))}<span className="text-xs font-normal text-ink-400">/10</span></div></div>
        <div><div className={label}>Process (Q1–Q{st.hrBlockStart})</div><div className="text-lg font-bold">{one(avg(s.answers.slice(0, st.hrBlockStart)))}</div></div>
        <div><div className={label}>HR team (Q{st.hrBlockStart + 1}–Q{s.answers.length})</div><div className="text-lg font-bold">{st.hrBlockStart < s.answers.length ? one(avg(s.answers.slice(st.hrBlockStart))) : "—"}</div></div>
      </div>

      {st.sections.map((sec) => (
        <div key={sec.section}>
          <div className={`${label} mb-2`}>{sec.section}</div>
          <ol className="space-y-3">
            {sec.questions.map((q) => {
              const i = n++;
              const v = s.answers[i];
              return (
                <li key={q.text}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] text-ink-700 dark:text-ink-200"><span className="mr-1.5 font-secondary text-ink-400">Q{i + 1}.</span>{q.text}</p>
                    <span className={`shrink-0 text-sm font-bold ${v < 7 ? "text-red-500" : ""}`}>{v ?? "—"}<span className="text-[10px] font-normal text-ink-400">/10</span></span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-ink-100 dark:bg-ink-800">
                    <div className={`h-full ${v < 7 ? "bg-red-400" : "bg-primary"}`} style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      {st.textQuestion && (
        <div>
          <div className={`${label} mb-2`}>Open question</div>
          <p className="text-[13px] text-ink-700 dark:text-ink-200"><span className="mr-1.5 font-secondary text-ink-400">Q{s.answers.length + 1}.</span>{st.textQuestion}</p>
          <p className="mt-1.5 border-l-2 border-ink-200 pl-3 text-[13px] dark:border-white/15">{s.feedback ? s.feedback : <span className="text-ink-400">No comment given.</span>}</p>
        </div>
      )}
    </div>
  );
}

/** Everyone a survey was sent to, with their questions and answers one click away */
function SentTo({ list, openId, onOpen }) {
  // those still to respond first
  const rows = [...list].sort((a, b) => (a.status === "submitted") - (b.status === "submitted") || a.employee.localeCompare(b.employee));
  return (
    <ul className="divide-y divide-ink-100 border border-ink-200 dark:divide-white/10 dark:border-white/10">
      {rows.map((s) => {
        const open = openId === s.id;
        const done = s.status === "submitted";
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(open ? null : s.id)} aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-white/[0.04]">
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.employee}</span>
                <span className="block truncate text-[11px] text-ink-500 dark:text-ink-400">{s.dept} · joined {s.joined} · sent {s.sentOn} · due {s.due}</span>
              </span>
              {done && <span className="text-sm font-bold">{one(surveyScore(s))}<span className="text-[10px] font-normal text-ink-400">/10</span></span>}
              {done ? <Pill tone="done">Responded</Pill> : <Pill tone="open">Waiting</Pill>}
            </button>
            {open && <div className="border-t border-ink-100 bg-ink-50/50 px-4 pb-4 dark:border-white/10 dark:bg-white/[0.02]"><Answers s={s} /></div>}
          </li>
        );
      })}
    </ul>
  );
}

export default function OnboardingAdmin({ surveys = [], notifyTo = "admin@tapmind.com, hr@tapmind.com" }) {
  const submitted = surveys.filter((s) => s.status === "submitted");
  // what the side panel shows: { title, list, openId }
  const [panel, setPanel] = useState(null);

  const depts = useMemo(() => {
    const map = {};
    surveys.forEach((s) => {
      map[s.dept] = map[s.dept] || { sent: 0, responded: 0, scores: [] };
      map[s.dept].sent++;
      if (s.status === "submitted") {
        map[s.dept].responded++;
        map[s.dept].scores.push(surveyScore(s));
      }
    });
    return Object.entries(map).map(([dept, d]) => ({
      dept, ...d, avg: avg(d.scores), low: d.scores.filter((x) => x < 6).length,
    }));
  }, [surveys]);

  const rated = depts.filter((d) => d.scores.length);
  const best = rated.length ? rated.reduce((a, b) => (a.avg > b.avg ? a : b)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (a.avg < b.avg ? a : b)) : null;
  const latest = submitted[0];
  const latestSt = onboardingStructure(latest);

  const openDept = (dept) => {
    const list = surveys.filter((s) => s.dept === dept);
    setPanel({ title: dept, list, openId: list.length === 1 ? list[0].id : null });
  };
  const openAll = () => setPanel({ title: "Everyone it was sent to", list: surveys, openId: null });
  const openLatest = () => setPanel({ title: latest.dept, list: surveys.filter((s) => s.dept === latest.dept), openId: latest.id });

  const waiting = panel ? panel.list.filter((s) => s.status !== "submitted").length : 0;

  return (
    <Screen id="1.6" title="Admin — onboarding health" sub="Read-only oversight across the org">
      <Cards>
        <CardStat hero label="Org average" value={submitted.length ? one(avg(submitted.map(surveyScore))) : "—"} unit="/10" note={`${submitted.length} responses`} />
        <CardStat label="Response rate" value={pct(submitted.length, surveys.length)} unit="%" />
        <CardStat label="Lowest dept" value={worst ? one(worst.avg) : "—"} note={worst ? `${worst.dept} (n=${worst.scores.length})` : ""} />
        <CardStat label="Highest dept" value={best ? one(best.avg) : "—"} note={best ? `${best.dept} (n=${best.scores.length})` : ""} />
      </Cards>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Section>Department breakdown</Section>
        {surveys.length > 0 && (
          <button type="button" onClick={openAll} className="text-xs font-bold uppercase tracking-wide text-primary hover:underline">See everyone it was sent to</button>
        )}
      </div>
      <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">Click a department to see whom the survey was sent to, and their questions and answers.</p>
      <table className="w-full text-sm">
        <THead cols={["Department", "Sent", "Responded", "Avg", "Below 6", ""]} />
        <tbody>
          {depts.map((d) => (
            <tr key={d.dept} tabIndex={0} role="button" onClick={() => openDept(d.dept)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDept(d.dept)}
              className="cursor-pointer border-b border-ink-100 last:border-0 hover:bg-ink-50 focus:bg-ink-50 focus:outline-none dark:border-white/10 dark:hover:bg-white/[0.04] dark:focus:bg-white/[0.04]">
              <td className="py-3">{d.dept}</td>
              <td className="py-3">{d.sent}</td>
              <td className="py-3">{d.responded}</td>
              <td className="py-3 font-semibold">
                {d.scores.length ? one(d.avg) : <span className="font-normal text-ink-400">—</span>}
              </td>
              <td className="py-3">{d.low}</td>
              <td className="py-3 text-right text-ink-400"><ChevronRight size={16} className="ml-auto" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section>Notification received</Section>
      {latest ? (
        <div role="button" tabIndex={0} onClick={openLatest} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openLatest()}
          className="cursor-pointer focus:outline-none" aria-label="Open this survey's questions and answers">
          <EmailPreview
            to={notifyTo}
            subject={`Onboarding Experience Survey submitted — ${latest.employee}`}
            body={`${latest.employee} (${latest.dept}, joined ${latest.joined}) submitted the Onboarding Experience Survey. Overall ${one(surveyScore(latest))}/10 — process block ${one(avg(latest.answers.slice(0, latestSt.hrBlockStart)))}, HR team block ${latestSt.hrBlockStart < latest.answers.length ? one(avg(latest.answers.slice(latestSt.hrBlockStart))) : "—"}. Lowest rated: ${latestSt.short[latest.answers.indexOf(Math.min(...latest.answers))]} (${Math.min(...latest.answers)}/10).`}
          />
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Click to see who it was sent to and the questions and answers.</p>
        </div>
      ) : <Empty>No submissions yet.</Empty>}

      <Drawer isOpen={!!panel} onOpenChange={(o) => !o && setPanel(null)} placement="right" size="2xl">
        <DrawerContent>
          {() => panel && (
            <>
              <DrawerHeader className="flex flex-col gap-0.5">
                <span className="text-lg font-semibold">{panel.title}</span>
                <span className="text-xs font-normal text-ink-500 dark:text-ink-400">
                  Sent to {panel.list.length} {panel.list.length === 1 ? "person" : "people"} · {panel.list.length - waiting} responded · {waiting} waiting
                </span>
              </DrawerHeader>
              <DrawerBody className="pb-6">
                <SentTo list={panel.list} openId={panel.openId} onOpen={(id) => setPanel((p) => ({ ...p, openId: id }))} />
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </Screen>
  );
}
