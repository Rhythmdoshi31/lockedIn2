"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { createClient } from "@/lib/supabase/client";

type Feedback = { tone: "success" | "error"; text: string } | null;

interface ProfileManagerProps {
  userId: string;
  email: string;
  initialName: string;
  initialAvatarUrl: string | null;
  hasPassword: boolean;
  productUpdates: boolean;
  featureAnnouncements: boolean;
  promotionalEmails: boolean;
  premium: boolean;
  totalCredits: number;
  dailyRemaining: number;
  paidCredits: number;
  activeSubscription: boolean;
  accountDetails: ReactNode;
}

async function readResponse(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string; error?: string; avatarUrl?: string };
  if (!response.ok) throw new Error(body.error || "That change could not be completed.");
  return body;
}

export function ProfileManager(props: ProfileManagerProps) {
  const [fullName, setFullName] = useState(props.initialName);
  const [avatarUrl, setAvatarUrl] = useState(props.initialAvatarUrl);
  const [notifications, setNotifications] = useState({ productUpdates: props.productUpdates, featureAnnouncements: props.featureAnnouncements, promotionalEmails: props.promotionalEmails });
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  function report(section: string, tone: "success" | "error", text: string) { setFeedback((current) => ({ ...current, [section]: { tone, text } })); }
  async function patch(section: string, body: object) {
    setBusy(section); setFeedback((current) => ({ ...current, [section]: null }));
    try {
      const result = await readResponse(await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      report(section, "success", result.message || "Saved.");
      return true;
    } catch (error) { report(section, "error", error instanceof Error ? error.message : "That change could not be completed."); return false; }
    finally { setBusy(null); }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (await patch("personal", { action: "personal", fullName })) window.dispatchEvent(new Event("lockedin:account-changed"));
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { report("personal", "error", "Choose a JPG, PNG or WebP image up to 2 MB."); return; }
    setBusy("avatar");
    try {
      const data = new FormData(); data.append("avatar", file);
      const result = await readResponse(await fetch("/api/settings/avatar", { method: "POST", body: data }));
      setAvatarUrl(result.avatarUrl || "/api/settings/avatar");
      report("personal", "success", result.message || "Profile picture updated.");
      window.dispatchEvent(new Event("lockedin:account-changed"));
    } catch (error) { report("personal", "error", error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setBusy(null); }
  }

  async function removeAvatar() {
    setBusy("avatar");
    try {
      const result = await readResponse(await fetch("/api/settings/avatar", { method: "DELETE" }));
      setAvatarUrl(null); report("personal", "success", result.message || "Profile picture removed.");
      window.dispatchEvent(new Event("lockedin:account-changed"));
    } catch (error) { report("personal", "error", error instanceof Error ? error.message : "The image could not be removed."); }
    finally { setBusy(null); }
  }

  async function saveNotifications() { await patch("notifications", { action: "notifications", ...notifications }); }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const password = String(data.get("password") || "");
    if (password !== data.get("confirmation")) { report("password", "error", "The new passwords do not match."); return; }
    if (await patch("password", { action: "password", currentPassword: data.get("currentPassword"), password })) formElement.reset();
  }

  async function logout() {
    setBusy("logout");
    const { error } = await createClient().auth.signOut();
    if (error) { report("logout", "error", "You could not be logged out. Please try again."); setBusy(null); return; }
    location.href = "/auth";
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      await readResponse(await fetch("/api/settings/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: deleteConfirmation, password: deletePassword || undefined }) }));
      location.href = "/auth?deleted=1";
    } catch (error) { report("delete", "error", error instanceof Error ? error.message : "The account could not be deleted."); setBusy(null); }
  }

  return <>
    <div className="profile-grid profile-edit-grid">
      <article className="profile-information-card"><div className="profile-card-heading"><span>Profile information</span><button className="text-action profile-logout-action" type="button" disabled={busy === "logout"} onClick={logout}>{busy === "logout" ? "Logging out…" : "Log out"}</button></div><div className="profile-identity"><span className="settings-avatar"><UserAvatar seed={props.userId} src={avatarUrl}/></span><div className="profile-identity-details"><form className="profile-name-form" onSubmit={saveName}><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={1} maxLength={80} required/></label><button className="secondary-button" disabled={busy === "personal"}>{busy === "personal" ? "Saving…" : "Save"}</button></form><p className="profile-email">{props.email}</p><div className="profile-picture-actions"><label className="small-action-button">{busy === "avatar" ? "Uploading…" : avatarUrl ? "Change picture" : "Upload picture"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy === "avatar"} onChange={(event) => uploadAvatar(event.target.files?.[0])}/></label>{avatarUrl&&<button className="text-action" type="button" disabled={busy === "avatar"} onClick={removeAvatar}>Remove</button>}<small>JPG, PNG or WebP · 2 MB maximum</small></div></div></div><FeedbackLine value={feedback.personal}/><FeedbackLine value={feedback.logout}/></article>
      <article className="profile-plan-card"><span>Current plan</span><div className="profile-plan-content"><div className="profile-plan-heading"><h2>{props.premium ? "Premium" : "Free"}</h2><p>{props.premium ? "Your active subscription" : "Daily allowance"}</p></div><div className="profile-plan-available"><strong>{props.totalCredits}</strong><div><b>analyses available</b><small>Ready to use now</small></div></div><dl className="profile-plan-metrics"><div><dt>Free today</dt><dd>{props.dailyRemaining}<small> of 3 remaining</small></dd></div><div><dt>Purchased</dt><dd>{props.paidCredits}<small> credits</small></dd></div></dl></div></article>
    </div>
    {props.accountDetails}
    <div className="profile-preferences-stack">
      <section className="settings-card profile-password-card"><div className="settings-section-title"><span>01</span><div><h2>Change Password</h2><p>Use a unique password with at least eight characters.</p></div></div>{props.hasPassword?<form className="profile-password-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" minLength={8} autoComplete="current-password" required/></label><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required/></label><label>Confirm password<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required/></label><button className="secondary-button" disabled={busy === "password"}>{busy === "password" ? "Updating…" : "Update password"}</button></form>:<p className="settings-note">This account uses social login and does not have a password to change.</p>}<FeedbackLine value={feedback.password}/></section>
      <section className="settings-card profile-secondary-card"><div className="settings-section-title"><span>02</span><div><h2>Notification Preferences</h2><p>Choose which optional emails you receive.</p></div></div><Toggle label="Product updates" checked={notifications.productUpdates} onChange={(value) => setNotifications((current) => ({ ...current, productUpdates: value }))}/><Toggle label="Feature announcements" checked={notifications.featureAnnouncements} onChange={(value) => setNotifications((current) => ({ ...current, featureAnnouncements: value }))}/><Toggle label="Promotional emails" checked={notifications.promotionalEmails} onChange={(value) => setNotifications((current) => ({ ...current, promotionalEmails: value }))}/><div className="essential-email-row"><span>Authentication, security and payment emails</span><strong>Always enabled</strong></div><button className="secondary-button" type="button" disabled={busy === "notifications"} onClick={saveNotifications}>{busy === "notifications" ? "Saving…" : "Save preferences"}</button><FeedbackLine value={feedback.notifications}/></section>
      <section className="settings-card danger-zone profile-secondary-card"><div className="settings-section-title"><span>!</span><div><h2>Delete Account</h2><p>Account deletion is permanent and cannot be undone.</p></div></div>{props.activeSubscription&&<div className="danger-warning"><strong>Active subscription detected</strong><p>Cancel it and wait until the paid term ends. Locked In will never silently cancel it during deletion.</p><Link className="small-action-button" href="#subscription">Review subscription</Link></div>}{props.paidCredits>0&&<div className="danger-warning"><strong>{props.paidCredits} purchased credits remain</strong><p>Use them before deleting your account. Deletion is blocked so paid value is never silently discarded.</p></div>}<div className="profile-delete-fields"><label>Type DELETE to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off"/></label>{props.hasPassword&&<label>Current password<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password"/></label>}</div><button className="delete-account-button" type="button" disabled={busy === "delete" || deleteConfirmation !== "DELETE" || props.activeSubscription || props.paidCredits > 0 || (props.hasPassword && deletePassword.length < 8)} onClick={deleteAccount}>{busy === "delete" ? "Deleting…" : "Permanently delete account"}</button><FeedbackLine value={feedback.delete}/></section>
    </div>
  </>;
}

function FeedbackLine({ value }: { value: Feedback | undefined }) { return value ? <p className={`settings-feedback ${value.tone}`} role="status">{value.text}</p> : null; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/></label>; }
