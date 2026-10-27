/**
 * TapMind-themed HeroUI — import UI components from "@/components/ui" instead of "@heroui/react".
 *
 * Re-exports all of HeroUI, overriding the components whose look the TapMind design system
 * defines (TapMind-UI-Design-System.md §5): buttons are uppercase/bold/tracked with fixed
 * heights and invert to an outline on hover; fields use the shared label + input styling;
 * cards are flat bordered surfaces; chips are tracked uppercase badges; modals use the pop shadow.
 * Colors, radius and fonts come from the theme in tailwind.config.js.
 */
import { forwardRef } from "react";
import { cn } from "@heroui/theme";
import {
  Autocomplete as HeroAutocomplete,
  DatePicker as HeroDatePicker,
  DateRangePicker as HeroDateRangePicker,
  type AutocompleteProps,
  type DatePickerProps,
  type DateRangePickerProps,
  Button as HeroButton,
  Card as HeroCard,
  Chip as HeroChip,
  Input as HeroInput,
  Modal as HeroModal,
  Tabs as HeroTabs,
  type TabsProps,
  Pagination as HeroPagination,
  type PaginationProps,
  Select as HeroSelect,
  Textarea as HeroTextarea,
  type ButtonProps,
  type CardProps,
  type ChipProps,
  type InputProps,
  type ModalProps,
  type SelectProps,
  type TextAreaProps,
} from "@heroui/react";

export * from "@heroui/react";

// ── Button ───────────────────────────────────────────────────────────────────

const BUTTON_BASE = "font-bold uppercase tracking-wide transition-colors whitespace-nowrap focus-ring data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed";

// Fixed heights so a button sits flush next to a field of the same size
const BUTTON_SIZES = {
  sm: "h-8 px-2.5 text-[11px] gap-1.5",
  md: "h-10 px-3.5 text-xs gap-2",
  lg: "h-11 px-5 text-sm gap-2",
} as const;

const BUTTON_VARIANTS = {
  primary: "bg-brand-600 text-white border border-brand-600 data-[hover=true]:bg-transparent data-[hover=true]:text-brand-600 data-[hover=true]:opacity-100 dark:data-[hover=true]:text-brand-400",
  secondary: "bg-transparent text-ink-700 dark:text-ink-200 border border-ink-300 dark:border-white/10 data-[hover=true]:border-brand-500 data-[hover=true]:text-brand-600 data-[hover=true]:bg-transparent data-[hover=true]:opacity-100 dark:data-[hover=true]:text-brand-400",
  ghost: "bg-transparent text-ink-600 dark:text-ink-300 border border-transparent data-[hover=true]:bg-ink-100 data-[hover=true]:opacity-100 dark:data-[hover=true]:bg-ink-800",
  danger: "bg-rose-600 text-white border border-rose-600 data-[hover=true]:bg-transparent data-[hover=true]:text-rose-500 data-[hover=true]:opacity-100",
  dangerGhost: "bg-transparent text-rose-600 dark:text-rose-400 border border-transparent data-[hover=true]:bg-rose-50 data-[hover=true]:opacity-100 dark:data-[hover=true]:bg-rose-500/15",
  success: "bg-emerald-600 text-white border border-emerald-600 data-[hover=true]:bg-transparent data-[hover=true]:text-emerald-600 data-[hover=true]:opacity-100",
} as const;

/** Maps HeroUI's color × variant onto the five TapMind button variants */
function tapmindVariant(color: ButtonProps["color"], variant: ButtonProps["variant"]): keyof typeof BUTTON_VARIANTS {
  const solid = !variant || variant === "solid" || variant === "shadow";
  const subtle = variant === "light" || variant === "ghost";
  if (color === "danger") return solid ? "danger" : "dangerGhost";
  if (color === "success" && solid) return "success";
  if (color === "primary" || color === "secondary" || color === "warning") {
    if (solid) return "primary";
    return subtle ? "ghost" : "secondary";
  }
  // color "default" (HeroUI's default)
  return subtle ? "ghost" : "secondary";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, color, variant, size = "md", isIconOnly, ...props },
  ref,
) {
  const look = BUTTON_VARIANTS[tapmindVariant(color, variant)];
  return (
    <HeroButton
      ref={ref}
      className={cn(
        BUTTON_BASE,
        // Icon buttons keep HeroUI's square sizing; only text buttons get the fixed size scale
        !isIconOnly && BUTTON_SIZES[size],
        look,
        className,
      )}
      color={color}
      isIconOnly={isIconOnly}
      size={size}
      variant={variant}
      {...props}
    />
  );
});

// ── Fields ───────────────────────────────────────────────────────────────────

const FIELD_LABEL = "font-secondary text-[10.5px] font-medium uppercase tracking-label text-ink-500 dark:text-ink-400";
const FIELD_WRAPPER = "bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 shadow-none data-[hover=true]:bg-white data-[hover=true]:border-ink-300 dark:data-[hover=true]:bg-ink-900 group-data-[focus=true]:bg-white group-data-[focus=true]:border-brand-500 dark:group-data-[focus=true]:bg-ink-900";
const FIELD_INPUT = "text-sm text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ classNames, ...props }, ref) {
  return (
    <HeroInput
      ref={ref}
      classNames={{
        ...classNames,
        label: cn(FIELD_LABEL, classNames?.label),
        inputWrapper: cn(FIELD_WRAPPER, classNames?.inputWrapper),
        input: cn(FIELD_INPUT, classNames?.input),
      }}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function Textarea({ classNames, ...props }, ref) {
  return (
    <HeroTextarea
      ref={ref}
      classNames={{
        ...classNames,
        label: cn(FIELD_LABEL, classNames?.label),
        inputWrapper: cn(FIELD_WRAPPER, classNames?.inputWrapper),
        input: cn(FIELD_INPUT, classNames?.input),
      }}
      {...props}
    />
  );
});

// Select is generic over its item type; keep that by casting the forwardRef result
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ classNames, ...props }, ref) {
  return (
    <HeroSelect
      ref={ref}
      classNames={{
        ...classNames,
        label: cn(FIELD_LABEL, classNames?.label),
        trigger: cn(FIELD_WRAPPER, classNames?.trigger),
        value: cn("text-sm text-ink-900 dark:text-white", classNames?.value),
        popoverContent: cn("shadow-pop border border-ink-200 dark:border-white/10", classNames?.popoverContent),
      }}
      {...props}
    />
  );
}) as typeof HeroSelect;

// Autocomplete renders its own internal Input; style it through inputProps
export const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(function Autocomplete({ inputProps, popoverProps, ...props }, ref) {
  return (
    <HeroAutocomplete
      ref={ref}
      inputProps={{
        ...inputProps,
        classNames: {
          ...inputProps?.classNames,
          label: cn(FIELD_LABEL, inputProps?.classNames?.label),
          inputWrapper: cn(FIELD_WRAPPER, inputProps?.classNames?.inputWrapper),
          input: cn(FIELD_INPUT, inputProps?.classNames?.input),
        },
      }}
      popoverProps={{
        ...popoverProps,
        classNames: { ...popoverProps?.classNames, content: cn("shadow-pop border border-ink-200 dark:border-white/10", popoverProps?.classNames?.content) },
      }}
      {...props}
    />
  );
}) as typeof HeroAutocomplete;

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker({ classNames, ...props }, ref) {
  return (
    <HeroDatePicker
      ref={ref}
      classNames={{ ...classNames, label: cn(FIELD_LABEL, classNames?.label), inputWrapper: cn(FIELD_WRAPPER, classNames?.inputWrapper) }}
      {...props}
    />
  );
}) as typeof HeroDatePicker;

export const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(function DateRangePicker({ classNames, ...props }, ref) {
  return (
    <HeroDateRangePicker
      ref={ref}
      classNames={{ ...classNames, label: cn(FIELD_LABEL, classNames?.label), inputWrapper: cn(FIELD_WRAPPER, classNames?.inputWrapper) }}
      {...props}
    />
  );
}) as typeof HeroDateRangePicker;

// ── Tabs ─────────────────────────────────────────────────────────────────────

// One look for every tab bar: underlined, uppercase tracked labels, brand cursor.
// (Some pages pass variant="full", which HeroUI doesn't have — it is ignored here.)
function ThemedTabs({ classNames, variant: _variant, ...props }: TabsProps) {
  return (
    <HeroTabs
      variant="underlined"
      classNames={{
        ...classNames,
        tabList: cn("gap-4 border-b border-ink-200 dark:border-white/10 p-0", classNames?.tabList),
        cursor: cn("bg-brand-600 h-0.5", classNames?.cursor),
        tab: cn("h-10 px-1 text-xs font-medium uppercase tracking-wide", classNames?.tab),
        tabContent: cn("text-ink-500 dark:text-ink-400 group-data-[selected=true]:text-ink-900 dark:group-data-[selected=true]:text-white", classNames?.tabContent),
      }}
      {...props}
    />
  );
}
// Tabs is generic over its items (render-function children); keep that typing
export const Tabs = ThemedTabs as typeof HeroTabs;

export function Pagination({ classNames, ...props }: PaginationProps) {
  return (
    <HeroPagination
      classNames={{
        ...classNames,
        cursor: cn("bg-brand-600 text-white font-bold", classNames?.cursor),
        item: cn("bg-transparent text-ink-700 dark:text-ink-200 data-[hover=true]:bg-ink-100 dark:data-[hover=true]:bg-ink-800", classNames?.item),
      }}
      {...props}
    />
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, shadow = "none", ...props }, ref) {
  return (
    <HeroCard
      ref={ref}
      className={cn("border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900", className)}
      shadow={shadow}
      {...props}
    />
  );
});

export const Chip = forwardRef<HTMLDivElement, ChipProps>(function Chip({ classNames, ...props }, ref) {
  return (
    <HeroChip
      ref={ref}
      classNames={{ ...classNames, content: cn("font-medium uppercase tracking-chip text-[10.5px]", classNames?.content) }}
      {...props}
    />
  );
});

export function Modal({ classNames, ...props }: ModalProps) {
  return <HeroModal classNames={{ ...classNames, base: cn("shadow-pop", classNames?.base) }} {...props} />;
}
