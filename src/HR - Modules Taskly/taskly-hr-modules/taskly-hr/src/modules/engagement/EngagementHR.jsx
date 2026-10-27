import { useState, useEffect } from "react";
import { Plus, Send, Search, X, ArrowLeft } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { Button, Input, Select, SelectItem, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import * as api from "../../lib/api";
import {
  Screen, Field, Section, Pill, Cards, CardStat, Distribution,
  QuestionAverages, Empty, OpenPoint, THead,
} from "../../components/ui";
import { ENG_REST_SHORT } from "../../lib/questions";
import { avg, one, pct, respValues, engAvg } from "../../lib/metrics";

const QUARTERS = [
  { id: "Q1", label: "Q1 FY26", months: ["January", "February", "March"], range: "Jan to Mar 2026" },
  { id: "Q2", label: "Q2 FY26", months: ["April", "May", "June"], range: "Apr to Jun 2026" },
  { id: "Q3", label: "Q3 FY26", months: ["July", "August", "September"], range: "Jul to Sep 2026" },
  { id: "Q4", label: "Q4 FY26", months: ["October", "November", "December"], range: "Oct to Dec 2026" },
];

export default function EngagementHR({ surveys = [], headcount = 0, notifyList = "", onRollout }) {
  const [rolling, setRolling] = useState(false);
  const [quarter, setQuarter] = useState("");
  const [closes, setCloses] = useState(undefined);
  const [selected, setSelected] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingScores, setLoadingScores] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!rolling) return;
    setLoadingUsers(true);
    api.fetchUsers()
      .then((users) => setAllUsers(users))
      .catch(() => setAllUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [rolling]);

  const filteredUsers = allUsers.filter((u) => u.userName.toLowerCase().includes(userSearch.toLowerCase()));
  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUsers.some((s) => s.userID === u.userID));
  const toggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.userID === user.userID) ? prev.filter((u) => u.userID !== user.userID) : [...prev, user]
    );
  };
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredUsers.map((u) => u.userID));
      setSelectedUsers((prev) => prev.filter((u) => !filteredIds.has(u.userID)));
    } else {
      setSelectedUsers((prev) => {
        const existingIds = new Set(prev.map((u) => u.userID));
        const newUsers = filteredUsers.filter((u) => !existingIds.has(u.userID));
        return [...prev, ...newUsers];
      });
    }
  };
  const removeUser = (userID) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userID !== userID));
  };

  const detail = surveys.find((s) => s.id === selected);
  const detailRes = detailData?.responses ?? detail?.responses ?? [];
  const monthLabels = detailData?.months?.length
    ? detailData.months.map((m, i) => `Month ${i + 1}: ${m}`)
    : (detail?.months || []).map((m, i) => `Month ${i + 1}: ${m}`);
  const canRollout = !!quarter && !!closes && selectedUsers.length > 0;

  const viewScores = (id) => {
    console.log("[EngagementHR] clicked view scores for", id);
    setSelected(id);
    setDetailData(null);
    setLoadingScores(true);
    api.fetchEngagementScores(id)
      .then((data) => setDetailData(data))
      .catch(() => setDetailData(null))
      .finally(() => setLoadingScores(false));
  };

  const rollOut = () => {
    const q = QUARTERS.find((x) => x.id === quarter);
    onRollout({
      quarter: `${q.label} — ${q.range}`,
      months: q.months,
      closes: format(closes, "dd MMM yyyy"),
      recipients: selectedUsers.map((u) => u.userID),
    });
    setQuarter("");
    setCloses(undefined);
    setSelectedUsers([]);
    setRolling(false);
  };

  return (
    <>
      <Screen id="3.2" title="Engagement Surveys — HR console" sub="Quarterly rollouts and their results">
        <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
          <Select size="sm" variant="bordered" className="w-32" aria-label="FY filter">
            <SelectItem key="fy26">FY26</SelectItem>
          </Select>
          <Button size="sm" color="primary" className="text-white" startContent={<Plus size={14} />} onPress={() => setRolling(true)}>
            Roll out new survey
          </Button>
        </div>

        <table className="w-full text-sm">
          <THead cols={["Quarter", "Sent to", "Responses", "Avg", "Status", ""]} />
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id} className={`border-b border-gray-100 last:border-0 ${s.id === selected ? "bg-primary-50" : ""}`}>
                <td className="py-3">{s.quarter}</td>
                <td className="py-3">{s.sentTo}</td>
                <td className="py-3">
                  {(s.responses || []).length} <span className="text-gray-400">({pct((s.responses || []).length, s.sentTo)}%)</span>
                </td>
                <td className="py-3 font-semibold">{(s.responses || []).length ? one(engAvg({ ...s, responses: s.responses || [] })) : "—"}</td>
                <td className="py-3">
                  {s.status === "collecting" ? <Pill tone="open">Collecting</Pill> : <Pill tone="done">Closed</Pill>}
                </td>
                <td className="py-3 text-right">
                  <Button size="sm" variant="flat" onPress={() => viewScores(s.id)}>View scores</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[11px] text-gray-400 mt-3">
          Response rate sits next to the average on purpose — a 9.0 from 43% of the org is not a 9.0.
        </div>
      </Screen>

      {rolling && (
        <Screen id="3.3" title="Roll out new engagement survey">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <div>
              <Field label="Quarter">
                <Select variant="bordered" selectedKeys={[quarter]} onSelectionChange={(k) => setQuarter(Array.from(k)[0])} aria-label="Quarter">
                  {QUARTERS.map((q) => <SelectItem key={q.id}>{q.label}</SelectItem>)}
                </Select>
              </Field>
              <Field label="Months (auto-filled)">
                <div className="space-y-2">
                  {(quarter ? QUARTERS.find((q) => q.id === quarter).months : ["—", "—", "—"]).map((m, i) => (
                    <Input key={i} isReadOnly variant="bordered" value={m} />
                  ))}
                </div>
              </Field>
              <Field label="Feedback window closes">
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="bordered" className="w-full justify-between">
                      {closes ? format(closes, "dd MMM yyyy") : <span className="text-gray-400">Pick a date</span>}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Closes date picker" className="p-0" itemClasses={{ base: "p-0 cursor-default" }}>
                    <DropdownItem key="calendar">
                      <DayPicker mode="single" selected={closes} onSelect={setCloses} disabled={{ before: new Date() }} />
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Field>
            </div>
            <div>
              <Field label="Audience">
                <div className="border border-gray-300 rounded-md bg-white">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-200">
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <input
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                      placeholder={loadingUsers ? "Loading employees…" : "Search by name…"}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      disabled={loadingUsers}
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch("")} className="text-gray-400 hover:text-gray-600">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2.5 py-1.5 border-b border-gray-100">
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
                  <div className="max-h-48 overflow-y-auto">
                    {filteredUsers.length === 0 && !loadingUsers && (
                      <div className="px-3 py-2.5 text-xs text-gray-400">No users found.</div>
                    )}
                    {filteredUsers.length > 0 && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 border-b border-gray-100 font-medium"
                        onClick={toggleAllFiltered}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${allFilteredSelected ? "bg-primary border-primary" : "border-gray-300"}`}>
                          {allFilteredSelected && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          )}
                        </div>
                        <span>Select All{userSearch ? ` (${filteredUsers.length})` : ""}</span>
                      </button>
                    )}
                    {filteredUsers.map((u) => {
                      const chosen = selectedUsers.some((s) => s.userID === u.userID);
                      return (
                        <button
                          key={u.userID}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${chosen ? "bg-primary-50" : ""}`}
                          onClick={() => toggleUser(u)}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${chosen ? "bg-primary border-primary" : "border-gray-300"}`}>
                            {chosen && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{u.userName}</div>
                            <div className="text-[11px] text-gray-400 truncate">{u.departmentName || u.userEmail}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedUsers.length > 0 && (
                  <div className="text-[11px] text-gray-400 mt-1">{selectedUsers.length} employee{selectedUsers.length > 1 ? "s" : ""} selected</div>
                )}
              </Field>
              <Field label="Notify on submission">
                <Input variant="bordered" defaultValue={notifyList} />
              </Field>
              <Field label="Survey">
                <Input isReadOnly variant="bordered" value="Employee Engagement Survey — 5 ratings + 1 open question" />
              </Field>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Button size="sm" color="primary" className="text-white" isDisabled={!canRollout} startContent={<Send size={14} />} onPress={rollOut}>
              Roll out survey
            </Button>
            <Button size="sm" variant="flat" onPress={() => setRolling(false)}>Cancel</Button>
          </div>

          <OpenPoint>
            This template rates a whole quarter, three months at a time. The original brief was a survey per event, right
            after it happens. Only one of these can be the v1 cadence.
          </OpenPoint>
        </Screen>
      )}

      {detail && (
        <Screen id="3.4" title={`Engagement scores — ${detail.quarter}`} sub="Computed live from the responses collected">
          <button
            onClick={() => { setSelected(null); setDetailData(null); }}
            className="text-xs text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back to list
          </button>
          {loadingScores ? (
            <Empty>Loading scores…</Empty>
          ) : detailRes.length ? (
            <>
              <Cards>
                <CardStat hero label="Quarter average" value={one(engAvg({ ...detail, responses: detailRes }))} unit="/10" note={`${detailRes.length} responses`} />
                <CardStat label="Responses" value={detailRes.length} unit={`/${detail.sentTo}`} note={`${pct(detailRes.length, detail.sentTo)}% response rate`} />
                <CardStat label={ENG_REST_SHORT[0]} value={one(avg(detailRes.map((r) => r.rest[0])))} unit="/10" />
                <CardStat label={ENG_REST_SHORT[1]} value={one(avg(detailRes.map((r) => r.rest[1])))} unit="/10" />
                <CardStat label="Written feedback" value={detailRes.filter((r) => r.feedback).length} note="Comments received" />
              </Cards>

              <Section>Month-on-month activity rating</Section>
              <QuestionAverages labels={monthLabels} rows={detailRes.map((r) => r.months)} />

              <Section>Average by question</Section>
              <QuestionAverages labels={ENG_REST_SHORT} rows={detailRes.map((r) => r.rest)} />

              <Section>Score distribution</Section>
              <Distribution values={detailRes.flatMap(respValues)} />

              <Section>Continue / improve / introduce</Section>
              <div className="space-y-2.5">
                {detailRes.filter((r) => r.feedback).map((r, i) => (
                  <div key={i} className="border border-gray-200 rounded p-3 flex gap-3">
                    <div className="text-sm font-bold text-primary-600 w-8">{one(avg(respValues(r)))}</div>
                    <div>
                      <div className="text-[13px] text-gray-700">{r.feedback}</div>
                      {/* <div className="text-[11px] text-gray-400 Anonymousmt-1">{r.anonymous ? "Anonymous" : r.by}</div> */}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <Empty>No responses yet for this quarter.</Empty>}
        </Screen>
      )}
    </>
  );
}