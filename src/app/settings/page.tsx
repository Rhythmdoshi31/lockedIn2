import { redirect } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { SettingsClient } from "@/components/settings-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/settings");
  const [{ data: profile }, { data: resumes }, { data: subscriptions }] = await Promise.all([
    supabase.from("profiles").select("full_name,avatar_url,avatar_path,default_resume_id,notify_product_updates,notify_feature_announcements,notify_promotional_emails,paid_credits,updated_at").eq("id", user.id).single(),
    supabase.from("resumes").select("id,file_name,mime_type,size_bytes,created_at").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("status,cancel_at_next_billing_date").order("created_at", { ascending: false }),
  ]);
  const activeSubscription = subscriptions?.some((subscription) => !["cancelled", "expired", "failed"].includes(subscription.status)) ?? false;
  const params = await searchParams;
  return <PageChrome><SettingsClient initial={{
    fullName: profile?.full_name || user.user_metadata?.full_name || "",
    email: user.email || "",
    userId: user.id,
    avatarUrl: profile?.avatar_path ? `/api/settings/avatar?v=${encodeURIComponent(profile.updated_at)}` : profile?.avatar_url || null,
    hasPassword: user.identities?.some((identity) => identity.provider === "email") ?? false,
    defaultResumeId: profile?.default_resume_id || null,
    resumes: resumes || [],
    productUpdates: profile?.notify_product_updates ?? true,
    featureAnnouncements: profile?.notify_feature_announcements ?? true,
    promotionalEmails: profile?.notify_promotional_emails ?? false,
    paidCredits: profile?.paid_credits || 0,
    activeSubscription,
    emailConfirmed: params.email === "confirmed",
  }}/></PageChrome>;
}
