import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Textarea } from "../../../../../../components/ui";
import {
  Screen, Field, BackLink, Scale, ScaleLegend, Section,
  Pill, Empty, ContextBar, CardStat, Cards, THead,
} from "../../components/ui";
import { onboardingStructure } from "../../lib/surveyStructure";
import { one, surveyScore } from "../../lib/metrics";

export default function OnboardingEmployee({ surveys = [], onSubmit, currentUser }) {
  const mine = surveys.filter((s) => s.employee === currentUser.name);
  const [openId, setOpenId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState("");

  const active = mine.find((s) => s.id === openId);
  const st = active ? onboardingStructure(active) : null;
  const complete = !!st && st.questions.every((_, i) => answers[i]) && (!st.textQuestion || feedback.trim().length > 0);

  const reset = () => { setOpenId(null); setAnswers({}); setFeedback(""); };

  if (active) {
    let qNo = 0;
    return (
      <Screen id="1.2" title={st.name} sub="For new joiners after induction / onboarding">
        <BackLink onClick={reset}>Back to my surveys</BackLink>
        <ContextBar
          title={st.name}
          meta={`${active.employee} · ${active.dept} · Joined ${active.joined} · Due ${active.due}`}
        />
        <ScaleLegend />

        {st.sections.map((sec) => (
          <div key={sec.section}>
            <Section>{sec.section}</Section>
            {sec.questions.map((q) => {
              const idx = qNo++;
              return (
                <Field key={idx} label={`${idx + 1}. ${q.text}`}>
                  <Scale value={answers[idx]} onChange={(n) => setAnswers({ ...answers, [idx]: n })} />
                </Field>
              );
            })}
          </div>
        ))}

        {st.textQuestion && (
          <>
            <Section>Open feedback</Section>
            <Field label={`${st.ratingCount + 1}. ${st.textQuestion}`}>
              <Textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Type your answer…"
                variant="bordered"
              />
            </Field>
          </>
        )}

        <div className="flex gap-2.5 mt-4">
          <Button
            size="sm"
            color="primary"
            className="text-white"
            isDisabled={!complete}
            onPress={() => {
              onSubmit(active.id, st.questions.map((_, i) => answers[i]), feedback);
              reset();
            }}
            startContent={<Send size={14} />}
          >
            Submit survey
          </Button>
          {/* <Button size="sm" variant="flat" onPress={reset}>Save draft</Button> */}
        </div>
        {!complete && <div className="text-[11px] text-ink-400 mt-2">All {st.ratingCount} ratings{st.textQuestion ? ` and Q${st.ratingCount + 1}` : ""} are required.</div>}
      </Screen>
    );
  }

  return (
    <Screen id="1.1" title="My Surveys" sub="Reached from the email link or the Taskly sidebar">
      <table className="w-full text-sm">
        <THead cols={["Survey", "Sent", "Due", "Status", ""]} />
        <tbody>
          {mine.map((s) => (
            <tr key={s.id} className="border-b border-ink-100 dark:border-white/10 last:border-0">
              <td className="py-3">{(s.template && s.template.name) || "Onboarding Experience Survey"}</td>
              <td className="py-3 text-ink-500 dark:text-ink-400 text-[13px]">{s.sentOn}</td>
              <td className="py-3 text-ink-500 dark:text-ink-400 text-[13px]">{s.due}</td>
              <td className="py-3">
                {s.status === "pending"
                  ? <Pill tone="open">Pending</Pill>
                  : <Pill tone="done">Submitted · {one(surveyScore(s))}</Pill>}
              </td>
              <td className="py-3 text-right">
                {s.status === "pending" && (
                  <Button size="sm" color="primary" className="text-white" onPress={() => setOpenId(s.id)}>
                    Start
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {mine.length === 0 && (
            <tr><td colSpan={5} className="py-6"><Empty>No surveys assigned to you.</Empty></td></tr>
          )}
        </tbody>
      </table>
    </Screen>
  );
}
