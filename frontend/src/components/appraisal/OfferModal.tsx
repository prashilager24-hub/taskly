import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type CycleView, type RequestField } from "./api";
import { inr } from "./format";

type Step = "offer" | "confirm" | "reject";

/**
 * The pop-up the Associate gets once the EL has approved the final amount: the amount, how it splits, and two buttons.
 * Accept asks once more because it is final; Reject asks for the months, the reason and what the Associate expects.
 * Nothing about the assessors, their comments or any budget is shown here.
 */
export default function OfferModal({ view, open, onOpenChange, onDone }: { view: CycleView; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
    const id = view.cycle.id;
    const a = view.approved;
    const [step, setStep] = useState<Step>("offer");
    const [busy, setBusy] = useState(false);
    const [months, setMonths] = useState<"3" | "6">("3");
    const [reason, setReason] = useState("");
    const [expectations, setExpectations] = useState("");
    const [comment, setComment] = useState("");

    const run = async (fn: () => Promise<unknown>, done: string) => {
        setBusy(true);
        try { await fn(); addToast({ title: done, color: "success" }); onOpenChange(false); setStep("offer"); onDone(); }
        catch (e) { addToast({ title: "Could not send your answer", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };
    const close = (o: boolean) => { onOpenChange(o); if (!o) setStep("offer"); };
    // The changes the person asked for, with the EL's decision on each (the decision only, never the words)
    const asked: { field: RequestField; label: string; value: string }[] = [
        ...(view.request?.newDesignation ? [{ field: "DESIGNATION" as const, label: "Designation", value: view.request.newDesignation }] : []),
        ...(view.request?.newTeam ? [{ field: "TEAM" as const, label: "Team", value: view.request.newTeam }] : []),
    ];

    return (
        <Modal isOpen={open} onOpenChange={close} size="lg" scrollBehavior="inside" backdrop="blur">
            <ModalContent>
                {(onClose) => (
                    <>
                        {step === "offer" && (
                            <>
                                <ModalHeader className="flex flex-col gap-1">
                                    <span className="eyebrow">Your appraisal</span>
                                    <span className="text-lg font-bold text-ink-900 dark:text-white">Your final amount is approved</span>
                                </ModalHeader>
                                <ModalBody>
                                    <div className="flex flex-col gap-5 pb-2">
                                        <div className="border border-brand-600 bg-brand-50 p-5 dark:bg-brand-600/10">
                                            <p className="eyebrow">Hike per year</p>
                                            <p className="mt-2 text-4xl font-bold leading-none tracking-tight text-ink-900 dark:text-white">{inr(a?.annual)}</p>
                                        </div>
                                        <dl className="grid grid-cols-3 gap-3">
                                            {[["Fixed pay", a?.fixed], ["Variable pay", a?.variable], ["Half-yearly", a?.variablePerHalfYear]].map(([k, v]) => (
                                                <div key={k as string} className="border border-ink-200 p-3 dark:border-white/10"><dt className="eyebrow">{k as string}</dt><dd className="mt-1.5 text-lg font-bold text-ink-900 dark:text-white">{inr(v as number)}</dd></div>
                                            ))}
                                        </dl>
                                        {asked.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <p className="eyebrow">Your requested changes</p>
                                                <ul className="flex flex-col divide-y divide-ink-100 border border-ink-200 dark:divide-white/5 dark:border-white/10">
                                                    {asked.map((x) => {
                                                        const d = view.requestReviews?.[x.field]?.A2?.decision ?? null;
                                                        return (
                                                            <li key={x.field} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                                                <span className="min-w-0 text-ink-800 dark:text-ink-100"><span className="text-ink-500">{x.label}:</span> {x.value}</span>
                                                                <Chip size="sm" variant="flat" color={d === "APPROVED" ? "success" : d === "REJECTED" ? "danger" : "default"}>{d === "APPROVED" ? "Approved" : d === "REJECTED" ? "Not approved" : "No decision"}</Chip>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-sm text-ink-500 dark:text-ink-400">Variable pay is paid in two equal halves each year. You can accept this hike, or reject it and have it postponed by 3 or 6 months. There is no counter-offer.</p>
                                    </div>
                                </ModalBody>
                                <ModalFooter className="justify-between">
                                    <Button variant="light" onPress={onClose}>Decide later</Button>
                                    <div className="flex gap-3">
                                        <Button variant="bordered" color="danger" onPress={() => setStep("reject")}>Reject</Button>
                                        <Button color="success" onPress={() => setStep("confirm")}>Accept</Button>
                                    </div>
                                </ModalFooter>
                            </>
                        )}

                        {step === "confirm" && (
                            <>
                                <ModalHeader className="flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-white"><CheckCircle2 size={20} className="text-emerald-600" />Accept {inr(a?.annual)} a year?</ModalHeader>
                                <ModalBody><p className="pb-2 text-sm text-ink-600 dark:text-ink-300">Accepting confirms your hike ({inr(a?.fixed)} fixed and {inr(a?.variable)} variable) and records the final decision. It cannot be changed afterwards.</p></ModalBody>
                                <ModalFooter>
                                    <Button variant="light" isDisabled={busy} onPress={() => setStep("offer")}>Back</Button>
                                    <Button color="success" isLoading={busy} onPress={() => run(() => appraisalApi.accept(id), "Hike accepted")}>Yes, accept</Button>
                                </ModalFooter>
                            </>
                        )}

                        {step === "reject" && (
                            <>
                                <ModalHeader className="flex flex-col gap-1"><span className="text-lg font-bold text-ink-900 dark:text-white">Reject and postpone</span><span className="text-sm font-normal text-ink-500">Tell us why, and what you expect, so HR can follow up.</span></ModalHeader>
                                <ModalBody>
                                    <div className="flex flex-col gap-4 pb-2">
                                        <Select label="Postpone my hike by" selectedKeys={[months]} onSelectionChange={(k) => { const v = Array.from(k)[0]; if (v) setMonths(String(v) as "3" | "6"); }} disallowEmptySelection>
                                            <SelectItem key="3">3 months</SelectItem>
                                            <SelectItem key="6">6 months</SelectItem>
                                        </Select>
                                        <Textarea label="Reason for rejecting" value={reason} onValueChange={setReason} minRows={3} isRequired />
                                        <Textarea label="What I expect" value={expectations} onValueChange={setExpectations} minRows={3} isRequired />
                                        <Textarea label="Comment (optional)" value={comment} onValueChange={setComment} minRows={2} />
                                    </div>
                                </ModalBody>
                                <ModalFooter>
                                    <Button variant="light" isDisabled={busy} onPress={() => setStep("offer")}>Back</Button>
                                    <Button color="danger" isLoading={busy} isDisabled={!reason.trim() || !expectations.trim()}
                                        onPress={() => run(() => appraisalApi.reject(id, { postponeMonths: Number(months) as 3 | 6, reason: reason.trim(), expectations: expectations.trim(), comment: comment.trim() || undefined }), "Offer rejected, hike postponed")}>
                                        Reject offer
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
