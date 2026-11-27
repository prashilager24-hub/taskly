import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Upload, FileText, X, CheckCircle2, Loader2, Briefcase } from "lucide-react";
import { toast, cn, NativeSelect } from "@/peoplehub/ui";
import { PageHeader } from "@/peoplehub/blocks/page";

const BASE = "/t2.0/authentificationUtilization/applications";
const OPEN_ROLES_BASE = "/t2.0/authentificationUtilization/open-roles";

const SOURCE_OPTIONS = [
  "Job Portal",
  "LinkedIn",
  "Referral",
  "Database",
  "Walk-in candidate",
  "Campus",
];

type ParsedFields = {
  fullName: string;
  email: string;
  phone: string;
  totalExperience: string;
  linkedinUrl: string;
  currentLocation: string;
};

type OpenRole = { id: number; title: string; department: string };

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported for parsing.");
      return;
    }
    onFile(f);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0] ?? null); }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-lg cursor-pointer transition-all px-10 py-14 flex flex-col items-center gap-4 select-none",
        dragging
          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
          : "border-ink-200 dark:border-white/15 hover:border-ink-400 dark:hover:border-white/30 bg-ink-50 dark:bg-ink-800"
      )}>
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e => handle(e.target.files?.[0] ?? null)} />
      <div className="size-14 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
        <Upload className="size-6 text-brand-600 dark:text-brand-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-ink-900 dark:text-white">Drop a resume PDF here</p>
        <p className="text-xs text-ink-400 mt-1">or click to browse — PDF only, up to 5 MB</p>
      </div>
    </div>
  );
}

export function UploadApplicants() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedFields | null>(null);

  // form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [totalExperience, setTotalExperience] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [source, setSource] = useState("Database");
  const [internalNotes, setInternalNotes] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [openRoleId, setOpenRoleId] = useState("");
  const [openRoles, setOpenRoles] = useState<OpenRole[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(OPEN_ROLES_BASE)
      .then(r => setOpenRoles((r.data as { data: OpenRole[] }).data ?? []))
      .catch(() => {});
  }, []);

  async function parseFile(f: File) {
    setFile(f);
    setParsed(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("resume", f);
      const res = await axios.post(`${BASE}/parse-resume`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = (res.data as { data: ParsedFields }).data;
      setParsed(d);
      setFullName(d.fullName || "");
      setEmail(d.email || "");
      setPhone(d.phone || "");
      setTotalExperience(d.totalExperience || "");
      setCurrentLocation(d.currentLocation || "");
      setLinkedinUrl(d.linkedinUrl || "");
      toast.success("Resume parsed — please review and fill in any missing fields.");
    } catch {
      toast.error("Could not parse resume. You can still fill in the fields manually.");
    } finally {
      setParsing(false);
    }
  }

  function clear() {
    setFile(null); setParsed(null);
    setFullName(""); setEmail(""); setPhone(""); setTotalExperience("");
    setCurrentCompany(""); setCurrentDesignation(""); setNoticePeriod("");
    setCurrentLocation(""); setLinkedinUrl(""); setRoleTitle(""); setOpenRoleId("");
    setSource("Database"); setInternalNotes("");
    setSubmitted(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email) { toast.error("Full name and email are required."); return; }
    if (!roleTitle && !openRoleId) { toast.error("Please select a role or type a role title."); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (file) fd.append("resume", file);
      fd.append("fullName", fullName);
      fd.append("email", email);
      fd.append("phone", phone);
      fd.append("totalExperience", totalExperience);
      fd.append("currentCompany", currentCompany);
      fd.append("currentDesignation", currentDesignation);
      fd.append("noticePeriod", noticePeriod);
      fd.append("currentLocation", currentLocation);
      fd.append("linkedinUrl", linkedinUrl);
      fd.append("source", source);
      fd.append("internalNotes", internalNotes);
      if (openRoleId) {
        fd.append("openRoleId", openRoleId);
        const role = openRoles.find(r => String(r.id) === openRoleId);
        fd.append("roleTitle", role?.title ?? roleTitle);
      } else {
        fd.append("roleTitle", roleTitle);
      }

      await axios.post(`${BASE}/upload-applicant`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitted(true);
      toast.success("Applicant added to ATS.");
    } catch {
      toast.error("Failed to add applicant. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Talent Acquisition" title="Upload Applicants" description="Manually add candidates to the ATS pipeline." />
        <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-10 py-16 flex flex-col items-center gap-5">
          <CheckCircle2 className="size-14 text-emerald-500" />
          <div className="text-center">
            <p className="text-xl font-black text-ink-900 dark:text-white">Applicant Added</p>
            <p className="text-sm text-ink-500 mt-1">{fullName} has been added to the ATS under {roleTitle || openRoles.find(r => String(r.id) === openRoleId)?.title}.</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={clear}
              className="px-5 py-2 text-sm font-bold bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors">
              Upload Another
            </button>
            <a href="/hub/talent/interview-tracker"
              className="px-5 py-2 text-sm font-bold border border-ink-200 dark:border-white/15 text-ink-700 dark:text-ink-200 rounded hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
              View Applicants
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent Acquisition"
        title="Upload Applicants"
        description="Upload a candidate's resume to auto-parse their details, review and add notes, then save them to the ATS."
      />

      {!file ? (
        <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 p-8">
          <DropZone onFile={parseFile} />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">

          {/* File bar */}
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-5 py-4 flex items-center gap-4">
            <div className="size-10 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
              <FileText className="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-ink-400">{(file.size / 1024).toFixed(0)} KB
                {parsing && <span className="ml-2 inline-flex items-center gap-1 text-brand-600 dark:text-brand-400"><Loader2 className="size-3 animate-spin" /> Parsing…</span>}
                {parsed && !parsing && <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Parsed</span>}
              </p>
            </div>
            <button type="button" onClick={clear}
              className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors p-1">
              <X className="size-4" />
            </button>
          </div>

          {/* Role selection */}
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-6 py-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">Role</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Open Role <span className="text-ink-300">(optional)</span></label>
                <NativeSelect value={openRoleId} onChange={e => {
                  setOpenRoleId(e.target.value);
                  const r = openRoles.find(o => String(o.id) === e.target.value);
                  if (r) setRoleTitle(r.title);
                }} aria-label="Open Role">
                  <option value="">— Select open role —</option>
                  {openRoles.map(r => <option key={r.id} value={String(r.id)}>{r.title} · {r.department}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Role Title *</label>
                <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} required={!openRoleId}
                  placeholder="e.g. Senior React Developer"
                  className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* Candidate details */}
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-6 py-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">Candidate Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full Name *" value={fullName} onChange={setFullName} placeholder="Ravi Kumar" />
              <Field label="Email *" value={email} onChange={setEmail} placeholder="ravi@example.com" type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
              <Field label="Total Experience" value={totalExperience} onChange={setTotalExperience} placeholder="4 years" />
              <Field label="Current Company" value={currentCompany} onChange={setCurrentCompany} placeholder="Infosys" />
              <Field label="Current Designation" value={currentDesignation} onChange={setCurrentDesignation} placeholder="Senior Engineer" />
              <Field label="Notice Period" value={noticePeriod} onChange={setNoticePeriod} placeholder="30 days" />
              <Field label="Location" value={currentLocation} onChange={setCurrentLocation} placeholder="Bengaluru" />
              <Field label="LinkedIn URL" value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>

          {/* ATS Info */}
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-6 py-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400 flex items-center gap-2">
              <Briefcase className="size-3.5" /> ATS Info
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Source *</label>
                <NativeSelect value={source} onChange={e => setSource(e.target.value)} aria-label="Source">
                  {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Internal Notes</label>
              <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3}
                placeholder="Referred by Priya, strong background in fintech, good cultural fit…"
                className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={submitting || !fullName || !email || (!roleTitle && !openRoleId)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-6 py-2.5 rounded hover:bg-brand-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {submitting ? "Saving…" : "Add to ATS"}
            </button>
            <button type="button" onClick={clear}
              className="text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", label.includes("Notes") && "sm:col-span-2")}>
      <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}
