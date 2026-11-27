import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Plus, X, Activity, Briefcase, Users, Clock, User, FileText, Download, ExternalLink } from "lucide-react";

const FILES_BASE = "http://localhost:8080";

function JdViewer({ jdPath, roleId, onUpdated }: { jdPath?: string | null; roleId?: number; onUpdated?: (newPath: string) => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fileUrl = jdPath ? (jdPath.startsWith("http") ? jdPath : `${FILES_BASE}${jdPath}`) : null;
  const isPdf = !!fileUrl && fileUrl.toLowerCase().includes(".pdf");

  useEffect(() => {
    setBlobUrl(null);
    setFailed(false);
    if (!fileUrl || !isPdf) return;
    setLoading(true);
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [fileUrl]);

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !roleId) return;
    e.target.value = "";
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (![".pdf", ".doc", ".docx"].includes(ext)) {
      toast.error("Only PDF, DOC or DOCX files are accepted.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("description", file);
      const res = await axios.put(`${BASE}/${roleId}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const newDesc = (res.data as { data: { description?: string } }).data?.description;
      if (newDesc) onUpdated?.(newDesc);
      toast.success("Job description updated.");
    } catch {
      toast.error("Failed to update JD. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {fileUrl && (
          <>
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-ink-200 dark:border-white/15 px-3 py-1.5 text-xs font-bold text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
              <Download className="size-3.5" /> Download
            </a>
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
              <ExternalLink className="size-3" /> Open
            </a>
          </>
        )}
        {roleId && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={handleReplace} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-1.5 border border-dashed border-ink-300 dark:border-white/20 px-3 py-1.5 text-xs font-bold text-ink-500 dark:text-ink-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
              <FileText className="size-3.5" /> {uploading ? "Uploading…" : fileUrl ? "Replace JD" : "Upload JD"}
            </button>
          </>
        )}
      </div>
      {fileUrl && isPdf && loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-ink-400">
          <FileText className="size-4 animate-pulse" /> Loading preview…
        </div>
      )}
      {fileUrl && isPdf && !loading && blobUrl && (
        <object data={blobUrl} type="application/pdf" className="w-full border border-ink-200 dark:border-white/10 rounded" style={{ height: 500 }}>
          <p className="p-4 text-sm text-ink-500">Cannot preview — <a href={blobUrl} target="_blank" rel="noreferrer" className="underline text-brand-600">open file</a></p>
        </object>
      )}
      {fileUrl && isPdf && !loading && failed && (
        <p className="text-xs text-ink-400">Preview unavailable — use Download or Open above.</p>
      )}
      {fileUrl && !isPdf && (
        <p className="text-xs text-ink-400 flex items-center gap-1.5"><FileText className="size-3.5" /> DOC/DOCX — use Download to view.</p>
      )}
      {!fileUrl && !roleId && (
        <p className="text-xs text-ink-400">No JD attached.</p>
      )}
    </div>
  );
}

type AllLogEntry = { id: number; entityType: string; entityId: number; action: string; details: string | null; actor: string; createdAt: string };
import { Button, toast, cn } from "@/peoplehub/ui";
import { PageHeader, StatGrid } from "@/peoplehub/blocks/page";
import { DataTable } from "@/peoplehub/blocks/data-table";
import { FormDialog } from "@/peoplehub/blocks/form-dialog";
import { useRole } from "@/peoplehub/lib/role";
import type { Column, Row, FormConfig } from "@/peoplehub/modules/types";

type UserOption = { id: number; name: string };
let _usersCache: UserOption[] | null = null;

function useUsers(): UserOption[] {
  const [users, setUsers] = useState<UserOption[]>(_usersCache ?? []);
  useEffect(() => {
    if (_usersCache) return;
    axios.get("/api/users").then(r => {
      const raw = (r.data as any)?.response ?? (r.data as any)?.data ?? r.data ?? [];
      const list: UserOption[] = (Array.isArray(raw) ? raw : []).map((u: any) => ({ id: u.UserID ?? u.id, name: u.Name ?? u.name }));
      _usersCache = list;
      setUsers(list);
    }).catch(() => {});
  }, []);
  return users;
}

function UserSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const users = useUsers();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
        <option value="">— select —</option>
        {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
      </select>
    </div>
  );
}

type LogEntry = { id: number; action: string; details: string | null; actor: string; createdAt: string };
type RoleData = Record<string, unknown>;

const STATUS_PILL: Record<string, string> = {
  OPEN:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  CLOSED:  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex shrink-0 border-b border-ink-200 dark:border-white/[0.08] bg-white dark:bg-ink-800">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            active === t.key
              ? "border-b-2 border-brand-500 text-ink-900 dark:text-white"
              : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          )}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LogTimeline({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) return (
    <div className="flex items-center gap-2 py-6 text-xs text-ink-400">
      <Activity className="size-3.5" /> No activity yet
    </div>
  );
  return (
    <div>
      {logs.map((l, i) => (
        <div key={l.id} className="flex gap-3 py-3 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2 rounded-full bg-brand-500 shrink-0" />
            {i < logs.length - 1 && <span className="w-px flex-1 mt-1 bg-ink-200 dark:bg-white/[0.08]" />}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-xs font-semibold text-ink-900 dark:text-white">{l.action}</p>
            {l.details && <p className="text-xs text-ink-500 mt-0.5">{l.details}</p>}
            <p className="text-[10px] text-ink-400 mt-1">{l.actor} · {new Date(l.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const ROLE_DRAWER_TABS = [
  { key: "details", label: "Details" },
  { key: "edit", label: "Edit" },
  { key: "activity", label: "Activity" },
];

function PageActivityLog() {
  const [logs, setLogs] = useState<AllLogEntry[]>([]);
  useEffect(() => {
    axios.get("/t2.0/authentificationUtilization/talent-logs")
      .then(r => {
        const all = (r.data as { data: AllLogEntry[] }).data ?? [];
        setLogs(all.filter(l => l.entityType === "OPEN_ROLE"));
      })
      .catch(() => {});
  }, []);

  if (!logs.length) return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 px-6 py-10 flex items-center gap-2 text-sm text-ink-400">
      <Activity className="size-4" /> No role activity recorded yet.
    </div>
  );

  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10">
      {logs.map((l, i) => (
        <div key={l.id} className="flex gap-4 px-6 py-4 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
          <div className="flex flex-col items-center pt-1.5 shrink-0">
            <span className="size-2 rounded-full bg-brand-500" />
            {i < logs.length - 1 && <span className="w-px flex-1 mt-1 bg-ink-200 dark:bg-white/[0.08]" />}
          </div>
          <div className="min-w-0 pb-2 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-white">{l.action}</p>
            {l.details && <p className="text-xs text-ink-500 mt-0.5">{l.details}</p>}
            <p className="text-xs text-ink-400 mt-1">{l.actor} · {new Date(l.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PageTabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex border-b border-ink-200 dark:border-white/[0.08]">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            active === t.key
              ? "border-b-2 border-brand-500 text-ink-900 dark:text-white"
              : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          )}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "OPEN",    label: "Open",    ring: "ring-emerald-400" },
  { value: "ON_HOLD", label: "On Hold", ring: "ring-amber-400" },
  { value: "CLOSED",  label: "Closed",  ring: "ring-rose-400" },
];

function RoleDrawer({ roleData, onClose, onStatusChange, onJdUpdated, onRoleUpdated }: { roleData: RoleData | null; onClose: () => void; onStatusChange: (id: number, status: string) => Promise<void>; onJdUpdated?: (id: number, path: string) => void; onRoleUpdated?: (updated: RoleData) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState("details");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  // edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editExp, setEditExp] = useState("");
  const [editType, setEditType] = useState("");
  const [editOpenings, setEditOpenings] = useState("");
  const [editHm, setEditHm] = useState("");
  const [editRecruiter, setEditRecruiter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleData) return;
    setTab("details");
    setLogs([]);
    setStatus(String(roleData.status ?? "OPEN"));
    setEditTitle(String(roleData.title ?? ""));
    setEditLocation(String(roleData.location ?? ""));
    setEditExp(String(roleData.experience ?? ""));
    setEditType(String(roleData.employmentType ?? ""));
    setEditOpenings(String(roleData.openings ?? ""));
    setEditHm(String(roleData.hiringManager ?? ""));
    setEditRecruiter(String((roleData as any).recruiter ?? ""));
    axios.get(`/t2.0/authentificationUtilization/open-roles/${roleData.id}/logs`)
      .then(r => setLogs((r.data as { data: LogEntry[] }).data ?? []))
      .catch(() => {});
  }, [roleData]);

  async function saveEdit() {
    if (!roleData) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", editTitle);
      fd.append("location", editLocation);
      if (editExp) fd.append("experience", editExp);
      if (editType) fd.append("employmentType", editType);
      fd.append("openings", String(Number(editOpenings) || 1));
      if (editHm) fd.append("hiringManager", editHm);
      if (editRecruiter) fd.append("recruiter", editRecruiter);
      const res = await axios.put(`/t2.0/authentificationUtilization/open-roles/${roleData.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const updated = (res.data as { data: RoleData }).data;
      onRoleUpdated?.(updated);
      toast.success("Role updated.");
      setTab("details");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next: string) {
    if (!roleData || busy || next === status) return;
    setBusy(next);
    await onStatusChange(Number(roleData.id), next);
    setStatus(next);
    // refresh logs
    axios.get(`/t2.0/authentificationUtilization/open-roles/${roleData.id}/logs`)
      .then(r => setLogs((r.data as { data: LogEntry[] }).data ?? []))
      .catch(() => {});
    setBusy("");
  }

  if (!roleData) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-ink-50 dark:bg-ink-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="shrink-0 bg-ink-900 dark:bg-ink-950 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-bold tracking-widest text-white/40 uppercase">{String(roleData.roleId ?? "")}</span>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <h2 className="text-xl font-black text-white leading-tight">{String(roleData.title ?? "")}</h2>
          <p className="text-sm text-white/50 mt-1 mb-4">{String(roleData.department ?? "")} · {String(roleData.location ?? "")}</p>
          <span className={cn("inline-flex items-center px-3 py-1 text-xs font-bold rounded-full", STATUS_PILL[status] ?? STATUS_PILL.OPEN)}>
            {status.replace("_", " ")}
          </span>
        </div>

        {/* Status changer */}
        <div className="shrink-0 bg-white dark:bg-ink-800 border-b border-ink-200 dark:border-white/[0.08] px-6 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2">Change Status</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => changeStatus(s.value)}
                disabled={s.value === status || !!busy}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full border transition-all",
                  s.value === status
                    ? cn(STATUS_PILL[s.value], "ring-2", s.ring)
                    : "border-ink-200 dark:border-white/10 text-ink-500 hover:border-ink-400 dark:hover:border-white/30 disabled:opacity-40"
                )}>
                {busy === s.value ? "…" : s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <TabBar tabs={ROLE_DRAWER_TABS} active={tab} onChange={setTab} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {tab === "details" && (
            <div className="space-y-4 px-6 py-5">
              <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] divide-y divide-ink-100 dark:divide-white/[0.06]">
                {!!roleData.openings && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Users className="size-4 text-ink-400 shrink-0" />
                    <span className="text-xs text-ink-400 w-28 uppercase tracking-widest font-semibold">Openings</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{String(roleData.openings)}</span>
                  </div>
                )}
                {!!roleData.experience && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Clock className="size-4 text-ink-400 shrink-0" />
                    <span className="text-xs text-ink-400 w-28 uppercase tracking-widest font-semibold">Experience</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{String(roleData.experience)}</span>
                  </div>
                )}
                {!!roleData.employmentType && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Briefcase className="size-4 text-ink-400 shrink-0" />
                    <span className="text-xs text-ink-400 w-28 uppercase tracking-widest font-semibold">Type</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{String(roleData.employmentType)}</span>
                  </div>
                )}
                {!!roleData.hiringManager && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <User className="size-4 text-ink-400 shrink-0" />
                    <span className="text-xs text-ink-400 w-28 uppercase tracking-widest font-semibold">Hiring Manager</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{String(roleData.hiringManager)}</span>
                  </div>
                )}
                {!!(roleData as any).recruiter && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <User className="size-4 text-ink-400 shrink-0" />
                    <span className="text-xs text-ink-400 w-28 uppercase tracking-widest font-semibold">Recruiter</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{String((roleData as any).recruiter)}</span>
                  </div>
                )}
              </div>

              {/* JD attachment */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2 px-1">Job Description</p>
                <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4 py-4">
                  <JdViewer
                    jdPath={roleData.description ? String(roleData.description) : null}
                    roleId={Number(roleData.id)}
                    onUpdated={path => onJdUpdated?.(Number(roleData.id), path)}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "edit" && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Role Title *</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Location</label>
                    <select value={editLocation} onChange={e => setEditLocation(e.target.value)}
                      className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                      {["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Remote", "Hybrid"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Openings</label>
                    <input type="number" min={1} value={editOpenings} onChange={e => setEditOpenings(e.target.value)}
                      className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Experience</label>
                    <select value={editExp} onChange={e => setEditExp(e.target.value)}
                      className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="">—</option>
                      {["0–1 years", "1–3 years", "3–5 years", "5–8 years", "8+ years"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Type</label>
                    <select value={editType} onChange={e => setEditType(e.target.value)}
                      className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="">—</option>
                      {["Full Time", "Part Time", "Contract", "Internship"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <UserSelect label="Hiring Manager" value={editHm} onChange={setEditHm} />
                <UserSelect label="Recruiter" value={editRecruiter} onChange={setEditRecruiter} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveEdit} disabled={saving || !editTitle}
                  className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-5 py-2 rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setTab("details")}
                  className="text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="px-6 py-5">
              <LogTimeline logs={logs} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BASE = "/t2.0/authentificationUtilization/open-roles";

const COLUMNS: Column[] = [
  { key: "roleId", label: "Role ID", minor: true },
  { key: "title", label: "Role" },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "experience", label: "Experience", minor: true },
  { key: "employmentType", label: "Type", minor: true },
  { key: "openings", label: "Openings", type: "number" },
  { key: "status", label: "Status", type: "status" },
];

const CREATE_FORM: FormConfig = {
  title: "Create Open Role",
  description: "Post a new job opening for the talent team.",
  submitLabel: "Post Role",
  fields: [
    { name: "title", label: "Role Title", type: "text", required: true, placeholder: "e.g. Senior Frontend Engineer" },
    { name: "department", label: "Department", type: "select", required: true, fetchOptions: "departments" },
    { name: "location", label: "Location", type: "select", required: true, options: ["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Remote", "Hybrid"] },
    { name: "openings", label: "Number of Openings", type: "number", required: true, placeholder: "1" },
    { name: "experience", label: "Experience", type: "select", options: ["0–1 years", "1–3 years", "3–5 years", "5–8 years", "8+ years"] },
    { name: "employmentType", label: "Employment Type", type: "select", options: ["Full Time", "Part Time", "Contract", "Internship"] },
    { name: "hiringManager", label: "Hiring Manager", type: "select", fetchOptions: "users" },
    { name: "recruiter", label: "Recruiter", type: "select", fetchOptions: "users" },
    { name: "description", label: "Job Description", type: "file", full: true, hint: "PDF, DOC or DOCX · max 10 MB", accept: ".pdf,.doc,.docx" },
  ],
};

function toRow(r: Record<string, unknown>): Row {
  return {
    id: String(r.id),
    roleId: (r.roleId as string) || "—",
    title: r.title,
    department: r.department,
    location: r.location,
    experience: (r.experience as string) || "—",
    employmentType: (r.employmentType as string) || "Full Time",
    openings: r.openings,
    status: r.status,
  };
}

export function OpenRoles() {
  const { role } = useRole();
  const isAdmin = role === "admin";

  const [allRoleData, setAllRoleData] = useState<RoleData[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const [pageView, setPageView] = useState("roles");

  async function load() {
    try {
      const endpoint = isAdmin ? `${BASE}` : BASE;
      const res = await axios.get(endpoint);
      const data = (res.data as { data: RoleData[] }).data ?? [];
      setAllRoleData(data);
      setRows(data.map(toRow));
    } catch {
      toast.error("Could not load open roles.");
    }
  }

  useEffect(() => { load(); }, [isAdmin]);

  async function handleStatusChange(id: number, status: string) {
    try {
      await axios.put(`${BASE}/${id}`, { status });
      toast.success(`Status updated to ${status.replace("_", " ")}`);
      setRows(prev => prev.map(r => String(r.id) === String(id) ? { ...r, status } : r));
      setAllRoleData(prev => prev.map(d => String(d.id) === String(id) ? { ...d, status } : d));
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function handleCreate(values: Record<string, string | File>) {
    try {
      const fd = new FormData();
      fd.append("title", String(values.title));
      fd.append("department", String(values.department));
      fd.append("location", String(values.location));
      fd.append("openings", String(Number(values.openings) || 1));
      if (values.experience) fd.append("experience", String(values.experience));
      if (values.employmentType) fd.append("employmentType", String(values.employmentType));
      if (values.hiringManager) fd.append("hiringManager", String(values.hiringManager));
      if (values.recruiter) fd.append("recruiter", String(values.recruiter));
      if (values.description instanceof File) fd.append("description", values.description);

      await axios.post(BASE, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Role posted successfully.");
      await load();
    } catch {
      toast.error("Failed to post the role. Please try again.");
    }
  }

  const stats = [
    { label: "Open Roles", value: String(rows.filter((r) => r.status === "OPEN").length) },
    { label: "On Hold", value: String(rows.filter((r) => r.status === "ON_HOLD").length) },
    { label: "Total Posted", value: String(rows.length) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent"
        title="Open Roles"
        description="All active job openings posted by the talent team."
        actions={isAdmin ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create Open Role
          </Button>
        ) : undefined}
      />

      <StatGrid stats={stats} />

      {/* ── Page-level tabs ── */}
      <PageTabBar
        tabs={[{ key: "roles", label: "Roles" }, { key: "activity", label: "Activity Log" }]}
        active={pageView}
        onChange={v => { setPageView(v); setSelectedRole(null); }}
      />

      {/* ── Roles view ── */}
      {pageView === "roles" && (
        <>
          <DataTable
            title="Roles"
            columns={COLUMNS}
            rows={rows}
            tabsOn="status"
            onRowClick={r => setSelectedRole(allRoleData.find(d => String(d.id) === String(r.id)) ?? null)}
            rowButton={{ label: "View", onClick: r => setSelectedRole(allRoleData.find(d => String(d.id) === String(r.id)) ?? null) }}
          />
          <RoleDrawer
            roleData={selectedRole}
            onClose={() => setSelectedRole(null)}
            onStatusChange={handleStatusChange}
            onJdUpdated={(id, path) => {
              setAllRoleData(prev => prev.map(d => String(d.id) === String(id) ? { ...d, description: path } : d));
              setSelectedRole(prev => prev && String(prev.id) === String(id) ? { ...prev, description: path } : prev);
            }}
            onRoleUpdated={(updated) => {
              setAllRoleData(prev => prev.map(d => String(d.id) === String(updated.id) ? updated : d));
              setRows(prev => prev.map(r => String(r.id) === String(updated.id) ? toRow(updated) : r));
              setSelectedRole(updated);
            }}
          />
        </>
      )}

      {/* ── Activity Log view ── */}
      {pageView === "activity" && <PageActivityLog />}

      {isAdmin && (
        <FormDialog
          config={CREATE_FORM}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
        />
      )}

    </div>
  );
}
