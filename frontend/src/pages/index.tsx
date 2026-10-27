import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Moon, ShieldCheck, Sun } from "lucide-react";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@heroui/shared-icons";

import { Button, Card, CardBody, Checkbox, Input, addToast } from "@/components/ui";
import OtpInput from "@/components/OtpInput";
import { title } from "@/components/primitives";
import { subscribeToPush } from "../lib/pushClient";
import { SIGN_OUT_MESSAGES, saveSession } from "../lib/session";
import { getTheme, setTheme, type Theme } from "../lib/theme";

// Sign-in (requirements AUTH-01 – AUTH-11): password → emailed code → (first time) theme → app.

const API = "/t2.0/authentificationUtilization";

type Step = "credentials" | "otp" | "theme" | "forgot";

interface Challenge {
  challengeId: string;
  maskedEmail: string;
  resendAfter: number;
  devOtp?: string;
}

const errorMessage = (err: any, fallback: string) =>
  err?.response?.data?.errors?.code?.[0] ?? err?.response?.data?.message ?? fallback;

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signedOutReason = SIGN_OUT_MESSAGES[params.get("reason") ?? ""];

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resendsLeft, setResendsLeft] = useState(3);

  const [forgetEmail, setForgetEmail] = useState("");
  const [chosenTheme, setChosenTheme] = useState<Theme>(getTheme());
  const [pendingUser, setPendingUser] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem("authUserLD")) navigate("/dashboard");
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (next: Step) => {
    setError("");
    setStep(next);
  };

  // ── Step 1: password ──────────────────────────────────────────────────────
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/authenticate`, { username: email, password, keepSignedIn });
      if (!data.otpRequired) {
        setError(data.authorization === "Account is inactive"
          ? "This account is inactive. Contact your administrator."
          : "Incorrect email or password.");
        return;
      }
      setChallenge(data);
      setCode("");
      setResendIn(data.resendAfter ?? 30);
      setResendsLeft(3);
      go("otp");
    } catch (err: any) {
      setError(errorMessage(err, "Sign-in failed. Try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: emailed code ──────────────────────────────────────────────────
  const verify = async (value = code) => {
    if (!challenge || value.length !== 6 || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/authenticate/verify-otp`, { challengeId: challenge.challengeId, code: value });
      saveSession(data, keepSignedIn);
      try {
        const roleRes = await axios.get(`${API}/AMRole/${data.userRole}`, { headers: { Authorization: `Bearer ${data.token}` } });
        if (roleRes.data?.status) localStorage.setItem("roles", JSON.stringify(roleRes.data.response || {}));
      } catch {
        /* without role privileges the sidebar shows fewer items; signing in still succeeds */
      }
      if (data.themePreference === "dark" || data.themePreference === "light") {
        setTheme(data.themePreference, { save: false });
        finish(data);
      } else {
        setPendingUser(data);
        go("theme");
      }
    } catch (err: any) {
      setCode("");
      setError(errorMessage(err, "That code could not be verified."));
    } finally {
      setIsLoading(false);
    }
  };

  const resend = async () => {
    if (!challenge || resendIn > 0) return;
    setError("");
    try {
      const { data } = await axios.post(`${API}/authenticate/resend-otp`, { challengeId: challenge.challengeId });
      setChallenge({ ...challenge, devOtp: data.devOtp });
      setResendIn(data.resendAfter ?? 30);
      setResendsLeft(data.resendsLeft ?? 0);
      setCode("");
      addToast({ title: "New code sent", description: `Check ${challenge.maskedEmail}.`, color: "success" });
    } catch (err: any) {
      setError(errorMessage(err, "Could not send a new code."));
    }
  };

  // ── Step 3 (first sign-in only): theme ───────────────────────────────────
  const saveThemeAndContinue = () => {
    setTheme(chosenTheme); // also saves it to the profile
    finish(pendingUser);
  };

  const finish = (user: any) => {
    addToast({ title: "Signed in", description: `Welcome back, ${user?.name ?? ""}.`, color: "success" });
    subscribeToPush().catch(() => undefined);
    navigate("/dashboard");
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgetEmail.trim()) return;
    setIsLoading(true);
    try {
      await axios.post(`${API}/forgotPassword`, { email: forgetEmail });
      addToast({ title: "Reset email sent", description: "Check your inbox to reset your password.", color: "success" });
      setForgetEmail("");
      go("credentials");
    } catch {
      setError("That email was not found, or the email could not be sent.");
    } finally {
      setIsLoading(false);
    }
  };

  const errorBox = error && (
    <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      {error}
    </p>
  );

  return (
    <section className="flex min-h-[100vh] flex-col items-center justify-center py-8">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <img src="/Tapmind.ico" alt="Taskly logo" className="h-10 w-10" />
            <h1 className={title({ size: "sm" })} style={{ color: "white" }}>Welcome to Taskly</h1>
          </div>
          <p className="mt-2 text-white/80">Sign in to your account</p>
        </div>

        <Card className="w-full">
          <CardBody className="gap-5 p-6">
            {step === "credentials" && (
              <form onSubmit={submitCredentials} className="flex flex-col gap-4">
                <h2 className="text-lg font-bold">Sign in</h2>
                {signedOutReason && !error && (
                  <p role="status" className="border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                    {signedOutReason}
                  </p>
                )}
                {errorBox}
                <Input type="email" label="Email" labelPlacement="outside" placeholder="you@tapmind.com"
                  autoComplete="username" value={email} onValueChange={setEmail} isRequired />
                <Input label="Password" labelPlacement="outside" placeholder="Enter your password"
                  autoComplete="current-password" value={password} onValueChange={setPassword} isRequired
                  type={isVisible ? "text" : "password"}
                  endContent={
                    <button type="button" onClick={() => setIsVisible(!isVisible)} aria-label={isVisible ? "Hide password" : "Show password"}>
                      {isVisible ? <EyeSlashFilledIcon className="text-2xl text-ink-400" /> : <EyeFilledIcon className="text-2xl text-ink-400" />}
                    </button>
                  }
                />
                <div className="flex items-center justify-between">
                  <Checkbox size="sm" isSelected={keepSignedIn} onValueChange={setKeepSignedIn}>
                    <span className="text-sm">Keep me signed in for 7 days</span>
                  </Checkbox>
                  <button type="button" className="text-sm text-brand-600 hover:underline dark:text-brand-400" onClick={() => go("forgot")}>
                    Forgot password?
                  </button>
                </div>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {keepSignedIn
                    ? "You stay signed in on this device for 7 days."
                    : "You are signed out after 1 day, or when you close this tab."}
                </p>
                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={isLoading}>
                  Continue
                </Button>
              </form>
            )}

            {step === "otp" && challenge && (
              <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="flex flex-col gap-5">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <Mail size={20} />
                  </span>
                  <h2 className="text-lg font-bold">Check your email</h2>
                  <p className="text-sm text-ink-500 dark:text-ink-400">
                    We sent a 6-digit code to <span className="font-medium text-ink-900 dark:text-white">{challenge.maskedEmail}</span>.
                    It expires in 5 minutes.
                  </p>
                </div>
                <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={verify}
                  isInvalid={!!error} isDisabled={isLoading} />
                {errorBox}
                {challenge.devOtp && import.meta.env.DEV && (
                  <p className="text-center text-xs text-ink-500">
                    Development only — email is not configured. Your code is <span className="font-bold">{challenge.devOtp}</span>.
                  </p>
                )}
                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={isLoading}
                  isDisabled={code.length !== 6} startContent={!isLoading && <ShieldCheck size={16} />}>
                  Verify and sign in
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" className="flex items-center gap-1 text-ink-600 hover:underline dark:text-ink-300"
                    onClick={() => { setChallenge(null); go("credentials"); }}>
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                  {resendsLeft > 0 ? (
                    <button type="button" disabled={resendIn > 0} onClick={resend}
                      className="text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-400 disabled:no-underline dark:text-brand-400"
                      aria-live="polite">
                      {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, "0")}` : "Resend code"}
                    </button>
                  ) : (
                    <span className="text-ink-400">No more resends</span>
                  )}
                </div>
              </form>
            )}

            {step === "theme" && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <h2 className="text-lg font-bold">Choose your theme</h2>
                  <p className="text-sm text-ink-500 dark:text-ink-400">
                    Taskly will use it every time you sign in. You can change it later from the top bar.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
                  {([["light", "Light", Sun], ["dark", "Dark", Moon]] as const).map(([value, label, Icon]) => (
                    <button key={value} type="button" role="radio" aria-checked={chosenTheme === value}
                      onClick={() => { setChosenTheme(value); setTheme(value, { save: false }); }}
                      className={`flex flex-col items-center gap-2 border p-4 transition-colors focus-ring ${
                        chosenTheme === value ? "border-brand-600 bg-brand-50 dark:bg-brand-500/15" : "border-ink-200 hover:border-ink-300 dark:border-white/10"
                      }`}>
                      <span className={`flex h-16 w-full items-center justify-center border ${value === "dark" ? "border-white/10 bg-ink-950 text-white" : "border-ink-200 bg-white text-ink-900"}`}>
                        <Icon size={22} />
                      </span>
                      <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
                    </button>
                  ))}
                </div>
                <Button color="primary" size="lg" className="w-full" onPress={saveThemeAndContinue}>
                  Continue
                </Button>
              </div>
            )}

            {step === "forgot" && (
              <form onSubmit={submitForgot} className="flex flex-col gap-4">
                <h2 className="text-lg font-bold">Reset password</h2>
                {errorBox}
                <Input type="email" label="Registered email" labelPlacement="outside" placeholder="you@tapmind.com"
                  value={forgetEmail} onValueChange={setForgetEmail} isRequired />
                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={isLoading}>
                  Send reset link
                </Button>
                <button type="button" className="flex items-center justify-center gap-1 text-sm text-ink-600 hover:underline dark:text-ink-300"
                  onClick={() => go("credentials")}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
