/**
 * People Hub: small adapters so the screens ported from the PeopleHub blueprint (Next.js / shadcn) run on this
 * project's TapMind-themed HeroUI kit and React Router.
 */
import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { addToast, Button as UiButton } from "@/components/ui";
import { cn } from "@heroui/theme";

/** All People Hub pages live under /hub so they never clash with the existing Taskly routes */
export const HUB = "/hub";
/** "app:/path" links to a page of the existing app (e.g. the real Appraisal) instead of a /hub page */
export const hubPath = (p: string) => (p.startsWith("app:") ? p.slice(4) : `${HUB}/${p.replace(/^\/+/, "")}`);

type Variant = "default" | "outline" | "ghost" | "secondary";
type Size = "sm" | "md" | "icon-sm";

/** Blueprint button variants → TapMind buttons (primary / outlined / ghost) */
export function Button({ variant = "default", size = "md", onClick, disabled, children, className, type = "button", ...rest }: {
  variant?: Variant; size?: Size; onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string; type?: "button" | "submit"; "aria-label"?: string;
}) {
  const v = variant === "default" ? { color: "primary" as const } : variant === "ghost" ? { variant: "light" as const } : { variant: "bordered" as const };
  return (
    <UiButton {...v} size={size === "md" ? "md" : "sm"} isIconOnly={size === "icon-sm"} onPress={onClick} isDisabled={disabled} type={type}
      className={cn("[&_svg]:size-4", className)} aria-label={rest["aria-label"]}>
      {children}
    </UiButton>
  );
}

/** A link that looks like a primary (or outlined) button */
export function LinkButton({ to, children, outline, className }: { to: string; children: React.ReactNode; outline?: boolean; className?: string }) {
  return (
    <Link to={to}
      className={cn("inline-flex h-10 items-center gap-2 whitespace-nowrap border px-3.5 text-xs font-bold uppercase tracking-wide transition-colors focus-ring [&_svg]:size-4",
        outline ? "border-ink-300 text-ink-700 hover:border-brand-500 hover:text-brand-600 dark:border-white/10 dark:text-ink-200" : "border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700",
        className)}>
      {children}
    </Link>
  );
}

/** sonner-style toast on top of HeroUI's addToast */
type ToastOpts = { description?: string };
const show = (color: "success" | "danger" | "default") => (title: string, o?: ToastOpts) => addToast({ title, description: o?.description, color });
export const toast = Object.assign(show("default"), { success: show("success"), error: show("danger") });

/** A plain select in the project's field style */
export const NativeSelect = forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(function NativeSelect({ className, ...props }, ref) {
  return (
    <select ref={ref}
      className={cn("input-base h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className)}
      {...props} />
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <label htmlFor={htmlFor} className={cn("label-base mb-0", className)}>{children}</label>;
}

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("input-base", className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("input-base h-auto py-2", className)} {...props} />;
}

/** TapMind wordmark for the letter / ID card (the People Hub logo on dark backgrounds) */
export function Logo({ variant = "dark", className }: { variant?: "dark" | "white"; className?: string }) {
  if (variant === "white") return <img src="/peoplehub-logo.svg" alt="People Hub by TapMind" className={cn("w-auto", className)} />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/Tapmind.ico" alt="" className="h-full max-h-7 w-auto" />
      <span className={cn("text-base font-black uppercase tracking-btn", "text-ink-900")}>TapMind</span>
    </span>
  );
}

export { cn };
