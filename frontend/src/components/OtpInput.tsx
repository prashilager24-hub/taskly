import { useRef } from "react";

// Six single-digit boxes for the emailed sign-in code (requirement AUTH-09):
// auto-advance, Backspace steps back, paste fills all boxes, digits only.

interface Props {
    value: string;
    onChange: (code: string) => void;
    onComplete?: (code: string) => void;
    length?: number;
    isInvalid?: boolean;
    isDisabled?: boolean;
}

export default function OtpInput({ value, onChange, onComplete, length = 6, isInvalid, isDisabled }: Props) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = Array.from({ length }, (_, i) => value[i] ?? "");

    const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

    const update = (next: string) => {
        const code = next.replace(/\D/g, "").slice(0, length);
        onChange(code);
        if (code.length === length) onComplete?.(code);
    };

    return (
        <div className="flex justify-center gap-2" role="group" aria-label="Sign-in code">
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    autoFocus={i === 0}
                    maxLength={1}
                    disabled={isDisabled}
                    aria-label={`Digit ${i + 1} of ${length}`}
                    aria-invalid={isInvalid || undefined}
                    className={`h-12 w-11 border bg-white text-center text-xl font-bold text-ink-900 outline-none transition-colors
                        focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40 dark:bg-ink-900 dark:text-white
                        ${isInvalid ? "border-rose-500" : "border-ink-300 dark:border-white/15"}`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                        const typed = e.target.value.replace(/\D/g, "");
                        if (!typed) return;
                        // A whole code typed or autofilled into one box spreads across all of them
                        if (typed.length > 1) {
                            update(typed);
                            focus(typed.length);
                            return;
                        }
                        const next = digits.slice();
                        next[i] = typed;
                        update(next.join(""));
                        focus(i + 1);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Backspace") {
                            e.preventDefault();
                            const next = digits.slice();
                            if (next[i]) {
                                next[i] = "";
                            } else if (i > 0) {
                                next[i - 1] = "";
                                focus(i - 1);
                            }
                            onChange(next.join("").slice(0, length));
                        } else if (e.key === "ArrowLeft") {
                            focus(i - 1);
                        } else if (e.key === "ArrowRight") {
                            focus(i + 1);
                        }
                    }}
                    onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                        if (!pasted) return;
                        update(pasted);
                        focus(pasted.length);
                    }}
                />
            ))}
        </div>
    );
}
