import { useState } from "react"
import { Download, Send } from "lucide-react"
import { NativeSelect, PageHeader, Panel } from "@/peoplehub/blocks/page"
import { inr } from "@/peoplehub/lib/format"
import { DEPARTMENTS } from "@/peoplehub/mocks/people"
import { Button, Label, TextInput as Input, Logo, toast } from "@/peoplehub/ui"

const TEMPLATES = ["Full-time (Standard)", "Full-time (Senior)", "Internship", "Contract"]

export function OfferLetter() {
  const [f, setF] = useState({
    name: "Ritika Agarwal",
    role: "Senior Backend Engineer",
    department: "Engineering",
    location: "Bengaluru",
    ctc: "2400000",
    joining: "2026-12-01",
    manager: "Rohan Mehta",
    template: TEMPLATES[0],
    probation: "6",
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const ctc = Number(f.ctc) || 0
  const joining = f.joining ? new Date(f.joining + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"
  const first = f.name.split(" ")[0] || "Candidate"

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`o-${k}`}>{label}</Label>
      <Input id={`o-${k}`} type={type} value={f[k]} onChange={set(k)} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Talent Acquisition"
          title="Offer Letter Generation"
          description="Fill in the details to generate a branded offer letter instantly, then download it or send it for e-signature."
          actions={
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Download /> Download PDF
              </Button>
              <Button onClick={() => toast.success(`Offer letter sent to ${f.name} for e-signature`, { description: "New hire notification will trigger once it's signed." })}>
                <Send /> Send for e-sign
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Offer details" className="no-print h-fit">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="o-template">Template</Label>
              <NativeSelect id="o-template" value={f.template} onChange={set("template")}>
                {TEMPLATES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </div>
            {field("name", "Candidate name")}
            {field("role", "Designation")}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="o-department">Department</Label>
                <NativeSelect id="o-department" value={f.department} onChange={set("department")}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </NativeSelect>
              </div>
              {field("location", "Location")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field("ctc", "Annual CTC (₹)", "number")}
              {field("probation", "Probation (months)", "number")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field("joining", "Joining date", "date")}
              {field("manager", "Reporting manager")}
            </div>
          </div>
        </Panel>

        <div className="rounded-xl border border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-white/[0.03] p-3 sm:p-6 print:border-0 print:bg-transparent print:p-0">
          <article className="mx-auto max-w-3xl rounded-lg bg-white p-8 text-[13px] leading-relaxed text-slate-700 shadow-sm sm:p-12 print:shadow-none">
            <header className="flex items-start justify-between border-b border-ink-200 dark:border-white/10 border-slate-200 pb-6">
              <div>
                <Logo variant="dark" className="h-7" />
                <p className="mt-2 text-xs text-slate-500">Outer Ring Road, Bengaluru 560103</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Ref: PH/OL/2026/1187</p>
                <p>24 November 2026</p>
              </div>
            </header>

            <h2 className="mt-8 text-center text-sm font-semibold tracking-[0.2em] text-slate-900 uppercase">Letter of Offer</h2>

            <p className="mt-8">Dear {first},</p>
            <p className="mt-4">
              We are delighted to offer you the position of <strong className="text-slate-900">{f.role || "—"}</strong> in our <strong className="text-slate-900">{f.department}</strong> team, based in{" "}
              <strong className="text-slate-900">{f.location || "—"}</strong>. You will report to <strong className="text-slate-900">{f.manager || "—"}</strong>.
            </p>
            <p className="mt-4">The key terms of this offer are:</p>

            <table className="mt-4 w-full border-collapse text-left">
              <tbody>
                {[
                  ["Annual CTC", inr(ctc)],
                  ["Fixed component (85%)", inr(Math.round(ctc * 0.85))],
                  ["Variable pay (15%, quarterly)", inr(Math.round(ctc * 0.15))],
                  ["Date of joining", joining],
                  ["Probation period", `${f.probation || 0} months`],
                  ["Employment type", f.template.split(" (")[0]],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-ink-200 dark:border-white/10 border-slate-100">
                    <td className="py-2.5 pr-4 text-slate-500">{k}</td>
                    <td className="py-2.5 font-medium text-slate-900">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-6">
              At TapMind we believe in being <em>fair and transparent</em>, in <em>recognising great work</em>, and in helping every person <em>grow as a leader</em>. We are excited to have you join us on this journey.
            </p>
            <p className="mt-4">Please sign and return this letter by 01 December 2026 to confirm your acceptance.</p>

            <footer className="mt-12 grid grid-cols-2 gap-8">
              <div>
                <p className="font-serif text-xl text-slate-900 italic">Priya Nair</p>
                <p className="mt-1 border-t border-ink-200 dark:border-white/10 border-slate-200 pt-2 text-xs text-slate-500">Priya Nair, HR Business Partner</p>
              </div>
              <div>
                <p className="text-xl">&nbsp;</p>
                <p className="mt-1 border-t border-ink-200 dark:border-white/10 border-slate-200 pt-2 text-xs text-slate-500">{f.name || "Candidate"}, Accepted on</p>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
