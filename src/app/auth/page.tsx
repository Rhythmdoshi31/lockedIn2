"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageChrome } from "@/components/page-chrome";

type AuthMode = "login" | "signup";
type Feedback = { tone: "success" | "error"; text: string } | null;

const RESEND_COOLDOWN_SECONDS = 60;

function AuthForm() {
  const params = useSearchParams();
  const verified = params.get("verified");
  const requestedNext = params.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(params.get("reason") === "limit" ? "Create an account to receive 3 additional analyses." : null);
  const [busy, setBusy] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [saveReport, setSaveReport] = useState(safeNext.includes("saveReport=1"));
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);
  const [verificationDismissed, setVerificationDismissed] = useState(false);

  const confirmationRedirect = useMemo(() => {
    if (typeof window === "undefined") return "";
    const next = saveReport ? "/?saveReport=1" : "/";
    return `${location.origin}/auth/callback?flow=email-confirmation&next=${encodeURIComponent(next)}`;
  }, [saveReport]);

  useEffect(() => { setHasReport(Boolean(localStorage.getItem("lockedin.pendingAnalysis"))); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function showLogin() {
    setMode("login");
    setConfirmationEmail(null);
    setVerificationDismissed(true);
    setMessage(verified === "1" ? "Your email is verified. Log in to continue." : null);
    setResendFeedback(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { save_anonymous_report: saveReport }, emailRedirectTo: confirmationRedirect } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }
    if (result.data.session) {
      location.href = saveReport ? "/?saveReport=1" : safeNext;
      return;
    }
    if (mode === "signup") {
      setConfirmationEmail(email);
      setPassword("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setMessage("Check your email for the confirmation link before logging in.");
    }
    setBusy(false);
  }

  async function resendConfirmation() {
    if (!confirmationEmail || resendBusy || cooldown > 0) return;
    setResendBusy(true);
    setResendFeedback(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: { emailRedirectTo: confirmationRedirect },
    });
    if (error) setResendFeedback({ tone: "error", text: error.message });
    else {
      setResendFeedback({ tone: "success", text: "A new confirmation email has been sent." });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
    setResendBusy(false);
  }

  async function google() {
    const next = saveReport ? "/?saveReport=1" : "/";
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  }

  const verificationState = !verificationDismissed && (verified === "1" || verified === "error");
  if (confirmationEmail || verificationState) {
    const verificationFailed = verified === "error";
    return <PageChrome><section className="auth-layout"><div className="auth-panel auth-confirmation"><p className="eyebrow">{verificationFailed ? "Confirmation link issue" : verified === "1" ? "Email verified" : "One final step"}</p><h1>{verificationFailed ? "We couldn’t verify that link." : verified === "1" ? "You’re verified." : "Check your inbox."}</h1>
      {confirmationEmail ? <><p>We sent a confirmation link to:</p><strong className="confirmation-email">{confirmationEmail}</strong><p className="confirmation-instructions">Open the email and select the verification link. After verification, return here and log in to activate your account benefits.</p></> : <p>{verificationFailed ? "The confirmation link may have expired or already been used. Return to signup to request a fresh email, or log in if you have already verified." : "Your email address has been confirmed. Log in to access your account and additional analyses."}</p>}
      <button className="analyze-button confirmation-login" type="button" onClick={showLogin}>Go to Login <span>→</span></button>
      {confirmationEmail && <div className="resend-area"><button className="auth-switch" type="button" disabled={resendBusy || cooldown > 0} onClick={resendConfirmation}>{resendBusy ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}</button>{resendFeedback && <p className={`auth-feedback ${resendFeedback.tone}`}>{resendFeedback.text}</p>}</div>}
      {verificationFailed && <button className="auth-switch" type="button" onClick={() => { setMode("signup"); setMessage(null); setVerificationDismissed(true); history.replaceState(null, "", "/auth?mode=signup"); }}>Return to signup</button>}
    </div><div className="auth-spacer"/></section></PageChrome>;
  }

  return <PageChrome><section className="auth-layout"><div className="auth-panel"><p className="eyebrow">Your application archive</p><h1>{mode === "login" ? "Welcome back." : "Create your account."}</h1><p>{mode === "signup" ? "Save analyses, keep résumés secure, and receive three additional analyses after email verification." : "Continue your considered approach to every application."}</p>
    <button className="oauth-button" onClick={google} type="button">Continue with Google</button><div className="auth-divider"><span>or</span></div>
    <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email"/></label><label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"}/></label>
    {mode === "signup" && hasReport && <label className="consent-row"><input type="checkbox" checked={saveReport} onChange={(event) => setSaveReport(event.target.checked)}/><span>Save my current anonymous report to this account</span></label>}
    <button className="analyze-button" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}<span>→</span></button></form>
    {message && <p className="form-error">{message}</p>}<button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}>{mode === "login" ? "New to LockedIn? Create an account" : "Already have an account? Log in"}</button></div><div className="auth-spacer"/></section></PageChrome>;
}

export default function AuthPage() { return <Suspense fallback={<PageChrome><section className="auth-layout"><div className="auth-panel"><p className="eyebrow">Preparing your account</p></div><div className="auth-spacer"/></section></PageChrome>}><AuthForm/></Suspense>; }
