import Link from "next/link";
import { redirect } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { ProfileManager } from "@/components/profile-manager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const [{ data: profile }, { data: payments }, { data: subscriptions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
  ]);
  const active = subscriptions?.find((subscription) => ["active", "renewed"].includes(subscription.status));
  const premium = profile?.plan === "premium";
  const utcToday = new Date().toISOString().slice(0, 10);
  const usedToday = profile?.daily_free_usage_date === utcToday ? profile?.daily_free_used || 0 : 0;
  const dailyRemaining = premium ? 0 : Math.max(0, 3 - usedToday);
  const paidCredits = profile?.paid_credits || 0;

  return <PageChrome><section className="content-panel profile-panel"><div className="profile-title"><div><p className="eyebrow">Your account</p><h1>Profile</h1></div></div>
    <ProfileManager
      userId={user.id}
      email={user.email || ""}
      initialName={profile?.full_name || user.user_metadata?.full_name || ""}
      initialAvatarUrl={profile?.avatar_path ? `/api/settings/avatar?v=${encodeURIComponent(profile.updated_at)}` : profile?.avatar_url || null}
      hasPassword={user.identities?.some((identity) => identity.provider === "email") ?? false}
      productUpdates={profile?.notify_product_updates ?? true}
      featureAnnouncements={profile?.notify_feature_announcements ?? true}
      promotionalEmails={profile?.notify_promotional_emails ?? false}
      premium={premium}
      totalCredits={dailyRemaining + paidCredits}
      dailyRemaining={dailyRemaining}
      paidCredits={paidCredits}
      activeSubscription={Boolean(active)}
      accountDetails={<div className="profile-billing-stack">
        <section className="account-section" id="subscription"><div className="account-section-heading"><div><span>Plan details</span><h2>Subscription</h2></div>{!active&&<Link className="small-action-button" href="/pricing">Subscribe</Link>}</div>{active?<div className="history-row"><div><strong>Premium monthly</strong><p>{active.cancel_at_next_billing_date ? "Cancels after current billing period" : "Renews automatically"}</p></div><form action="/api/subscription/cancel" method="post"><button className="secondary-button">Cancel subscription</button></form></div>:<div className="empty-state account-empty"><p>No active subscription.</p><small>Your existing credits remain available and never expire.</small></div>}</section>
        <section className="account-section"><div className="account-section-heading"><div><span>Receipts</span><h2>Payment history</h2></div>{!payments?.length&&<Link className="small-action-button" href="/pricing">View plans</Link>}</div>{payments?.length ? payments.map((payment) => <div className="history-row" key={payment.id}><div><strong>{payment.product_id === process.env.DODO_PAYMENTS_PREMIUM_PRODUCT_ID ? "Premium monthly" : "Starter credits"}</strong><p>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payment.created_at))} · {payment.status}</p></div><span className="payment-amount">{payment.currency?.toUpperCase()} {typeof payment.amount === "number" ? (payment.amount / 100).toFixed(2) : "—"}</span></div>) : <div className="empty-state account-empty"><p>No payment history yet.</p><small>Purchases and subscription renewals will appear here.</small></div>}</section>
      </div>}
    />
  </section></PageChrome>;
}
