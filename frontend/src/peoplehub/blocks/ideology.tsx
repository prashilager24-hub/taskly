import { Rocket, Scale, Trophy } from "lucide-react";

export const PILLARS = [
  { icon: Scale, title: "Fair & Transparent", text: "Clear policies, open processes and decisions everyone can see." },
  { icon: Trophy, title: "Money & Recognition", text: "Rewards linked to performance, and great work celebrated." },
  { icon: Rocket, title: "Leadership & Growth", text: "Learning paths and career moves that help people grow." },
];

export function IdeologyStrip() {
  return (
    <div className="grid gap-3 border border-ink-200 bg-gradient-to-r from-brand-50 via-white to-white p-4 sm:grid-cols-3 dark:border-white/10 dark:from-brand-500/10 dark:via-ink-900 dark:to-ink-900">
      {PILLARS.map((p) => (
        <div key={p.title} className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center bg-brand-600 text-white">
            <p.icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink-900 dark:text-white">{p.title}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">{p.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
