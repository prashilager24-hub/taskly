import { cn } from "@/peoplehub/ui";
import { initials, tint, type Person } from "@/peoplehub/mocks/people";

export function PersonAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm", xl: "size-16 text-lg" }[size];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", s, tint(name), className)}>
      {initials(name)}
    </span>
  );
}

export function PersonCell({ person, sub }: { person: Pick<Person, "name" | "designation" | "id">; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={person.name} />
      <div className="min-w-0">
        <div className="truncate font-medium text-ink-900 dark:text-white">{person.name}</div>
        <div className="truncate text-xs text-ink-500 dark:text-ink-400">{sub ?? person.designation}</div>
      </div>
    </div>
  );
}
