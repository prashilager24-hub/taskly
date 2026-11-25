import { useMemo, useState } from "react"
import { ArrowRight, CalendarDays, Star, X } from "lucide-react"
import { NativeSelect, PageHeader, StatGrid } from "@/peoplehub/blocks/page"
import { PersonAvatar } from "@/peoplehub/blocks/person-cell"
import { Button, cn, toast } from "@/peoplehub/ui"

const STAGES = [
  { key: "applied", label: "Applied", hint: "Screening" },
  { key: "l1", label: "Level 1", hint: "Technical" },
  { key: "l2", label: "Level 2", hint: "Technical / Case" },
  { key: "l3", label: "Level 3", hint: "Leadership / HR" },
  { key: "offer", label: "Offer", hint: "Offer released" },
] as const
type Stage = (typeof STAGES)[number]["key"]

type Candidate = { id: string; name: string; role: string; exp: string; score?: number; date?: string; stage: Stage }

const ROLES = ["Senior Backend Engineer", "Product Designer", "Account Executive", "DevOps Engineer"]
const NAMES = ["Ritika Agarwal", "Sameer Khan", "Nandini Rao", "Varun Bhatt", "Swati Mishra", "Akash Yadav", "Fatima Sheikh", "Deepak Nair", "Pallavi Jain", "Omkar Patil", "Shreya Ghosh", "Yash Thakur", "Ankita Das", "Mohit Arora", "Sana Qureshi", "Kunal Shah"]
const STAGE_OF: Stage[] = ["applied", "applied", "applied", "applied", "l1", "l1", "l1", "l2", "l2", "l2", "l3", "l3", "offer", "applied", "l1", "offer"]

const INITIAL: Candidate[] = NAMES.map((name, i) => ({
  id: `CAN-${200 + i}`,
  name,
  role: ROLES[i % ROLES.length],
  exp: `${2 + (i % 7)} yrs`,
  stage: STAGE_OF[i],
  score: STAGE_OF[i] === "applied" ? undefined : [3.8, 4.2, 4.5, 3.6, 4.0][i % 5],
  date: STAGE_OF[i] === "applied" || STAGE_OF[i] === "offer" ? undefined : ["25 Nov, 11:00", "26 Nov, 15:30", "27 Nov, 10:00"][i % 3],
}))

export function InterviewStages() {
  const [items, setItems] = useState(INITIAL)
  const [role, setRole] = useState("")
  const visible = useMemo(() => items.filter((c) => !role || c.role === role), [items, role])

  function advance(c: Candidate) {
    const idx = STAGES.findIndex((s) => s.key === c.stage)
    const next = STAGES[idx + 1]
    if (!next) return
    setItems((all) => all.map((x) => (x.id === c.id ? { ...x, stage: next.key, score: x.score ?? 4.0, date: next.key === "offer" ? undefined : "02 Dec, 11:00" } : x)))
    toast.success(`${c.name} moved to ${next.label}`, { description: next.key === "offer" ? "Generate the offer letter from Offer Letter Generation." : "Panel and candidate have been notified." })
  }
  function reject(c: Candidate) {
    setItems((all) => all.filter((x) => x.id !== c.id))
    toast(`${c.name} rejected`, { description: "A polite rejection email has been queued." })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent Acquisition"
        title="Interview Stages"
        description="Move candidates from screening through Level 1 → Level 2 → Level 3 to offer, with a scorecard at each step."
        actions={
          <NativeSelect className="w-56" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        }
      />
      <StatGrid
        stats={[
          { label: "Active candidates", value: String(items.length) },
          { label: "Level 1 → Level 2", value: "58%", hint: "pass rate" },
          { label: "Level 3 → Offer", value: "71%", hint: "pass rate" },
          { label: "Offer acceptance", value: "86%", delta: "+4%", trend: "up" },
        ]}
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-5 gap-4">
          {STAGES.map((s, si) => {
            const list = visible.filter((c) => c.stage === s.key)
            return (
              <section key={s.key} className="flex flex-col rounded-xl border border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-white/[0.03]" aria-label={s.label}>
                <header className="flex items-center justify-between border-b border-ink-200 dark:border-white/10 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold">{s.label}</h2>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{s.hint}</p>
                  </div>
                  <span className="tabular-nums rounded-full bg-white dark:bg-ink-900 px-2 py-0.5 text-xs font-semibold ">{list.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {list.length === 0 && <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">No candidates</p>}
                  {list.map((c) => (
                    <article key={c.id} className="rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 p-3.5 transition-shadow hover:shadow-md">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={c.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{c.role}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
                        <span>{c.exp}</span>
                        {c.score && (
                          <span className="inline-flex items-center gap-1 font-medium text-ink-900 dark:text-white">
                            <Star className="size-3 fill-amber-400 text-amber-400" /> {c.score.toFixed(1)}
                          </span>
                        )}
                        {c.date && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" /> {c.date}
                          </span>
                        )}
                      </div>
                      <div className={cn("mt-3 flex gap-2 border-t border-ink-200 dark:border-white/10 pt-3", si === STAGES.length - 1 && "hidden")}>
                        <Button size="sm" variant="ghost" className="text-ink-500 dark:text-ink-400" onClick={() => reject(c)} aria-label={`Reject ${c.name}`}>
                          <X /> Reject
                        </Button>
                        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => advance(c)}>
                          {STAGES[si + 1]?.label} <ArrowRight />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
