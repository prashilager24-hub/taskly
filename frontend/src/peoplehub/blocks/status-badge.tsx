import { cn } from "@/peoplehub/ui";

export type Tone = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  neutral: "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300",
};

const dotClass: Record<Tone, string> = {
  success: "bg-emerald-600",
  warning: "bg-amber-500",
  danger: "bg-rose-600",
  info: "bg-sky-600",
  brand: "bg-brand-600",
  neutral: "bg-ink-400",
};

/** One place that decides which color a status word gets, so it's identical on every screen. */
const MAP: [RegExp, Tone][] = [
  [/^(approved|active|completed|complete|paid|confirmed|resolved|hired|issued|selected|accepted|cleared|verified|present|on track|achieved|processed|disbursed|delivered|exceeds|closed won|live|published|valid|renewed|enrolled|passed)/i, "success"],
  [/^(pending|in progress|under review|scheduled|extension|awaiting|on hold|due|partially|at risk|in review|processing|l1|l2|l3|interview|shortlisted|notice period|half day|in transit|planned|meets)/i, "warning"],
  [/^(rejected|overdue|critical|failed|terminated|declined|absent|off track|expired|lost|blocked|below|high)/i, "danger"],
  [/^(draft|new|submitted|open|applied|upcoming|requested|sourcing|wfh|remote|medium|offer)/i, "info"],
  [/^(nominated|winner|outstanding|top)/i, "brand"],
];

export function toneOf(status: string): Tone {
  return MAP.find(([re]) => re.test(status))?.[1] ?? "neutral";
}

export function StatusBadge({ status, tone, className }: { status: string; tone?: Tone; className?: string }) {
  const t = tone ?? toneOf(status);
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap", toneClass[t], className)}>
      <span className={cn("size-1.5 rounded-full", dotClass[t])} />
      {status}
    </span>
  );
}

export function toneText(t: Tone) {
  return toneClass[t];
}
