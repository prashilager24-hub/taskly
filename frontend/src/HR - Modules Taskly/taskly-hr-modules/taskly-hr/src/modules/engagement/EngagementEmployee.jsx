import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Button, Textarea, Switch, Card, CardBody } from "../../../../../../components/ui";
import {
  Screen, Field, BackLink, Scale, ScaleLegend, Section,
  Pill, Empty, ContextBar,
} from "../../components/ui";
import { engagementStructure } from "../../lib/surveyStructure";

export default function EngagementEmployee({
  surveys = [], currentUser, anonymousDefault = true, onSubmit,
}) {
  const open = surveys.filter((s) => s.status === "collecting");
  const [openId, setOpenId] = useState(null);
  const [months, setMonths] = useState({});
  const [rest, setRest] = useState({});
  const [feedback, setFeedback] = useState("");
  const [anon, setAnon] = useState(anonymousDefault);

  const active = open.find((s) => s.id === openId);
  const st = active ? engagementStructure(active) : null;
  const done = active && (active.submitted || (active.responses || []).some((r) => r.by === currentUser.name));
  const complete =
    active &&
    (active.months || []).every((_, i) => months[i]) &&
    st.rest.every((_, i) => rest[i]) &&
    (!st.textQuestion || feedback.trim().length > 0);

  const reset = () => { setOpenId(null); setMonths({}); setRest({}); setFeedback(""); };

  if (active) {
    return (
      <Screen id="3.1" title={st.name} sub="Quarterly, for all employees">
        <BackLink onClick={reset} />
        <ContextBar title={active.quarter} meta={`Organised by HR · Feedback open till ${active.closes}`} />

        {done ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
            <CheckCircle2 size={16} /> You have already submitted this quarter's survey.
          </div>
        ) : (
          <>
            <ScaleLegend />

            <Section>1. Activity rating — this quarter</Section>
            <div className="text-xs text-ink-600 dark:text-ink-300 mb-3">{st.monthlyQuestion}</div>
            {active.months ? active.months.map((m, i) => (
              <Field key={m} label={`Month ${i + 1}: ${m}`}>
                <Scale compact value={months[i]} onChange={(n) => setMonths({ ...months, [i]: n })} />
              </Field>
            )) : null}

            <Section>HR planning &amp; responsiveness</Section>
            {st.rest.map((q, i) => (
              <Field key={i} label={`${i + 2}. ${q.text}`}>
                <Scale value={rest[i]} onChange={(n) => setRest({ ...rest, [i]: n })} />
              </Field>
            ))}

            {st.textQuestion && (
              <>
                <Section>Open feedback</Section>
                <Field label={`${st.rest.length + 2}. ${st.textQuestion}`}>
                  <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Type your answer…" variant="bordered" />
                </Field>
              </>
            )}

            {/* <div className="flex items-center gap-3 mb-4">
              <Switch isSelected={anon} onValueChange={setAnon} size="sm" />
              <span className="text-sm text-ink-700 dark:text-ink-200">Submit anonymously</span>
            </div> */}

            <Button
              size="sm"
              color="primary"
              className="text-white"
              isDisabled={!complete}
              startContent={<Send size={14} />}
              onPress={() => {
                onSubmit(
                  active.id,
                  (active.months || []).map((_, i) => months[i]),
                  st.rest.map((_, i) => rest[i]),
                  feedback,
                  anon
                );
                reset();
              }}
            >
              Submit survey
            </Button>
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen id="3.0" title="Engagement surveys open for you" sub="Quarterly, voluntary, org-wide">
      {open.length ? (
        open.map((s) => (
          <Card key={s.id} shadow="none" className="border border-ink-200 dark:border-white/10 mb-2.5">
            <CardBody className="p-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-sm">{s.quarter}</div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{(s.months || []).join(" · ")} · Closes {s.closes}</div>
                </div>
                {(s.submitted || (s.responses || []).some((r) => r.by === currentUser.name))
                  ? <Pill tone="done">Submitted</Pill>
                  : <Button size="sm" color="primary" className="text-white" onPress={() => setOpenId(s.id)}>Take survey</Button>}
              </div>
            </CardBody>
          </Card>
        ))
      ) : <Empty>No engagement surveys open right now.</Empty>}
    </Screen>
  );
}
