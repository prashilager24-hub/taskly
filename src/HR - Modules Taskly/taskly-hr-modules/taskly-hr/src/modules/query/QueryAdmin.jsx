import {
  Screen, Section, Cards, CardStat, Distribution, QuestionAverages, Empty, THead,
} from "../../components/ui";
import { QUERY_SHORT } from "../../lib/questions";
import { avg, one, queryScore } from "../../lib/metrics";

export default function QueryAdmin({ queries = [], admin = {}, slaHours = 72 }) {
  const hasAdmin = admin && Array.isArray(admin.byTeam) && admin.byTeam.length > 0;

  const rated = queries.filter((q) => q.ratings.length);
  const lowRated = rated.filter((q) => queryScore(q) < 6);

  const byTeam = ["HR", "L&D"].map((t) => {
    if (hasAdmin) {
      const row = admin.byTeam.find((b) => b.team === t);
      return {
        team: t,
        raised: row?.raised ?? 0,
        resolved: row?.resolved ?? 0,
        avg: row?.avg ?? null,
        low: row?.below6 ?? 0,
        n: row?.avg != null ? 1 : 0,
      };
    }
    const qs = queries.filter((q) => q.team === t);
    const rs = qs.filter((q) => q.ratings.length);
    return {
      team: t,
      raised: qs.length,
      resolved: qs.filter((q) => q.status === "resolved" || q.status === "closed").length,
      avg: avg(rs.map(queryScore)),
      low: rs.filter((q) => queryScore(q) < 6).length,
      n: rs.length,
    };
  });

  const avgScore = hasAdmin ? (Number(admin.avgSupportScore) ?? null) : (rated.length ? avg(rated.map(queryScore)) : null);
  const surveyCount = hasAdmin
    ? (Number(admin.surveysCompleted) || (Array.isArray(admin.distribution) ? admin.distribution.reduce((a, b) => a + (Number(b) || 0), 0) : 0))
    : rated.length;
  const totalOpen = hasAdmin ? (admin.totalOpen ?? 0) : queries.filter((q) => q.status === "open" || q.status === "in_progress").length;

  const lowList = hasAdmin ? (admin.lowScoring || []) : lowRated;
  const distCounts = hasAdmin && Array.isArray(admin.distribution) ? admin.distribution.map(Number) : null;
  const qAvgs = hasAdmin && Array.isArray(admin.questionAverages) ? admin.questionAverages.map(Number) : null;

  return (
    <Screen id="2.6" title="Admin — query & support oversight" sub="All queries across both teams, with survey results">
      <Cards>
        <CardStat hero label="Avg support score" value={avgScore != null ? one(avgScore) : "—"} unit="/10" note={`${surveyCount} surveys`} />
        <CardStat label="Queries raised" value={hasAdmin ? (admin.totalRaised ?? 0) : queries.length} note="Last 90 days" />
        <CardStat label="Resolved" value={hasAdmin ? (admin.totalResolved ?? 0) : queries.filter((q) => q.status === "resolved" || q.status === "closed").length} note={`${totalOpen} open`} />
        <CardStat label="SLA breached" value={hasAdmin ? (admin.slaBreached ?? 0) : queries.filter((q) => q.ageHrs > slaHours).length} note={`Over ${slaHours}h`} />
        <CardStat label="Scores below 6" value={hasAdmin ? (admin.scoresBelow6 ?? 0) : lowRated.length} note="Needs review" />
      </Cards>

      <Section>Average by survey question</Section>
      <QuestionAverages labels={QUERY_SHORT} rows={rated.map((q) => q.ratings)} averages={qAvgs} />

      <Section>HR vs L&amp;D</Section>
      <table className="w-full text-sm">
        <THead cols={["Team", "Raised", "Resolved", "Avg score", "Below 6"]} />
        <tbody>
          {byTeam.map((t) => (
            <tr key={t.team} className="border-b border-gray-100 last:border-0">
              <td className="py-3">{t.team}</td>
              <td className="py-3">{t.raised}</td>
              <td className="py-3">{t.resolved}</td>
              <td className="py-3 font-semibold">
                {t.n ? one(t.avg) : <span className="text-gray-400 font-normal">—</span>}
              </td>
              <td className="py-3">{t.low}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section>Score distribution</Section>
      <Distribution values={rated.flatMap((q) => q.ratings)} counts={distCounts} />

      <Section>Low-scoring surveys</Section>
      {lowList.length ? (
        <table className="w-full text-sm">
          <THead cols={["ID", "Team", "Subject", "Avg", "Weakest", "Comment"]} />
          <tbody>
            {lowList.map((q) => {
              const score = hasAdmin ? q.avg : (q.supportScore ?? queryScore(q));
              const weakest = hasAdmin ? q.weakest : QUERY_SHORT[q.ratings.indexOf(Math.min(...q.ratings))];
              const comment = hasAdmin ? q.comment : q.ratingComment;
              return (
                <tr key={q.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 text-gray-500 font-mono text-xs">{q.id}</td>
                  <td className="py-3">{q.team}</td>
                  <td className="py-3 text-[13px]">{q.subject}</td>
                  <td className="py-3 font-semibold text-red-600">{one(score)}</td>
                  <td className="py-3 text-[13px] text-gray-600">{weakest}</td>
                  <td className="py-3 text-[13px] text-gray-500">{comment}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <Empty>No low-scoring surveys.</Empty>}
    </Screen>
  );
}