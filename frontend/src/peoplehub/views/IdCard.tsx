import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Printer, RefreshCcw, ShieldCheck } from "lucide-react"
import { NativeSelect, PageHeader, Panel, StatGrid } from "@/peoplehub/blocks/page"
import { PersonAvatar } from "@/peoplehub/blocks/person-cell"
import { StatusBadge } from "@/peoplehub/blocks/status-badge"
import { useRole } from "@/peoplehub/lib/role"
import { PEOPLE } from "@/peoplehub/mocks/people"
import { Button, Logo, toast } from "@/peoplehub/ui"

export function IdCard() {
  const { role, user } = useRole()
  const admin = role === "admin"
  const [id, setId] = useState(user.id)
  const p = admin ? PEOPLE.find((x) => x.id === id) ?? user : user
  const verify = `https://tapmind.com/verify/${p.id}`

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <PageHeader
          eyebrow="Assets & IT"
          title={admin ? "ID Card Generation & QR" : "My ID Card"}
          description="Digital employee ID cards with a QR code that lets security or visitors verify the employee instantly."
          actions={
            <>
              {admin && (
                <Button variant="outline" onClick={() => toast.success("Batch generation queued for 14 new joiners")}>
                  <RefreshCcw /> Batch generate
                </Button>
              )}
              <Button onClick={() => window.print()}>
                <Printer /> Print card
              </Button>
            </>
          }
        />
        {admin && (
          <StatGrid
            stats={[
              { label: "Cards issued", value: "229" },
              { label: "Pending print", value: "14", hint: "new joiners" },
              { label: "Reissue requests", value: "3" },
              { label: "QR scans (Nov)", value: "4,812" },
            ]}
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col items-center justify-center gap-8 rounded-xl border border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-white/[0.03] p-6 sm:flex-row sm:p-10 print:border-0 print:bg-transparent">
          {/* Front */}
          <div className="w-[260px] overflow-hidden rounded-2xl border border-ink-200 dark:border-white/10 bg-white text-slate-900 shadow-xl">
            <div className="relative h-24 bg-gradient-to-br from-neutral-900 to-neutral-800 px-4 pt-4">
              <Logo variant="white" className="h-6" />
              <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-600" />
            </div>
            <div className="relative z-10 -mt-10 flex flex-col items-center px-5 pb-5 text-center">
              <PersonAvatar name={p.name} size="xl" className="size-20 bg-brand-600 text-2xl ring-4 ring-white" />
              <p className="mt-3 text-base font-semibold">{p.name}</p>
              <p className="text-xs text-slate-500">{p.designation}</p>
              <p className="mt-1 text-xs font-medium text-slate-700">{p.department}</p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t border-ink-200 dark:border-white/10 border-slate-100 pt-3 text-left text-[11px]">
                <div>
                  <p className="text-slate-400">Emp. ID</p>
                  <p className="font-semibold">{p.id}</p>
                </div>
                <div>
                  <p className="text-slate-400">Blood group</p>
                  <p className="font-semibold">{p.blood}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Back */}
          <div className="flex w-[260px] flex-col items-center overflow-hidden rounded-2xl border border-ink-200 dark:border-white/10 bg-white p-5 text-center text-slate-900 shadow-xl">
            <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Scan to verify</p>
            <div className="mt-3 rounded-xl border border-ink-200 dark:border-white/10 border-slate-100 p-3">
              <QRCodeSVG value={verify} size={136} level="M" fgColor="#171717" />
            </div>
            <div className="mt-4 w-full space-y-1 text-left text-[11px]">
              {[
                ["Location", p.location],
                ["Joined", p.joined],
                ["Emergency", p.phone],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-ink-200 dark:border-white/10 border-slate-100 pt-3 text-[10px] text-slate-400">If found, please return to TapMind, Outer Ring Road, Bengaluru.</p>
          </div>
        </div>

        <Panel title={admin ? "Generate for" : "Card details"} className="no-print h-fit">
          <div className="space-y-4">
            {admin && (
              <NativeSelect value={id} onChange={(e) => setId(e.target.value)} aria-label="Employee">
                {PEOPLE.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.id}
                  </option>
                ))}
              </NativeSelect>
            )}
            <dl className="divide-y divide-ink-100 dark:divide-white/5 text-sm">
              {[
                ["Status", <StatusBadge key="s" status="Active" />],
                ["Valid till", "31 Mar 2028"],
                ["Access zones", "Main gate, Floors 3–5"],
                ["QR link", <span key="q" className="font-mono text-xs break-all">{verify}</span>],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-ink-500 dark:text-ink-400">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="flex gap-2 rounded-lg bg-brand-50 dark:bg-brand-500/15 p-3 text-xs text-brand-600">
              <ShieldCheck className="size-4 shrink-0" />
              The QR code holds only a verification link. No personal data is stored in the code itself.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
