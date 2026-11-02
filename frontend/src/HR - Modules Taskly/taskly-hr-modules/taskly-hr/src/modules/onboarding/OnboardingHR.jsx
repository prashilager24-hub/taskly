import { useState, useEffect } from "react";
import { Plus, Send, Search, X, ArrowLeft } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { Button, Input, Select, SelectItem, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "../../../../../../components/ui";
import * as api from "../../lib/api";
import {
  Screen, Field, Section, Pill, Cards, CardStat,
  Distribution, QuestionAverages, THead,
} from "../../components/ui";
import { onboardingStructure, dominantOnboarding } from "../../lib/surveyStructure";
import { hasModuleAccess } from "../../../../../../lib/permissions";
import SurveyTemplates from "../templates/SurveyTemplates";
import { avg, one, pct, surveyScore } from "../../lib/metrics";

export default function OnboardingHR({ surveys = [], notifyList = "", onSend }) {
  const [sending, setSending] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [dueDate, setDueDate] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("90");
  const [detailSurvey, setDetailSurvey] = useState(null);
  const detailSt = onboardingStructure(detailSurvey);
  const [managing, setManaging] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const canManageTemplates = hasModuleAccess("hr_onb_templates");

  const loadTemplates = () => api.fetchTemplates("ONBOARDING")
    .then((list) => { setTemplates(list); setTemplateId((cur) => (cur && list.some((t) => String(t.id) === cur) ? cur : String((list.find((t) => t.isDefault) || list[0] || {}).id || ""))); })
    .catch(() => setTemplates([]));
  useEffect(() => { if (sending) loadTemplates(); }, [sending]);

  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!sending) return;
    setLoadingUsers(true);
    api.fetchUsers()
      .then((users) => setAllUsers(users))
      .catch(() => setAllUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [sending]);

  // new joiners first, so they are the ones HR sends to
  const filteredUsers = allUsers
    .filter((u) => u.userName.toLowerCase().includes(userSearch.toLowerCase()))
    .sort((a, b) => Number(!!b.isNewJoiner) - Number(!!a.isNewJoiner));
  const cycleLabel = (c) => (c === "APRIL" ? "Apr cycle" : c === "OCTOBER" ? "Oct cycle" : "");
  const NewTag = ({ u }) => (u.isNewJoiner
    ? <span className="shrink-0 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700">New{u.joiningCycle ? ` · ${cycleLabel(u.joiningCycle)}` : ""}</span>
    : null);

  const toggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.userID === user.userID)
        ? prev.filter((u) => u.userID !== user.userID)
        : [...prev, user]
    );
  };

  const removeUser = (userID) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userID !== userID));
  };

  const submitted = surveys.filter((s) => s.status === "submitted");
  const scores = submitted.map(surveyScore);
  // each survey is split into its process and HR-team questions by its own template
  const processBlock = submitted.map((s) => avg(s.answers.slice(0, onboardingStructure(s).hrBlockStart)));
  const hrBlock = submitted.filter((s) => onboardingStructure(s).hrBlockStart < s.answers.length).map((s) => avg(s.answers.slice(onboardingStructure(s).hrBlockStart)));
  // surveys that share the most common set of questions line up in the "average by question" chart
  const common = dominantOnboarding(submitted);

  return (
    <>
      <Screen id="1.3" title="Onboarding Surveys — HR console" sub="Everything rolled out so far, and the entry point to send a new one">
        <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
          <div className="flex gap-2">
            <Select size="sm" variant="bordered" className="w-40" aria-label="Status filter" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(Array.from(k)[0])}>
              <SelectItem key="all">All statuses</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="submitted">Submitted</SelectItem>
            </Select>
            <Select size="sm" variant="bordered" className="w-44" aria-label="Date filter" selectedKeys={[dateFilter]} onSelectionChange={(k) => setDateFilter(Array.from(k)[0])}>
              <SelectItem key="90">Joined: last 90 days</SelectItem>
              <SelectItem key="30">Last 30 days</SelectItem>
            </Select>
          </div>
          <div className="flex gap-2">
            {canManageTemplates && <Button size="sm" variant="bordered" onPress={() => setManaging(true)}>Manage templates</Button>}
            <Button size="sm" color="primary" className="text-white" onPress={() => setSending(true)} startContent={<Plus size={14} />}>
              Send new survey
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <THead cols={["Employee", "Joined", "Sent", "Status", "Overall", "HR block"]} />
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id} className="border-b border-ink-100 dark:border-white/10 last:border-0 align-top hover:bg-ink-50 dark:hover:bg-ink-950 cursor-pointer transition-colors" onClick={() => s.status === "submitted" && setDetailSurvey(s)}>
                <td className="py-3">
                  <div>{s.employee}</div>
                  <div className="text-[11.5px] text-ink-500 dark:text-ink-400">{s.dept}</div>
                </td>
                <td className="py-3 text-ink-500 dark:text-ink-400 text-[13px]">{s.joined}</td>
                <td className="py-3 text-ink-500 dark:text-ink-400 text-[13px]">{s.sentOn}</td>
                <td className="py-3">
                  {s.status === "pending" && <Pill tone="open">Pending</Pill>}
                  {s.status === "submitted" && <Pill tone="done">Submitted</Pill>}
                  {s.status === "no_response" && <Pill tone="warn">No response</Pill>}
                </td>
                <td className="py-3 font-semibold">
                  {s.status === "submitted" ? one(surveyScore(s)) : <span className="text-ink-400 font-normal">—</span>}
                </td>
                <td className="py-3 font-semibold">
                  {s.status === "submitted"
                    ? (onboardingStructure(s).hrBlockStart < s.answers.length ? one(avg(s.answers.slice(onboardingStructure(s).hrBlockStart))) : "—")
                    : <span className="text-ink-400 font-normal">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Screen>

      {detailSurvey && (
        <Screen id="1.3.1" title={`Survey detail — ${detailSurvey.employee}`} sub={`Submitted on ${detailSurvey.sentOn}`}>
          <button
            onClick={() => setDetailSurvey(null)}
            className="text-xs text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-white mb-4 flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back to list
          </button>

          <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            <div className="space-y-1.5">
              <div className="text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400">Employee</div>
              <div className="text-sm font-semibold">{detailSurvey.employee}</div>
              <div className="text-[12px] text-ink-500 dark:text-ink-400">{detailSurvey.dept}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400">Joined</div>
              <div className="text-sm">{detailSurvey.joined}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400">Due</div>
              <div className="text-sm">{detailSurvey.due}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-secondary uppercase tracking-wider text-ink-500 dark:text-ink-400">Status</div>
              <div>{detailSurvey.status === "submitted" ? <Pill tone="done">Submitted</Pill> : <Pill tone="open">{detailSurvey.status}</Pill>}</div>
            </div>
          </div>

          <Cards>
            <CardStat hero label="Overall score" value={one(surveyScore(detailSurvey))} unit="/10" />
            <CardStat label={`Process block (Q1–Q${detailSt.hrBlockStart})`} value={one(avg(detailSurvey.answers.slice(0, detailSt.hrBlockStart)))} unit="/10" />
            {detailSt.hrBlockStart < detailSurvey.answers.length && <CardStat label={`HR team block (Q${detailSt.hrBlockStart + 1}–Q${detailSurvey.answers.length})`} value={one(avg(detailSurvey.answers.slice(detailSt.hrBlockStart)))} unit="/10" />}
          </Cards>

          <Section>Individual answers</Section>
          <div className="space-y-3">
            {detailSt.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-xs text-ink-600 dark:text-ink-300 flex-1 min-w-0" title={q}>
                  <span className="font-secondary text-ink-400 mr-1.5">Q{i + 1}.</span>
                  {q}
                </div>
                <div className="w-36 h-2 bg-ink-100 dark:bg-ink-800 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${detailSurvey.answers[i] < 7 ? "bg-red-400" : "bg-primary"}`}
                    style={{ width: `${(detailSurvey.answers[i] / 10) * 100}%` }}
                  />
                </div>
                <div className="w-9 text-right text-xs font-bold">{detailSurvey.answers[i]}</div>
              </div>
            ))}
          </div>

          {detailSurvey.feedback && (
            <>
              <Section>Open feedback</Section>
              <div className="border border-ink-200 dark:border-white/10 rounded p-3 flex gap-3">
                <div className="text-sm font-bold text-primary-600 w-8">{one(surveyScore(detailSurvey))}</div>
                <div>
                  <div className="text-[13px] text-ink-700 dark:text-ink-200">{detailSurvey.feedback}</div>
                  <div className="text-[11px] text-ink-400 mt-1">{detailSurvey.employee} · {detailSurvey.dept}</div>
                </div>
              </div>
            </>
          )}
        </Screen>
      )}

      <Drawer isOpen={sending} onOpenChange={(o) => !o && setSending(false)} placement="right" size="xl">
        <DrawerContent>
          {() => (
            <>
              <DrawerHeader className="flex flex-col gap-0.5">
                <span className="text-lg font-semibold">Send new survey</span>
                <span className="text-xs font-normal text-ink-500 dark:text-ink-400">Onboarding Experience Survey, to the new joiners you pick</span>
              </DrawerHeader>
              <DrawerBody className="gap-5">
              <Field label="Recipients (new joiners)">
                <div className="border border-ink-300 dark:border-white/15 rounded-md bg-white dark:bg-ink-900">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-ink-200 dark:border-white/10">
                    <Search size={14} className="text-ink-400 shrink-0" />
                    <input
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                      placeholder={loadingUsers ? "Loading users…" : "Search by name…"}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      disabled={loadingUsers}
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch("")} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2.5 py-1.5 border-b border-ink-100 dark:border-white/10">
                      {selectedUsers.map((u) => (
                        <Chip
                          key={u.userID}
                          size="sm"
                          variant="flat"
                          color="primary"
                          endContent={
                            <button onClick={() => removeUser(u.userID)} className="ml-0.5 text-primary-600 hover:text-primary-800">
                              <X size={12} />
                            </button>
                          }
                        >
                          {u.userName}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto">
                    {filteredUsers.length === 0 && !loadingUsers && (
                      <div className="px-3 py-2.5 text-xs text-ink-400">No users found.</div>
                    )}
                    {filteredUsers.map((u) => {
                      const selected = selectedUsers.some((s) => s.userID === u.userID);
                      return (
                        <button
                          key={u.userID}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-ink-50 dark:hover:bg-ink-950 ${selected ? "bg-primary-50" : ""}`}
                          onClick={() => toggleUser(u)}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-ink-300 dark:border-white/15"}`}>
                            {selected && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><span className="truncate">{u.userName}</span><NewTag u={u} /></div>
                            <div className="text-[11px] text-ink-400 truncate">{u.departmentName || u.userEmail}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedUsers.length > 0 && (
                  <div className="text-[11px] text-ink-400 mt-1">{selectedUsers.length} recipient{selectedUsers.length > 1 ? "s" : ""} selected</div>
                )}
              </Field>
              <Field label="Survey template">
                <Select variant="bordered" aria-label="Survey template" selectedKeys={templateId ? [templateId] : []} disallowEmptySelection
                  onSelectionChange={(k) => setTemplateId(String(Array.from(k)[0] ?? ""))}>
                  {templates.map((t) => <SelectItem key={String(t.id)} textValue={t.name}>{t.name}{t.isDefault ? " (default)" : ""} · {t.questionCount} questions</SelectItem>)}
                </Select>
              </Field>
              <Field label="Due date">
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="bordered" className="w-full justify-between">
                      {dueDate ? format(dueDate, "dd MMM yyyy") : <span className="text-ink-400">Pick a date</span>}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Due date picker" className="p-0" itemClasses={{ base: "p-0 cursor-default" }}>
                    <DropdownItem key="calendar">
                      <DayPicker
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        disabled={{ before: new Date() }}
                      />
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Field>
              <Field label="Notify on submission">
                <Input variant="bordered" defaultValue={notifyList} />
              </Field>
              </DrawerBody>
              <DrawerFooter>
            <Button
              size="sm"
              color="primary"
              className="text-white"
              isDisabled={selectedUsers.length === 0 || !dueDate || !templateId}
              startContent={<Send size={14} />}
              onPress={() => {
                selectedUsers.forEach((u) => onSend(u.userName, format(dueDate, "dd MMM yyyy"), templateId ? Number(templateId) : undefined));
                setSelectedUsers([]);
                setDueDate(null);
                setSending(false);
              }}
            >
              Send survey
            </Button>
            <Button size="sm" variant="flat" onPress={() => setSending(false)}>Cancel</Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <SurveyTemplates kind="ONBOARDING" isOpen={managing} onClose={() => setManaging(false)} onChanged={loadTemplates} />

      <Screen id="1.5" title="Onboarding scores" sub="Computed live from the responses above">
        <Cards>
          <CardStat hero label="Overall average" value={submitted.length ? one(avg(scores)) : "—"} unit="/10" note={`${submitted.length} responses`} />
          <CardStat label="Process block" value={submitted.length ? one(avg(processBlock)) : "—"} unit="/10" note="Q1–Q4" />
          <CardStat label="HR team block" value={submitted.length ? one(avg(hrBlock)) : "—"} unit="/10" note="Q5–Q7" />
          <CardStat label="Response rate" value={pct(submitted.length, surveys.length)} unit="%" note={`${surveys.filter((s) => s.status === "pending").length} pending`} />
          <CardStat label="Scores below 6" value={scores.filter((s) => s < 6).length} note="Needs HR follow-up" />
        </Cards>

        <Section>Score distribution — all answers</Section>
        <Distribution values={submitted.flatMap((s) => s.answers)} />

        <Section>Average by question</Section>
        <QuestionAverages labels={common.st.short} rows={common.surveys.map((s) => s.answers)} />

        <Section>Q8 — what to improve</Section>
        <div className="space-y-2.5">
          {submitted.filter((s) => s.feedback).map((s) => (
            <div key={s.id} className="border border-ink-200 dark:border-white/10 rounded p-3 flex gap-3">
              <div className="text-sm font-bold text-primary-600 w-8">{one(surveyScore(s))}</div>
              <div>
                <div className="text-[13px] text-ink-700 dark:text-ink-200">{s.feedback}</div>
                <div className="text-[11px] text-ink-400 mt-1">{s.employee} · {s.dept}</div>
              </div>
            </div>
          ))}
        </div>
      </Screen>
    </>
  );
}
