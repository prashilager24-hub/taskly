import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import {
  Button, Input, Select, SelectItem, Textarea, Chip, addToast,
  Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader,
} from "../../../../../../components/ui";
import * as api from "../../lib/api";

const label = "text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400";

const KINDS = {
  RATING: "Rating (1 to 10)",
  MONTHLY: "Monthly rating (once for each month)",
  TEXT: "Open question (written answer)",
};

const blank = (kind) => ({
  name: "",
  description: "",
  questions: kind === "ONBOARDING"
    ? [{ section: "Overall Onboarding Experience", text: "", short: "", kind: "RATING" }, { section: null, text: "", short: "", kind: "TEXT" }]
    : [{ section: null, text: "", short: "", kind: "MONTHLY" }, { section: null, text: "", short: "", kind: "RATING" }, { section: null, text: "", short: "", kind: "TEXT" }],
});

const problem = (kind, t) => {
  if (!t.name.trim()) return "Give the template a name.";
  const q = t.questions;
  if (!q.some((x) => x.kind === "RATING" || x.kind === "MONTHLY")) return "Add at least one rating question.";
  const empty = q.findIndex((x) => !x.text.trim());
  if (empty >= 0) return `Question ${empty + 1} has no text.`;
  if (q.filter((x) => x.kind === "TEXT").length > 1) return "A survey can have only one open question.";
  if (q.filter((x) => x.kind === "MONTHLY").length > 1) return "Only one monthly question is allowed.";
  return "";
};

/**
 * The questions of the Onboarding Experience or Employee Engagement survey, as templates: HR adds new ones, edits
 * them, picks the default and turns them off. A survey keeps the questions it was sent with, so editing here never
 * changes surveys already sent.
 */
export default function SurveyTemplates({ kind, isOpen, onClose, onChanged }) {
  const noun = kind === "ONBOARDING" ? "Onboarding Experience" : "Employee Engagement";
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null); // the template being added or edited
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await api.fetchTemplates(kind, true)); }
    catch (e) { addToast({ title: "Could not load templates", description: e?.response?.data?.message ?? "Please try again", color: "danger" }); }
    finally { setLoading(false); }
  }, [kind]);

  useEffect(() => { if (isOpen) { setDraft(null); load(); } }, [isOpen, load]);

  const edit = async (id, copy = false) => {
    try {
      const t = await api.fetchTemplate(id);
      setDraft({
        id: copy ? undefined : t.id,
        name: copy ? `Copy of ${t.name}` : t.name,
        description: t.description || "",
        questions: t.questions.map((q) => ({ section: q.section, text: q.text, short: q.short || "", kind: q.kind })),
      });
    } catch (e) { addToast({ title: "Could not open the template", color: "danger" }); }
  };

  const act = async (fn, done) => {
    try { await fn(); addToast({ title: done, color: "success" }); await load(); onChanged && onChanged(); }
    catch (e) { addToast({ title: "Could not change the template", description: e?.response?.data?.message ?? "Please try again", color: "danger" }); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveTemplate({ kind, ...draft, questions: draft.questions.map((q) => ({ ...q, short: q.short || null, section: kind === "ONBOARDING" ? (q.section || null) : null })) });
      addToast({ title: draft.id ? "Template updated" : "Template added", description: draft.name, color: "success" });
      setDraft(null);
      await load();
      onChanged && onChanged();
    } catch (e) {
      addToast({ title: "Could not save the template", description: e?.response?.data?.message ?? "Please try again", color: "danger" });
    } finally { setSaving(false); }
  };

  const setQ = (i, patch) => setDraft((d) => ({ ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const move = (i, by) => setDraft((d) => {
    const q = [...d.questions]; const j = i + by;
    if (j < 0 || j >= q.length) return d;
    [q[i], q[j]] = [q[j], q[i]];
    return { ...d, questions: q };
  });
  const remove = (i) => setDraft((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }));
  const add = (k) => setDraft((d) => {
    const last = [...d.questions].reverse().find((q) => q.section);
    const q = { section: k === "RATING" && kind === "ONBOARDING" ? (last ? last.section : "") : null, text: "", short: "", kind: k };
    // the open question stays last
    const text = d.questions.findIndex((x) => x.kind === "TEXT");
    const list = [...d.questions];
    if (text >= 0 && k !== "TEXT") list.splice(text, 0, q); else list.push(q);
    return { ...d, questions: list };
  });

  const sections = [...new Set((draft?.questions || []).map((q) => q.section).filter(Boolean))];
  const hasText = (draft?.questions || []).some((q) => q.kind === "TEXT");
  const hasMonthly = (draft?.questions || []).some((q) => q.kind === "MONTHLY");
  const issue = draft ? problem(kind, draft) : "";
  const ratingNo = (i) => draft.questions.slice(0, i + 1).length;

  return (
    <Drawer isOpen={isOpen} onOpenChange={(o) => !o && onClose()} placement="right" size="2xl">
      <DrawerContent>
        {() => (
          <>
            <DrawerHeader className="flex flex-col gap-0.5">
              <span className="text-lg font-semibold">{draft ? (draft.id ? "Edit template" : "New template") : `${noun} templates`}</span>
              <span className="text-xs font-normal text-ink-500 dark:text-ink-400">
                {draft ? "Surveys already sent keep the questions they were sent with" : "The questions each survey is sent with; one of them is the default"}
              </span>
            </DrawerHeader>

            <DrawerBody className="gap-4">
              {!draft && (
                <>
                  {loading && <p className="py-6 text-center text-sm text-ink-500">Loading templates…</p>}
                  {templates.map((t) => (
                    <div key={t.id} className={`border p-4 ${t.active ? "border-ink-200 dark:border-white/10" : "border-dashed border-ink-300 opacity-70 dark:border-white/15"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{t.name}</span>
                            {t.isDefault && <Chip size="sm" color="primary" variant="flat">Default</Chip>}
                            {!t.active && <Chip size="sm" variant="flat">Off</Chip>}
                          </div>
                          {t.description && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{t.description}</p>}
                          <p className="mt-1 text-[11px] text-ink-400">{t.questionCount} questions</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="bordered" onPress={() => edit(t.id)}>Edit</Button>
                          <Button size="sm" variant="bordered" isIconOnly aria-label="Copy template" onPress={() => edit(t.id, true)}><Copy size={13} /></Button>
                          {!t.isDefault && t.active && <Button size="sm" variant="bordered" onPress={() => act(() => api.setTemplateDefault(t.id), "Default changed")}>Make default</Button>}
                          {!t.isDefault && (
                            <Button size="sm" variant="bordered" onPress={() => act(() => api.setTemplateActive(t.id, !t.active), t.active ? "Template turned off" : "Template turned on")}>
                              {t.active ? "Turn off" : "Turn on"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loading && templates.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No templates yet.</p>}
                </>
              )}

              {draft && (
                <>
                  <Input label="Template name" labelPlacement="outside" placeholder={`${noun} Survey — new joiners`} value={draft.name} onValueChange={(v) => setDraft({ ...draft, name: v })} isRequired variant="bordered" />
                  <Input label="Description (optional)" labelPlacement="outside" placeholder="Who it is for" value={draft.description} onValueChange={(v) => setDraft({ ...draft, description: v })} variant="bordered" />

                  <div className="space-y-3">
                    {draft.questions.map((q, i) => (
                      <div key={i} className="border border-ink-200 p-3 dark:border-white/10">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className={label}>Question {ratingNo(i)}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="light" isIconOnly aria-label="Move up" isDisabled={i === 0} onPress={() => move(i, -1)}><ArrowUp size={14} /></Button>
                            <Button size="sm" variant="light" isIconOnly aria-label="Move down" isDisabled={i === draft.questions.length - 1} onPress={() => move(i, 1)}><ArrowDown size={14} /></Button>
                            <Button size="sm" variant="light" color="danger" isIconOnly aria-label="Remove question" isDisabled={draft.questions.length <= 1} onPress={() => remove(i)}><Trash2 size={14} /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Select size="sm" variant="bordered" label="Type" selectedKeys={[q.kind]} disallowEmptySelection
                            onSelectionChange={(k) => setQ(i, { kind: Array.from(k)[0] })}>
                            {Object.entries(KINDS)
                              .filter(([k]) => k !== "MONTHLY" || kind === "ENGAGEMENT")
                              .map(([k, v]) => <SelectItem key={k} isDisabled={(k === "TEXT" && hasText && q.kind !== "TEXT") || (k === "MONTHLY" && hasMonthly && q.kind !== "MONTHLY")}>{v}</SelectItem>)}
                          </Select>
                          {kind === "ONBOARDING" && q.kind === "RATING" && (
                            <Input size="sm" variant="bordered" label="Section" placeholder="e.g. HR Team Experience" value={q.section || ""} onValueChange={(v) => setQ(i, { section: v })}
                              list="survey-sections" />
                          )}
                        </div>
                        <Textarea className="mt-3" variant="bordered" minRows={2} label="Question" value={q.text} onValueChange={(v) => setQ(i, { text: v })} isRequired />
                        {q.kind !== "TEXT" && (
                          <Input className="mt-3" size="sm" variant="bordered" label="Short label (for charts)" placeholder="A few words" value={q.short} onValueChange={(v) => setQ(i, { short: v })} maxLength={60} />
                        )}
                      </div>
                    ))}
                    <datalist id="survey-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="bordered" startContent={<Plus size={14} />} onPress={() => add("RATING")}>Rating question</Button>
                    {!hasText && <Button size="sm" variant="bordered" startContent={<Plus size={14} />} onPress={() => add("TEXT")}>Open question</Button>}
                    {kind === "ENGAGEMENT" && !hasMonthly && <Button size="sm" variant="bordered" startContent={<Plus size={14} />} onPress={() => add("MONTHLY")}>Monthly question</Button>}
                  </div>
                  {issue && <p className="text-xs text-danger">{issue}</p>}
                </>
              )}
            </DrawerBody>

            <DrawerFooter>
              {draft ? (
                <>
                  <Button size="sm" color="primary" className="text-white" isDisabled={!!issue} isLoading={saving} onPress={save}>{draft.id ? "Save changes" : "Add template"}</Button>
                  <Button size="sm" variant="flat" onPress={() => setDraft(null)}>Back to templates</Button>
                </>
              ) : (
                <>
                  <Button size="sm" color="primary" className="text-white" startContent={<Plus size={14} />} onPress={() => setDraft(blank(kind))}>New template</Button>
                  <Button size="sm" variant="flat" onPress={onClose}>Close</Button>
                </>
              )}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
