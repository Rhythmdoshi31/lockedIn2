"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageChrome } from "@/components/page-chrome";

function AuthForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login"|"signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [message,setMessage]=useState<string|null>(params.get("reason") === "limit" ? "Create an account to receive 3 additional analyses." : null); const [busy,setBusy]=useState(false);
  const hasReport = typeof window !== "undefined" && Boolean(localStorage.getItem("lockedin.pendingAnalysis"));
  const [saveReport,setSaveReport]=useState(false);
  async function submit(event:FormEvent){ event.preventDefault(); setBusy(true); setMessage(null); const supabase=createClient();
    const result=mode==="signup" ? await supabase.auth.signUp({email,password,options:{data:{save_anonymous_report:saveReport},emailRedirectTo:`${location.origin}/auth/callback?next=${encodeURIComponent(saveReport?"/?saveReport=1":"/")}`}}) : await supabase.auth.signInWithPassword({email,password});
    if(result.error){setMessage(result.error.message);setBusy(false);return;} if(result.data.session){location.href=saveReport?"/?saveReport=1":"/";} else {setMessage("Check your email to confirm your account.");setBusy(false);}
  }
  async function google(){ const supabase=createClient(); await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/auth/callback?next=${encodeURIComponent(saveReport?"/?saveReport=1":"/")}`}}); }
  return <PageChrome><section className="auth-layout"><div className="auth-panel"><p className="eyebrow">Your application archive</p><h1>{mode==="login"?"Welcome back.":"Create your account."}</h1><p>{mode==="signup"?"Save analyses, keep résumés secure, and receive three additional analyses.":"Continue your considered approach to every application."}</p>
    <button className="oauth-button" onClick={google} type="button">Continue with Google</button><div className="auth-divider"><span>or</span></div>
    <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>Password<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==="login"?"current-password":"new-password"}/></label>
    {mode==="signup"&&hasReport&&<label className="consent-row"><input type="checkbox" checked={saveReport} onChange={e=>setSaveReport(e.target.checked)}/><span>Save my current anonymous report to this account</span></label>}
    <button className="analyze-button" disabled={busy}>{busy?"Please wait…":mode==="login"?"Log in":"Create account"}<span>→</span></button></form>
    {message&&<p className="form-error">{message}</p>}<button className="auth-switch" type="button" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New to LockedIn? Create an account":"Already have an account? Log in"}</button></div><div className="auth-spacer"/></section></PageChrome>;
}

export default function AuthPage(){return <Suspense fallback={<PageChrome><section className="auth-layout"><div className="auth-panel"><p className="eyebrow">Preparing your account</p></div><div className="auth-spacer"/></section></PageChrome>}><AuthForm/></Suspense>}
