"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";

interface ResumeItem { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; }
interface SettingsInitial {
  fullName: string; email: string; userId: string; avatarUrl: string | null; hasPassword: boolean;
  defaultResumeId: string | null; resumes: ResumeItem[]; productUpdates: boolean;
  featureAnnouncements: boolean; promotionalEmails: boolean; paidCredits: number;
  activeSubscription: boolean; emailConfirmed: boolean;
}
type Feedback = { tone: "success" | "error"; text: string } | null;

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string; error?: string; avatarUrl?: string };
  if (!response.ok) throw new Error(body.error || "That change could not be completed.");
  return body;
}

export function SettingsClient({ initial }: { initial: SettingsInitial }) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [resumes, setResumes] = useState(initial.resumes);
  const [defaultResumeId, setDefaultResumeId] = useState(initial.defaultResumeId);
  const [notifications, setNotifications] = useState({ productUpdates: initial.productUpdates, featureAnnouncements: initial.featureAnnouncements, promotionalEmails: initial.promotionalEmails });
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({ email: initial.emailConfirmed ? { tone: "success", text: "Your email change has been confirmed." } : null });
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  function report(section: string, tone: "success" | "error", text: string) { setFeedback((current) => ({ ...current, [section]: { tone, text } })); }
  async function patch(section: string, body: object) {
    setBusy(section); setFeedback((current) => ({ ...current, [section]: null }));
    try {
      const result = await responseMessage(await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      report(section, "success", result.message || "Saved.");
      return true;
    } catch (error) { report(section, "error", error instanceof Error ? error.message : "That change could not be completed."); return false; }
    finally { setBusy(null); }
  }

  async function savePersonal(event: FormEvent) {
    event.preventDefault();
    if (await patch("personal", { action: "personal", fullName })) window.dispatchEvent(new Event("lockedin:account-changed"));
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patch("email", { action: "email", email: form.get("email") });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") || "");
    if (password !== form.get("confirmation")) { report("password", "error", "The new passwords do not match."); return; }
    if (await patch("password", { action: "password", currentPassword: form.get("currentPassword"), password })) formElement.reset();
  }

  async function avatar(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { report("personal", "error", "Choose a JPG, PNG or WebP image up to 2 MB."); return; }
    setBusy("avatar");
    try {
      const data = new FormData(); data.append("avatar", file);
      const result = await responseMessage(await fetch("/api/settings/avatar", { method: "POST", body: data }));
      setAvatarUrl(result.avatarUrl || "/api/settings/avatar"); report("personal", "success", result.message || "Profile picture updated."); window.dispatchEvent(new Event("lockedin:account-changed"));
    } catch (error) { report("personal", "error", error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setBusy(null); }
  }

  async function removeAvatar() {
    setBusy("avatar");
    try { const result = await responseMessage(await fetch("/api/settings/avatar", { method: "DELETE" })); setAvatarUrl(null); report("personal", "success", result.message || "Profile picture removed."); window.dispatchEvent(new Event("lockedin:account-changed")); }
    catch (error) { report("personal", "error", error instanceof Error ? error.message : "The image could not be removed."); }
    finally { setBusy(null); }
  }

  async function uploadResume(file: File | undefined, replaceId?: string) {
    if (!file) return;
    setBusy(replaceId ? `resume-${replaceId}` : "resume-upload");
    try {
      const data = new FormData(); data.append("resume", file);
      const response = await fetch(replaceId ? `/api/resumes/${replaceId}` : "/api/resumes", { method: replaceId ? "PUT" : "POST", body: data });
      const saved = await responseMessage(response) as ResumeItem & { isDefault?: boolean };
      setResumes((current) => replaceId ? current.map((item) => item.id === replaceId ? saved : item) : [saved, ...current]);
      if (saved.isDefault) setDefaultResumeId(saved.id);
      report("resumes", "success", replaceId ? "Résumé replaced." : "Résumé uploaded.");
    } catch (error) { report("resumes", "error", error instanceof Error ? error.message : "The résumé could not be saved."); }
    finally { setBusy(null); if (uploadRef.current) uploadRef.current.value = ""; }
  }

  async function chooseDefault(id: string) {
    if (await patch("resumes", { action: "defaultResume", resumeId: id })) setDefaultResumeId(id);
  }

  async function removeResume(resume: ResumeItem) {
    if (!window.confirm(`Delete “${resume.file_name}”? Analyses already created with it will remain available.`)) return;
    setBusy(`resume-${resume.id}`);
    try {
      const response = await fetch(`/api/resumes/${resume.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error || "The résumé could not be deleted.");
      setResumes((current) => current.filter((item) => item.id !== resume.id));
      if (defaultResumeId === resume.id) setDefaultResumeId(null);
      report("resumes", "success", "Résumé deleted.");
    } catch (error) { report("resumes", "error", error instanceof Error ? error.message : "The résumé could not be deleted."); }
    finally { setBusy(null); }
  }

  async function saveNotifications() { await patch("notifications", { action: "notifications", ...notifications }); }

  async function signOutEverywhere() {
    setBusy("sessions");
    try { await responseMessage(await fetch("/api/settings/sessions", { method: "POST" })); location.href = "/auth"; }
    catch (error) { report("sessions", "error", error instanceof Error ? error.message : "Sessions could not be signed out."); setBusy(null); }
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      await responseMessage(await fetch("/api/settings/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: deleteConfirmation, password: deletePassword || undefined }) }));
      location.href = "/auth?deleted=1";
    } catch (error) { report("delete", "error", error instanceof Error ? error.message : "The account could not be deleted."); setBusy(null); }
  }

  return <section className="settings-page">
    <div className="settings-heading"><p className="eyebrow">Your account</p><h1>Account Settings</h1><p>Manage your identity, saved documents and communication preferences.</p></div>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections"><a href="#personal">Personal information</a><a href="#security">Email & password</a><a href="#resumes">Manage résumés</a><a href="#notifications">Notifications</a><a href="#sessions">Sessions</a><a className="danger-link" href="#danger">Delete account</a></nav>
      <div className="settings-content">
        <section className="settings-card" id="personal"><div className="settings-section-title"><span>01</span><div><h2>Personal Information</h2><p>Shown throughout your Locked In account.</p></div></div><div className="avatar-editor"><span className="settings-avatar"><UserAvatar seed={initial.userId} src={avatarUrl}/></span><div><label className="small-action-button">{busy === "avatar" ? "Uploading…" : avatarUrl ? "Change picture" : "Upload picture"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy === "avatar"} onChange={(event) => avatar(event.target.files?.[0])}/></label>{avatarUrl&&<button className="text-action" type="button" disabled={busy === "avatar"} onClick={removeAvatar}>Remove</button>}<small>JPG, PNG or WebP · 2 MB maximum</small></div></div><form className="settings-form" onSubmit={savePersonal}><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={1} maxLength={80} required/></label><button className="secondary-button" disabled={busy === "personal"}>{busy === "personal" ? "Saving…" : "Save name"}</button></form><FeedbackLine value={feedback.personal}/></section>
        <section className="settings-card" id="security"><div className="settings-section-title"><span>02</span><div><h2>Email & Password</h2><p>Security changes are managed through Supabase Auth.</p></div></div><form className="settings-form" onSubmit={changeEmail}><label>Current email<input value={initial.email} disabled/></label><label>New email<input name="email" type="email" autoComplete="email" required/></label><button className="secondary-button" disabled={busy === "email"}>{busy === "email" ? "Sending verification…" : "Change email"}</button></form><FeedbackLine value={feedback.email}/>{initial.hasPassword?<><div className="settings-divider"/><form className="settings-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" minLength={8} autoComplete="current-password" required/></label><div className="settings-form-grid"><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required/></label><label>Confirm new password<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required/></label></div><button className="secondary-button" disabled={busy === "password"}>{busy === "password" ? "Updating…" : "Update password"}</button></form><FeedbackLine value={feedback.password}/></>:<p className="settings-note">This account uses social login. Password changes are not available.</p>}</section>
        <section className="settings-card" id="resumes"><div className="settings-section-title"><span>03</span><div><h2>Manage Résumés</h2><p>Your private saved documents. The default is preselected for new analyses.</p></div></div><label className="small-action-button resume-upload-action">{busy === "resume-upload" ? "Uploading…" : "Upload résumé"}<input ref={uploadRef} className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => uploadResume(event.target.files?.[0])}/></label><div className="settings-resume-list">{resumes.length ? resumes.map((resume) => <article key={resume.id} className="settings-resume-row"><div><strong>{resume.file_name}</strong><span>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(resume.created_at))} · {(resume.size_bytes / 1024 / 1024).toFixed(1)} MB</span>{defaultResumeId === resume.id&&<small>Default résumé</small>}</div><div className="resume-row-actions"><button className="tiny-button" type="button" disabled={busy === `resume-${resume.id}` || defaultResumeId === resume.id} onClick={() => chooseDefault(resume.id)}>Make default</button><a className="tiny-button" href={`/api/resumes/${resume.id}?download=1`}>Download</a><label className="tiny-button">Replace<input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => uploadResume(event.target.files?.[0], resume.id)}/></label><button className="tiny-button danger-button" type="button" disabled={busy === `resume-${resume.id}`} onClick={() => removeResume(resume)}>Delete</button></div></article>) : <div className="empty-state account-empty"><p>No saved résumés.</p><small>Upload one to make future analyses faster.</small></div>}</div><FeedbackLine value={feedback.resumes}/></section>
        <section className="settings-card" id="notifications"><div className="settings-section-title"><span>04</span><div><h2>Notification Preferences</h2><p>Choose which optional emails you receive.</p></div></div><Toggle label="Product updates" checked={notifications.productUpdates} onChange={(value) => setNotifications((current) => ({ ...current, productUpdates: value }))}/><Toggle label="Feature announcements" checked={notifications.featureAnnouncements} onChange={(value) => setNotifications((current) => ({ ...current, featureAnnouncements: value }))}/><Toggle label="Promotional emails" checked={notifications.promotionalEmails} onChange={(value) => setNotifications((current) => ({ ...current, promotionalEmails: value }))}/><div className="essential-email-row"><span>Authentication, security and payment emails</span><strong>Always enabled</strong></div><button className="secondary-button" type="button" disabled={busy === "notifications"} onClick={saveNotifications}>{busy === "notifications" ? "Saving…" : "Save preferences"}</button><FeedbackLine value={feedback.notifications}/></section>
        <section className="settings-card" id="sessions"><div className="settings-section-title"><span>05</span><div><h2>Sessions</h2><p>End every active Locked In session, including this device.</p></div></div><button className="secondary-button" type="button" disabled={busy === "sessions"} onClick={signOutEverywhere}>{busy === "sessions" ? "Signing out…" : "Sign out of all devices"}</button><FeedbackLine value={feedback.sessions}/></section>
        <section className="settings-card danger-zone" id="danger"><div className="settings-section-title"><span>!</span><div><h2>Danger Zone</h2><p>Account deletion is permanent and cannot be undone.</p></div></div>{initial.activeSubscription&&<div className="danger-warning"><strong>Active subscription detected</strong><p>Cancel it from Profile and wait until the paid term ends. Locked In will never silently cancel it during deletion.</p><Link className="small-action-button" href="/profile">Review subscription</Link></div>}{initial.paidCredits>0&&<div className="danger-warning"><strong>{initial.paidCredits} purchased credits remain</strong><p>Use them before deleting your account. Deletion is blocked so paid value is never silently discarded.</p></div>}<label>Type DELETE to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off"/></label>{initial.hasPassword&&<label>Current password<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password"/></label>}<button className="delete-account-button" type="button" disabled={busy === "delete" || deleteConfirmation !== "DELETE" || initial.activeSubscription || initial.paidCredits > 0 || (initial.hasPassword && deletePassword.length < 8)} onClick={deleteAccount}>{busy === "delete" ? "Deleting…" : "Permanently delete account"}</button><FeedbackLine value={feedback.delete}/></section>
      </div>
    </div>
  </section>;
}

function FeedbackLine({ value }: { value: Feedback | undefined }) { return value ? <p className={`settings-feedback ${value.tone}`} role="status">{value.text}</p> : null; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/></label>; }
