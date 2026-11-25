import { useEffect, useState } from "react";
import axios from "axios";
import { Check, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { addToast, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui";
import { isSwitchedUser } from "@/components/userSwitch";

/**
 * Signed in with a temporary password (new user or People Hub invitation): the person must choose their own password
 * before using the app. The popup cannot be closed; signing out is the only other way out. Two-factor sign-in applies
 * from the next sign-in on.
 */
const RULES: { label: string; ok: (p: string) => boolean }[] = [
  { label: "At least 8 characters", ok: (p) => p.length >= 8 },
  { label: "A letter", ok: (p) => /[A-Za-z]/.test(p) },
  { label: "A number", ok: (p) => /[0-9]/.test(p) },
];

const readMe = () => { try { return JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { return null; } };

export default function ForcePasswordChange() {
  const [open, setOpen] = useState(() => !!readMe()?.mustChangePassword && !isSwitchedUser());
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // the server is the source of truth (e.g. an invitation sent while signed in elsewhere)
  useEffect(() => {
    if (isSwitchedUser() || !readMe()) return;
    axios.get("/t2.0/authentificationUtilization/access/me").then((r) => {
      const must = r.data?.response?.mustChangePassword;
      if (typeof must === "boolean") setOpen(must);
    }).catch(() => undefined);
  }, []);

  const passes = RULES.every((r) => r.ok(pw));
  const ready = passes && pw === confirm;
  const save = () => {
    if (!ready || busy) return;
    setBusy(true); setErr("");
    axios.post("/t2.0/authentificationUtilization/user/change-password", { newPassword: pw })
      .then(() => {
        const me = readMe();
        if (me) { me.mustChangePassword = false; localStorage.setItem("authUserLD", JSON.stringify(me)); }
        setOpen(false);
        addToast({ title: "Password set", description: "Use your new password next time. Sign-in will also ask for the emailed code.", color: "success" });
      })
      .catch((e) => setErr(e?.response?.data?.message ?? e?.response?.data?.errors?.newPassword?.[0] ?? "Could not change the password. Please try again."))
      .finally(() => setBusy(false));
  };

  if (!open) return null;
  return (
    <Modal isOpen isDismissable={false} isKeyboardDismissDisabled hideCloseButton size="md" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="flex items-center gap-2"><KeyRound size={18} className="text-brand-600" />Set your own password</span>
          <span className="text-xs font-normal text-ink-500">You signed in with a temporary password. Choose a new one to continue; you'll use it from now on.</span>
        </ModalHeader>
        <ModalBody className="gap-3">
          <Input label="New password" size="sm" type={show ? "text" : "password"} value={pw} onValueChange={setPw} autoFocus autoComplete="new-password"
            endContent={<button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="text-ink-500 focus-ring">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
          <Input label="Confirm new password" size="sm" type={show ? "text" : "password"} value={confirm} onValueChange={setConfirm} autoComplete="new-password"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            isInvalid={confirm !== "" && confirm !== pw} errorMessage={confirm !== "" && confirm !== pw ? "The passwords do not match" : undefined} />
          <ul className="space-y-1 text-xs">
            {RULES.map((r) => {
              const ok = r.ok(pw);
              return <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-ink-500"}`}>{ok ? <Check size={13} /> : <X size={13} />}{r.label}</li>;
            })}
          </ul>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={() => { window.location.href = "/logout"; }}>Sign out</Button>
          <Button color="primary" isDisabled={!ready} isLoading={busy} onPress={save}>Set password</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
