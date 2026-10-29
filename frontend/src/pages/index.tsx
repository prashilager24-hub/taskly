import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Moon, Sun } from "lucide-react";

import { Button, Checkbox, addToast } from "@/components/ui";
import OtpInput from "@/components/OtpInput";
import { subscribeToPush } from "../lib/pushClient";
import { SIGN_OUT_MESSAGES, saveSession } from "../lib/session";
import { getTheme, setTheme, type Theme } from "../lib/theme";

// Sign-in (requirements AUTH-01 – AUTH-11): password → emailed code → (first time) theme → app.
// Split screen in the TapMind CRM style: editorial hero on the left, the form on the right.
// The page is always dark, whatever theme the app is in.

const API = "/t2.0/authentificationUtilization";

type Step = "credentials" | "otp" | "theme" | "forgot";

interface Challenge {
  challengeId: string;
  maskedEmail: string;
  resendAfter: number;
  devOtp?: string;
}

// Seeded by `npm run db:seed` / `db:seed:demo`; offered only in development
const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@tapmind.com", password: "Admin@123" },
  { role: "Executive Leader", email: "vikram.rao@tapmind.com", password: "Employee@123" },
  { role: "HR", email: "sneha.iyer@tapmind.com", password: "Employee@123" },
  { role: "Employee", email: "emp1@tapmind.com", password: "Employee@123" },
];

const STEP_EYEBROW: Record<Step, string> = {
  credentials: "01 — Access",
  otp: "02 — Verify",
  theme: "03 — Preferences",
  forgot: "01 — Recover",
};

const errorMessage = (err: any, fallback: string) =>
  err?.response?.data?.errors?.code?.[0] ?? err?.response?.data?.message ?? fallback;

const FIELD =
  "h-12 w-full border border-white/10 bg-white/[0.03] px-4 text-sm text-white placeholder:text-ink-500 outline-none transition-colors " +
  "hover:border-white/20 focus:border-brand-500 focus:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-brand-500/30";
const LABEL = "font-secondary text-[10.5px] font-medium uppercase tracking-label text-ink-400";
const LINK = "font-secondary text-[10.5px] font-medium uppercase tracking-label text-brand-500 transition-colors hover:text-brand-400 focus-ring";

function Hero() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/10 bg-black lg:flex lg:w-[56%] lg:flex-col">
      {/* Fine grid + a warm glow, both decorative */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-brand-600 blur-[160px] animate-glow-pulse" />

      <div className="relative flex items-center gap-3 px-12 pt-10">
        <img src="/Tapmind.ico" alt="" className="h-8 w-8" />
        <span className="text-sm font-bold uppercase tracking-btn text-white">Taskly</span>
        <span className="text-sm text-ink-500">/ TapMind</span>
      </div>

      <div className="relative my-auto px-12">
        <span className="inline-flex items-center gap-2 border border-brand-600/60 px-3 py-1.5 font-secondary text-[10.5px] font-medium uppercase tracking-chip text-brand-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Work & Performance Platform
        </span>
        <h1 className="mt-8 text-[clamp(2.75rem,5.2vw,5.25rem)] font-black uppercase leading-[0.92] tracking-display text-white">
          Plan the work.
          <br />
          <span className="text-brand-600">Measure what matters.</span>
        </h1>
        <p className="mt-8 max-w-md text-base leading-relaxed text-ink-400">
          Daily activity, targets, goals and performance reviews for every team — in one place, with the numbers your leaders need.
        </p>

        <dl className="mt-12 grid max-w-lg grid-cols-3 border-y border-white/10">
          {[["Daily", "Activity log"], ["Live", "Efficiency"], ["360°", "PMS reviews"]].map(([value, label], i) => (
            <div key={label} className={`py-5 ${i ? "border-l border-white/10 pl-5" : ""}`}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-xl font-bold text-white">{value}</dd>
              <dd className="mt-1 font-secondary text-[10.5px] uppercase tracking-label text-ink-500">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative flex items-center justify-between border-t border-white/10 px-12 py-5 font-secondary text-[10.5px] uppercase tracking-eyebrow text-ink-500">
        <span>Tasks · Targets · Goals · PMS</span>
        <span>© {new Date().getFullYear()} TapMind</span>
      </div>
    </aside>
  );
}

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
  const [showDemo, setShowDemo] = useState(false);

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
      if (data.token && data.otpRequired === false) {
        await completeSignIn(data);
        return;
      }
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

  // Stores the session and what this person may open, then continues (shared by the code step and by
  // sign-in without a code, when two-factor is off for the account)
  const completeSignIn = async (data: any) => {
    saveSession(data, keepSignedIn);
    try {
      const access = await axios.get(`${API}/access/me`, { headers: { Authorization: `Bearer ${data.token}` } });
      if (access.data?.status) localStorage.setItem("roles", JSON.stringify(access.data.response || {}));
    } catch {
      /* without access info the menu stays empty; signing in still succeeds */
    }
    if (data.themePreference === "dark" || data.themePreference === "light") {
      setTheme(data.themePreference, { save: false });
      finish(data);
    } else {
      setPendingUser(data);
      go("theme");
    }
  };

  // ── Step 2: emailed code ──────────────────────────────────────────────────
  const verify = async (value = code) => {
    if (!challenge || value.length !== 6 || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/authenticate/verify-otp`, { challengeId: challenge.challengeId, code: value });
      await completeSignIn(data);
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
    <p role="alert" className="border-l-2 border-rose-500 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {error}
    </p>
  );

  const heading = (text: string, sub: React.ReactNode) => (
    <header>
      <p className="font-secondary text-[10.5px] font-medium uppercase tracking-eyebrow text-brand-500">{STEP_EYEBROW[step]}</p>
      <h2 className="mt-4 text-4xl font-black uppercase tracking-title text-white">{text}</h2>
      <p className="mt-2 text-sm text-ink-400">{sub}</p>
    </header>
  );

  const backLink = (onPress: () => void) => (
    <button type="button" onClick={onPress} className={`${LINK} inline-flex items-center gap-1.5 !text-ink-400 hover:!text-white`}>
      <ArrowLeft size={13} /> Back to sign in
    </button>
  );

  return (
    // `dark` scopes the dark tokens to this page, so it looks the same in either app theme
    <div className="dark flex min-h-screen bg-ink-950 font-sans text-white">
      <Hero />

      <main className="relative flex flex-1 flex-col bg-ink-900">
        {/* Logo for small screens, where the hero is hidden */}
        <div className="flex items-center gap-3 px-6 pt-8 sm:px-12 lg:hidden">
          <img src="/Tapmind.ico" alt="" className="h-7 w-7" />
          <span className="text-sm font-bold uppercase tracking-btn">Taskly</span>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-12 animate-fade-in-up" key={step}>
          {step === "credentials" && (
            <form onSubmit={submitCredentials} className="flex flex-col gap-7">
              {heading("Sign in", "Use your TapMind work email.")}
              {signedOutReason && !error && (
                <p role="status" className="border-l-2 border-brand-500 bg-brand-500/10 px-4 py-3 text-sm text-brand-200">
                  {signedOutReason}
                </p>
              )}
              {errorBox}

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className={LABEL}>Work email</label>
                <input id="email" type="email" className={FIELD} placeholder="you@tapmind.com" autoComplete="username"
                  value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={LABEL}>Password</label>
                  <button type="button" className={LINK} onClick={() => { setForgetEmail(email); go("forgot"); }}>Forgot?</button>
                </div>
                <div className="relative">
                  <input id="password" type={isVisible ? "text" : "password"} className={`${FIELD} pr-12`} placeholder="••••••••"
                    autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setIsVisible(!isVisible)} aria-label={isVisible ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-500 transition-colors hover:text-white focus-ring">
                    {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="-mt-2 flex flex-col gap-1">
                <Checkbox size="sm" isSelected={keepSignedIn} onValueChange={setKeepSignedIn}>
                  <span className="text-sm text-ink-300">Keep me signed in for 7 days</span>
                </Checkbox>
                <p className="pl-7 text-xs text-ink-500">
                  {keepSignedIn ? "You stay signed in on this device for 7 days." : "Signed out after 1 day, or when you close this tab."}
                </p>
              </div>

              <Button type="submit" color="primary" size="lg" className="h-13 w-full" isLoading={isLoading}
                endContent={!isLoading && <ArrowRight size={16} />}>
                Sign in
              </Button>

              {import.meta.env.DEV && (
                <div className="text-center">
                  <button type="button" className={`${LINK} !text-ink-400 hover:!text-white`} onClick={() => setShowDemo((v) => !v)}
                    aria-expanded={showDemo}>
                    [ Use a demo account ]
                  </button>
                  {showDemo && (
                    <ul className="mt-4 grid grid-cols-2 gap-2 text-left animate-fade-in">
                      {DEMO_ACCOUNTS.map((a) => (
                        <li key={a.email}>
                          <button type="button" onClick={() => { setEmail(a.email); setPassword(a.password); setShowDemo(false); }}
                            className="w-full border border-white/10 px-3 py-2.5 text-left transition-colors hover:border-brand-500 hover:bg-brand-500/5 focus-ring">
                            <span className="block font-secondary text-[10px] uppercase tracking-label text-brand-500">{a.role}</span>
                            <span className="mt-0.5 block truncate text-xs text-ink-300">{a.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          )}

          {step === "otp" && challenge && (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="flex flex-col gap-7">
              {heading("Check your email", <>We sent a 6-digit code to <span className="font-medium text-white">{challenge.maskedEmail}</span>. It expires in 5 minutes.</>)}
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={verify}
                isInvalid={!!error} isDisabled={isLoading} />
              {errorBox}
              {challenge.devOtp && import.meta.env.DEV && (
                <p className="border border-dashed border-white/15 px-4 py-3 text-center text-xs text-ink-400">
                  Development only — email is not configured. Your code is <span className="font-bold tracking-pw text-white">{challenge.devOtp}</span>.
                </p>
              )}
              <Button type="submit" color="primary" size="lg" className="h-13 w-full" isLoading={isLoading}
                isDisabled={code.length !== 6} endContent={!isLoading && <ArrowRight size={16} />}>
                Verify & sign in
              </Button>
              <div className="flex items-center justify-between">
                {backLink(() => { setChallenge(null); go("credentials"); })}
                {resendsLeft > 0 ? (
                  <button type="button" disabled={resendIn > 0} onClick={resend} aria-live="polite"
                    className={`${LINK} disabled:cursor-not-allowed disabled:!text-ink-500`}>
                    {resendIn > 0 ? `Resend in 0:${String(resendIn).padStart(2, "0")}` : "Resend code"}
                  </button>
                ) : (
                  <span className={`${LABEL} !text-ink-500`}>No more resends</span>
                )}
              </div>
            </form>
          )}

          {step === "theme" && (
            <div className="flex flex-col gap-7">
              {heading("Choose your theme", "Taskly uses it every time you sign in. Change it any time from the top bar.")}
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
                {([["light", "Light", Sun], ["dark", "Dark", Moon]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" role="radio" aria-checked={chosenTheme === value}
                    onClick={() => { setChosenTheme(value); setTheme(value, { save: false }); }}
                    className={`flex flex-col gap-3 border p-3 text-left transition-colors focus-ring ${
                      chosenTheme === value ? "border-brand-600 bg-brand-500/10" : "border-white/10 hover:border-white/25"
                    }`}>
                    <span className={`flex h-20 w-full items-center justify-center border ${value === "dark" ? "border-white/10 bg-black text-white" : "border-ink-200 bg-ink-50 text-ink-900"}`}>
                      <Icon size={22} />
                    </span>
                    <span className="flex items-center justify-between text-xs font-bold uppercase tracking-btn">
                      {label}
                      <span className={`h-3 w-3 rounded-full border ${chosenTheme === value ? "border-brand-500 bg-brand-500" : "border-white/30"}`} />
                    </span>
                  </button>
                ))}
              </div>
              <Button color="primary" size="lg" className="h-13 w-full" onPress={saveThemeAndContinue} endContent={<ArrowRight size={16} />}>
                Continue
              </Button>
            </div>
          )}

          {step === "forgot" && (
            <form onSubmit={submitForgot} className="flex flex-col gap-7">
              {heading("Reset password", "We'll email you a link to set a new one.")}
              {errorBox}
              <div className="flex flex-col gap-2">
                <label htmlFor="forgot-email" className={LABEL}>Work email</label>
                <input id="forgot-email" type="email" className={FIELD} placeholder="you@tapmind.com" autoFocus
                  value={forgetEmail} onChange={(e) => setForgetEmail(e.target.value)} required />
              </div>
              <Button type="submit" color="primary" size="lg" className="h-13 w-full" isLoading={isLoading} endContent={!isLoading && <ArrowRight size={16} />}>
                Send reset link
              </Button>
              <div>{backLink(() => go("credentials"))}</div>
            </form>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 px-6 py-5 font-secondary text-[10.5px] uppercase tracking-eyebrow text-ink-500 sm:px-12">
          <span>Secured with email verification</span>
          <span className="hidden sm:inline">Need help? Contact your admin</span>
        </footer>
      </main>
    </div>
  );
}
