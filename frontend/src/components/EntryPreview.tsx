import { useCallback, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui";

// Daily Activity entry flow (requirements DA-05 – DA-07): Fill → Preview → Save.
// Preview shows a read-only summary; "Yes" runs the add, "No" returns to the form untouched.

export interface PreviewRow {
    label: string;
    value: React.ReactNode;
}

interface PendingPreview {
    title: string;
    rows: PreviewRow[];
    onConfirm: () => void;
}

export interface AddedSummary { kind: string; name: string; detail: string }

export function useEntryPreview(getAdded?: () => AddedSummary[]) {
    const [pending, setPending] = useState<PendingPreview | null>(null);
    const confirmRef = useRef<(() => void) | null>(null);

    const openPreview = useCallback((title: string, rows: PreviewRow[], onConfirm: () => void) => {
        confirmRef.current = onConfirm;
        setPending({ title, rows, onConfirm });
    }, []);

    const close = () => setPending(null);
    const confirm = () => {
        confirmRef.current?.();
        setPending(null);
    };

    const added = pending ? getAdded?.() ?? [] : [];
    const modal = (
        <Modal isOpen={!!pending} onOpenChange={(open) => { if (!open) close(); }} size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <span className="eyebrow">Preview</span>
                    <span className="text-base font-bold">{pending?.title}</span>
                </ModalHeader>
                <ModalBody className="gap-5">
                    <section>
                        <h4 className="eyebrow mb-2">This entry</h4>
                        <dl className="divide-y divide-ink-200 border border-ink-200 dark:divide-white/10 dark:border-white/10">
                            {pending?.rows.map((r) => (
                                <div key={r.label} className="grid grid-cols-[40%_60%] gap-2 px-3 py-2 text-sm">
                                    <dt className="label-base mb-0 self-center">{r.label}</dt>
                                    <dd className="break-words text-ink-900 dark:text-white">
                                        {r.value === "" || r.value == null ? <span className="text-ink-400">—</span> : r.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                    {added.length > 0 && (
                        <section>
                            <h4 className="eyebrow mb-2">Already in today's log · {added.length}</h4>
                            <ul className="divide-y divide-ink-200 border border-ink-200 dark:divide-white/10 dark:border-white/10">
                                {added.map((a, i) => (
                                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                                        <span className="w-14 shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">{a.kind}</span>
                                        <span className="min-w-0 flex-1 truncate text-ink-900 dark:text-white">{a.name}</span>
                                        <span className="shrink-0 text-ink-600 dark:text-ink-300">{a.detail}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                        Save adds this entry to today's log. Nothing is sent to Taskly until you submit the log. Choose Keep editing to change anything first.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={close}>Keep editing</Button>
                    <Button color="primary" startContent={<Check size={14} />} onPress={confirm}>Save entry</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );

    return { openPreview, previewOpen: !!pending, previewModal: modal };
}

/** Fill → Preview → Save indicator shown above the entry form */
export function EntrySteps({ step }: { step: 1 | 2 | 3 }) {
    const steps = ["Fill", "Preview", "Save"];
    return (
        <ol className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-label" aria-label="Entry steps">
            {steps.map((label, i) => {
                const n = i + 1;
                const state = n < step ? "done" : n === step ? "current" : "todo";
                return (
                    <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
                        <span
                            className={`flex h-5 w-5 items-center justify-center border text-[10px] ${
                                state === "todo"
                                    ? "border-ink-300 text-ink-400 dark:border-white/15"
                                    : "border-brand-600 bg-brand-600 text-white"
                            }`}
                        >
                            {state === "done" ? <Check size={11} /> : n}
                        </span>
                        <span className={state === "todo" ? "text-ink-400" : "text-ink-900 dark:text-white"}>{label}</span>
                        {n < steps.length && <span className="h-px w-6 bg-ink-200 dark:bg-white/10" />}
                    </li>
                );
            })}
        </ol>
    );
}
