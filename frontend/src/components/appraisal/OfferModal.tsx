import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, addToast } from "@/components/ui";
import { appraisalApi, errorText, type MyView } from "./api";
import { COLS2 } from "./parts";
import { inr } from "./format";

const empty = { newDesignation: "", designationComment: "", newTeam: "", teamComment: "" };

/**
 * Accepting the hike. Before it is final, the person may ask for a new designation and / or a new team, each with a reason.
 * Both are optional. An Associate's / Intern's request goes to their FL, who forwards it to the EL; anyone else's goes to the EL.
 */
export function AcceptModal({ view, open, onOpenChange, onDone }: { view: MyView; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
    const a = view.approved;
    const [req, setReq] = useState(empty);
    const [busy, setBusy] = useState(false);
    const asking = view.can.ask && !!(req.newDesignation.trim() || req.newTeam.trim());
    const viaFl = view.route.source === "FL_TEAM";
    const goesTo = viaFl ? `${view.route.fl?.name ?? "your FL"}, who passes it to ${view.route.el?.name ?? "your EL"} for the decision` : `${view.route.el?.name ?? "your EL"}, who gives the decision`;

    const accept = async () => {
        setBusy(true);
        try {
            await appraisalApi.accept(view.cycle.id, asking ? req : undefined);
            addToast({ title: "Hike accepted", description: asking ? `Your request goes to ${goesTo}.` : undefined, color: "success" });
            onOpenChange(false); setReq(empty); onDone();
        } catch (e) { addToast({ title: "Could not accept", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside" backdrop="blur">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-white"><CheckCircle2 size={20} className="text-emerald-600" />Accept {inr(a?.annual)} a year</span>
                            <span className="text-sm font-normal text-ink-500">{inr(a?.fixed)} fixed and {inr(a?.variable)} variable. Accepting is final.</span>
                        </ModalHeader>
                        <ModalBody>
                            {view.can.ask ? <div className="flex flex-col gap-4 pb-2">
                                <div>
                                    <p className="text-sm font-semibold text-ink-900 dark:text-white">Would you like to ask for a change in designation or team?</p>
                                    <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">This is optional. Leave it empty if you don't need a change right now. Anything you ask for goes to {goesTo}.</p>
                                </div>
                                <div className={COLS2}>
                                    <Input label="New designation (optional)" value={req.newDesignation} onValueChange={(v) => setReq((r) => ({ ...r, newDesignation: v }))} />
                                    <Input label="Reason for the designation change" value={req.designationComment} isDisabled={!req.newDesignation.trim()} onValueChange={(v) => setReq((r) => ({ ...r, designationComment: v }))} />
                                    <Input label="New team (optional)" value={req.newTeam} onValueChange={(v) => setReq((r) => ({ ...r, newTeam: v }))} />
                                    <Input label="Reason for the team change" value={req.teamComment} isDisabled={!req.newTeam.trim()} onValueChange={(v) => setReq((r) => ({ ...r, teamComment: v }))} />
                                </div>
                            </div> : <p className="pb-2 text-sm text-ink-500 dark:text-ink-400">Accept the hike you agreed with Management.</p>}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" isDisabled={busy} onPress={onClose}>Back</Button>
                            <Button color="success" isLoading={busy} onPress={accept}>{asking ? "Accept and send my requests" : "Accept, no change needed"}</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}

/** Rejecting the approved hike: it is postponed by 3 or 6 months, with a reason and what the employee expects */
export function RejectModal({ view, open, onOpenChange, onDone }: { view: MyView; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
    const [months, setMonths] = useState<"3" | "6">("3");
    const [reason, setReason] = useState("");
    const [expectations, setExpectations] = useState("");
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);

    const reject = async () => {
        setBusy(true);
        try {
            await appraisalApi.reject(view.cycle.id, { postponeMonths: Number(months) as 3 | 6, reason: reason.trim(), expectations: expectations.trim(), comment: comment.trim() || undefined });
            addToast({ title: "Offer rejected, hike postponed", color: "success" });
            onOpenChange(false); onDone();
        } catch (e) { addToast({ title: "Could not reject", description: errorText(e), color: "danger" }); }
        finally { setBusy(false); }
    };

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside" backdrop="blur">
            <ModalContent>
                {(onClose) => (
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
                            <Button variant="light" isDisabled={busy} onPress={onClose}>Back</Button>
                            <Button color="danger" isLoading={busy} isDisabled={!reason.trim() || !expectations.trim()} onPress={reject}>Reject offer</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
