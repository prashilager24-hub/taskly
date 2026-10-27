import {
  Screen, Section, Cards, CardStat, EmailPreview, Empty, THead,
} from "../../components/ui";
import { avg, one, pct, respValues, engAvg } from "../../lib/metrics";

export default function EngagementAdmin({ surveys = [], notifyTo = "admin@tapmind.com, hr@tapmind.com" }) {
  const withResp = surveys.filter((s) => s.responses.length);
  const latest = surveys[0];

  const weakestMonth = () => {
    if (!latest || !latest.responses.length) return "—";
    const monthAvgs = latest.months.map((_, i) => avg(latest.responses.map((r) => r.months[i])));
    return latest.months[monthAvgs.indexOf(Math.min(...monthAvgs))];
  };

  const detractorPct =
    latest && latest.responses.length
      ? pct(latest.responses.filter((r) => avg(respValues(r)) <= 5).length, latest.responses.length)
      : 0;

  return (
    <Screen id="3.5" title="Admin — engagement performance" sub="Roll-up across quarters">
      <Cards>
        <CardStat hero label="Latest quarter" value={latest && latest.responses.length ? one(engAvg(latest)) : "—"} unit="/10" note={latest?.quarter} />
        <CardStat label="Avg across quarters" value={withResp.length ? one(avg(withResp.map(engAvg))) : "—"} unit="/10" note={`${surveys.length} quarters`} />
        <CardStat label="Avg response rate" value={Math.round(avg(surveys.map((s) => (s.responses.length / s.sentTo) * 100)))} unit="%" note="Target 75%" />
        <CardStat label="Detractors" value={detractorPct} unit="%" note="Scored 5 or below" />
      </Cards>

      <Section>Quarter-on-quarter</Section>
      <table className="w-full text-sm">
        <THead cols={["Quarter", "Responses", "Rate", "Activities", "Planning", "Approachability"]} />
        <tbody>
          {surveys.map((s) => (
            <tr key={s.id} className="border-b border-gray-100 last:border-0">
              <td className="py-3">{s.quarter}</td>
              <td className="py-3">{s.responses.length}</td>
              <td className="py-3">{pct(s.responses.length, s.sentTo)}%</td>
              <td className="py-3 font-semibold">
                {s.responses.length ? one(avg(s.responses.flatMap((r) => r.months))) : "—"}
              </td>
              <td className="py-3 font-semibold">
                {s.responses.length ? one(avg(s.responses.map((r) => r.rest[0]))) : "—"}
              </td>
              <td className="py-3 font-semibold">
                {s.responses.length ? one(avg(s.responses.map((r) => r.rest[1]))) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section>Notification received</Section>
      {latest && latest.responses.length ? (
        <EmailPreview
          to={notifyTo}
          subject={`Engagement Survey — ${latest.quarter} (${latest.responses.length} responses)`}
          body={`Average ${one(engAvg(latest))}/10 from ${latest.responses.length} of ${latest.sentTo} employees. Weakest month: ${weakestMonth()}. ${latest.responses.filter((r) => r.feedback).length} written comments received. View the full breakdown in Taskly.`}
        />
      ) : <Empty>No responses yet.</Empty>}
    </Screen>
  );
}
