import { useMemo } from "react";
import {
  Screen, Section, Cards, CardStat, EmailPreview, Empty, THead,
} from "../../components/ui";
import { ONB_SHORT, ONB_HR_BLOCK_START } from "../../lib/questions";
import { avg, one, pct, surveyScore } from "../../lib/metrics";

export default function OnboardingAdmin({ surveys = [], notifyTo = "admin@tapmind.com, hr@tapmind.com" }) {
  const submitted = surveys.filter((s) => s.status === "submitted");

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

  return (
    <Screen id="1.6" title="Admin — onboarding health" sub="Read-only oversight across the org">
      <Cards>
        <CardStat hero label="Org average" value={submitted.length ? one(avg(submitted.map(surveyScore))) : "—"} unit="/10" note={`${submitted.length} responses`} />
        <CardStat label="Response rate" value={pct(submitted.length, surveys.length)} unit="%" />
        <CardStat label="Lowest dept" value={worst ? one(worst.avg) : "—"} note={worst ? `${worst.dept} (n=${worst.scores.length})` : ""} />
        <CardStat label="Highest dept" value={best ? one(best.avg) : "—"} note={best ? `${best.dept} (n=${best.scores.length})` : ""} />
      </Cards>

      <Section>Department breakdown</Section>
      <table className="w-full text-sm">
        <THead cols={["Department", "Sent", "Responded", "Avg", "Below 6"]} />
        <tbody>
          {depts.map((d) => (
            <tr key={d.dept} className="border-b border-ink-100 dark:border-white/10 last:border-0">
              <td className="py-3">{d.dept}</td>
              <td className="py-3">{d.sent}</td>
              <td className="py-3">{d.responded}</td>
              <td className="py-3 font-semibold">
                {d.scores.length ? one(d.avg) : <span className="text-ink-400 font-normal">—</span>}
              </td>
              <td className="py-3">{d.low}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section>Notification received</Section>
      {latest ? (
        <EmailPreview
          to={notifyTo}
          subject={`Onboarding Experience Survey submitted — ${latest.employee}`}
          body={`${latest.employee} (${latest.dept}, joined ${latest.joined}) submitted the Onboarding Experience Survey. Overall ${one(surveyScore(latest))}/10 — process block ${one(avg(latest.answers.slice(0, ONB_HR_BLOCK_START)))}, HR team block ${one(avg(latest.answers.slice(ONB_HR_BLOCK_START)))}. Lowest rated: ${ONB_SHORT[latest.answers.indexOf(Math.min(...latest.answers))]} (${Math.min(...latest.answers)}/10).`}
        />
      ) : <Empty>No submissions yet.</Empty>}
    </Screen>
  );
}
