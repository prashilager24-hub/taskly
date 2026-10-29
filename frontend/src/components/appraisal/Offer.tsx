import { useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, addToast } from "@/components/ui";
import { Panel } from "@/components/page";
import { appraisalApi, errorText, type CycleView } from "./api";
import { day } from "./format";
import { Banner, MoneyCard, ReadText } from "./parts";

/** The offer: ratings, the approved hike as annual / fixed / variable, and two buttons only. There is no counter-offer. */
export default function Offer({ view, onDone }: { view: CycleView; onDone: () => void }) {
    const id = view.cycle.id;
    const open = !!view.can.respond;
    const [confirm, setConfirm] = useState(false);
    const [reject, setReject] = useState(false);
    const [busy, setBusy] = useState(false);
    const [months, setMonths] = useState<"3" | "6">("3");
    const [reason, setReason] = useState("");
    const [expectations, setExpectations] = useState("");
    const [comment, setComment] = useState("");

    const run = async (fn: () => Promise<unknown>, done: string) => {
        setBusy(true);
        try { await fn(); addToast({ title: done, color: "success" }); setConfirm(false); setReject(false); onDone(); }
        catch (e) { addToast({ title: "Could not send your answer", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    const a1 = view.assessors?.A1;
    const a2 = view.assessors?.A2;
    const r = view.response;

    return (
        <Panel title={open ? "Your offer" : "Your decision"}>
            <div className="flex flex-col gap-5">
                {open && <Banner>Your hike is ready. You can <b>accept</b> it, or <b>reject</b> it to postpone the hike by 3 or 6 months. There is no counter-offer.</Banner>}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <MoneyCard title="Approved hike" money={view.approved} accent />
                    <div className="flex flex-col gap-3 border border-ink-200 p-4 dark:border-white/10">
                        <p className="eyebrow">Your ratings</p>
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div><dt className="text-xs text-ink-500">{view.cycle.assessor1?.name ?? "Assessor 1"}</dt><dd className="mt-0.5 text-2xl font-bold leading-none text-ink-900 dark:text-white">{a1?.overallRating ?? "—"}<span className="ml-1 text-xs font-normal text-ink-500">/ 5</span></dd></div>
                            <div><dt className="text-xs text-ink-500">{view.cycle.assessor2?.name ?? "Assessor 2"}</dt><dd className="mt-0.5 text-2xl font-bold leading-none text-ink-900 dark:text-white">{a2?.overallRating ?? "—"}<span className="ml-1 text-xs font-normal text-ink-500">/ 5</span></dd></div>
                        </dl>
                        {(a1?.comment || a2?.comment) && (
                            <div className="flex flex-col gap-2 border-t border-ink-200 pt-3 dark:border-white/10">
                                {a1?.comment && <ReadText label={`Comment · ${view.cycle.assessor1?.name ?? "Assessor 1"}`} value={a1.comment} />}
                                {a2?.comment && <ReadText label={`Comment · ${view.cycle.assessor2?.name ?? "Assessor 2"}`} value={a2.comment} />}
                            </div>
                        )}
                    </div>
                </div>

                {open && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
                        <Button variant="bordered" color="danger" onPress={() => setReject(true)}>Reject</Button>
                        <Button color="success" onPress={() => setConfirm(true)}>Accept</Button>
                    </div>
                )}

                {!open && r && (
                    <div className="flex flex-col gap-3 border-t border-ink-200 pt-4 dark:border-white/10">
                        {r.decision === "ACCEPT" ? (
                            <Banner>You accepted this hike on {day(r.decidedAt)}. It is final.</Banner>
                        ) : (
                            <>
                                <Banner tone="warn">You rejected this offer on {day(r.decidedAt)}. The hike is postponed by {r.postponeMonths} months, to <b>{day(view.cycle.postponedUntil)}</b>. HR status: <b>{r.hrStatus === "APPROVED" ? "approved" : r.hrStatus === "RETURNED" ? "returned" : "waiting"}</b>.</Banner>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><ReadText label="Your reason" value={r.reason} /><ReadText label="What you expect" value={r.expectations} /></div>
                                {r.hrComment && <ReadText label="HR comment" value={r.hrComment} />}
                            </>
                        )}
                    </div>
                )}
            </div>

            <Modal isOpen={confirm} onOpenChange={setConfirm} size="md">
                <ModalContent>
                    {(close) => (
                        <>
                            <ModalHeader>Accept this hike?</ModalHeader>
                            <ModalBody><p className="text-sm text-ink-600 dark:text-ink-300">Accepting confirms the hike and records the final decision. It cannot be changed afterwards.</p></ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={close}>Cancel</Button>
                                <Button color="success" isLoading={busy} onPress={() => run(() => appraisalApi.accept(id), "Hike accepted")}>Yes, accept</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={reject} onOpenChange={setReject} size="lg">
                <ModalContent>
                    {(close) => (
                        <>
                            <ModalHeader>Reject and postpone</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <Select label="Postpone the hike by" selectedKeys={[months]} onSelectionChange={(k) => { const v = Array.from(k)[0]; if (v) setMonths(String(v) as "3" | "6"); }} disallowEmptySelection>
                                        <SelectItem key="3">3 months</SelectItem>
                                        <SelectItem key="6">6 months</SelectItem>
                                    </Select>
                                    <Textarea label="Reason for the postponement" value={reason} onValueChange={setReason} minRows={3} isRequired />
                                    <Textarea label="What you expect" value={expectations} onValueChange={setExpectations} minRows={3} isRequired />
                                    <Textarea label="Comment (optional)" value={comment} onValueChange={setComment} minRows={2} />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={close}>Cancel</Button>
                                <Button color="danger" isLoading={busy} isDisabled={!reason.trim() || !expectations.trim()}
                                    onPress={() => run(() => appraisalApi.reject(id, { postponeMonths: Number(months) as 3 | 6, reason: reason.trim(), expectations: expectations.trim(), comment: comment.trim() || undefined }), "Offer rejected, hike postponed")}>
                                    Reject offer
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </Panel>
    );
}
