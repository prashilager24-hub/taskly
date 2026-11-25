import { Check, X } from "lucide-react";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui";
import { Button } from "@/peoplehub/ui";
import type { ColumnType, Row } from "@/peoplehub/modules/types";
import { Cell, isPerson, plain } from "./cell";
import { PersonAvatar } from "./person-cell";
import { StatusBadge } from "./status-badge";

/** A row's details in a panel that slides in from the right, with Approve / Reject for pending requests */
export function DetailSheet({ row, fields, title, onClose, onDecision }: {
  row: Row | null;
  fields: { key: string; label: string; type?: ColumnType }[];
  title: string;
  onClose: () => void;
  onDecision?: (row: Row, status: "Approved" | "Rejected") => void;
}) {
  const person = row ? Object.values(row).find(isPerson) : undefined;
  const status = row?.status ? String(row.status) : undefined;
  const pending = status && /pending|submitted|requested|under review|in review/i.test(status);

  return (
    <Drawer isOpen={!!row} onOpenChange={(o) => !o && onClose()} size="md">
      <DrawerContent>
        {row && (
          <>
            <DrawerHeader className="flex flex-col gap-1">
              <p className="eyebrow text-brand-600">{title}</p>
              <span className="text-lg">{person ? person.name : plain(row[fields[0]?.key])}</span>
              <span className="flex items-center gap-2 text-xs font-normal normal-case tracking-normal text-ink-500">
                <span className="font-mono">{row.id}</span>
                {status && <StatusBadge status={status} />}
              </span>
            </DrawerHeader>
            <DrawerBody>
              {person && (
                <div className="mb-2 flex items-center gap-3 border border-ink-200 bg-ink-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <PersonAvatar name={person.name} size="lg" />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{person.designation}</p>
                    <p className="text-xs text-ink-500">{person.department} · {person.location} · {person.id}</p>
                  </div>
                </div>
              )}
              <dl className="divide-y divide-ink-100 dark:divide-white/5">
                {fields.filter((f) => f.type !== "person" && f.key !== "status").map((f) => (
                  <div key={f.key} className="grid grid-cols-5 gap-3 py-3">
                    <dt className="col-span-2 text-xs font-medium text-ink-500">{f.label}</dt>
                    <dd className="col-span-3 text-sm"><Cell value={row[f.key]} type={f.type} /></dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <h3 className="eyebrow mb-3">Activity</h3>
                <ol className="relative space-y-4 border-l border-ink-200 pl-5 dark:border-white/10">
                  {[
                    ["Record created", "Submitted via People Hub"],
                    ["Notification sent", "Reporting manager and HR notified"],
                    [status ? `Status: ${status}` : "Updated", "Last updated today"],
                  ].map(([t, d]) => (
                    <li key={t} className="relative">
                      <span className="absolute top-1 -left-[25px] size-2.5 rounded-full border-2 border-white bg-brand-600 dark:border-ink-900" />
                      <p className="text-sm font-medium">{t}</p>
                      <p className="text-xs text-ink-500">{d}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </DrawerBody>
            {pending && onDecision && (
              <DrawerFooter className="flex-row">
                <Button variant="outline" className="flex-1" onClick={() => onDecision(row, "Rejected")}><X /> Reject</Button>
                <Button className="flex-1" onClick={() => onDecision(row, "Approved")}><Check /> Approve</Button>
              </DrawerFooter>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
