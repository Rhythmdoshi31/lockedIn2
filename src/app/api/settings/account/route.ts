import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const deletionSchema = z.object({ confirmation: z.literal("DELETE"), password: z.string().max(200).optional() });
const TERMINAL_SUBSCRIPTIONS = new Set(["cancelled", "expired", "failed"]);

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = deletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type DELETE exactly to confirm account deletion." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    admin.from("profiles").select("paid_credits,avatar_path").eq("id", user.id).single(),
    admin.from("subscriptions").select("status,cancel_at_next_billing_date").eq("user_id", user.id),
  ]);
  if (profileError || subscriptionError || !profile) return NextResponse.json({ error: "Account balances and subscriptions could not be verified. Your account was not deleted." }, { status: 500 });
  const active = subscriptions?.some((subscription) => !TERMINAL_SUBSCRIPTIONS.has(subscription.status));
  if (active) return NextResponse.json({ error: "Your subscription is still active. Cancel it from Profile and wait until the paid term ends before deleting your account." }, { status: 409 });
  if ((profile?.paid_credits ?? 0) > 0) return NextResponse.json({ error: `You still have ${profile?.paid_credits} purchased credits. Account deletion would permanently discard them, so use them before deleting your account.` }, { status: 409 });

  const hasPasswordIdentity = user.identities?.some((identity) => identity.provider === "email");
  if (hasPasswordIdentity) {
    if (!parsed.data.password || !user.email) return NextResponse.json({ error: "Enter your current password to delete this account." }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Account verification is unavailable." }, { status: 500 });
    const verifier = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await verifier.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (error) return NextResponse.json({ error: "The password is incorrect." }, { status: 403 });
  } else {
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    if (Date.now() - lastSignIn > 15 * 60 * 1000) return NextResponse.json({ error: "For security, sign out and sign in with your provider again before deleting this account." }, { status: 403 });
  }

  const { error: purgeError } = await admin.rpc("purge_user_webhook_events", { p_user: user.id });
  if (purgeError) return NextResponse.json({ error: "Payment-event data could not be removed. Your account was not deleted." }, { status: 500 });

  const [{ data: resumeObjects, error: resumeListError }, { data: avatarObjects, error: avatarListError }] = await Promise.all([
    admin.storage.from("resumes").list(user.id, { limit: 1000 }),
    admin.storage.from("avatars").list(user.id, { limit: 100 }),
  ]);
  if (resumeListError || avatarListError) return NextResponse.json({ error: "Stored files could not be audited. Your account was not deleted." }, { status: 500 });
  const resumePaths = resumeObjects?.map((object) => `${user.id}/${object.name}`) ?? [];
  if (resumePaths.length) {
    const { error } = await admin.storage.from("resumes").remove(resumePaths);
    if (error) return NextResponse.json({ error: "Stored résumés could not be removed. Your account was not deleted." }, { status: 500 });
  }
  const avatarPaths = avatarObjects?.map((object) => `${user.id}/${object.name}`) ?? [];
  if (avatarPaths.length) {
    const { error } = await admin.storage.from("avatars").remove(avatarPaths);
    if (error) return NextResponse.json({ error: "Your profile picture could not be removed. Your account was not deleted." }, { status: 500 });
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: "The account could not be deleted. Please try again." }, { status: 500 });
  await supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ message: "Your account and personal data were deleted." });
}
