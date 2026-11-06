import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("personal"), fullName: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("password"), currentPassword: z.string().min(8).max(200), password: z.string().min(8).max(200) }),
  z.object({ action: z.literal("notifications"), productUpdates: z.boolean(), featureAnnouncements: z.boolean(), promotionalEmails: z.boolean() }),
]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The submitted settings are invalid." }, { status: 400 });

  if (parsed.data.action === "personal") {
    const { error } = await admin.from("profiles").update({ full_name: parsed.data.fullName, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "Your name could not be saved." }, { status: 500 });
    await supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: parsed.data.fullName } });
    return NextResponse.json({ message: "Personal information saved." });
  }

  if (parsed.data.action === "password") {
    const hasPasswordIdentity = user.identities?.some((identity) => identity.provider === "email");
    if (!hasPasswordIdentity) return NextResponse.json({ error: "This account uses a social login and does not have a password to change." }, { status: 400 });
    if (parsed.data.currentPassword === parsed.data.password) return NextResponse.json({ error: "Choose a password different from your current password." }, { status: 400 });
    const { error } = await supabase.auth.updateUser({ current_password: parsed.data.currentPassword, password: parsed.data.password });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ message: "Password updated successfully." });
  }

  if (parsed.data.action === "notifications") {
    const { error } = await admin.from("profiles").update({
      notify_product_updates: parsed.data.productUpdates,
      notify_feature_announcements: parsed.data.featureAnnouncements,
      notify_promotional_emails: parsed.data.promotionalEmails,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    return error ? NextResponse.json({ error: "Notification preferences could not be saved." }, { status: 500 }) : NextResponse.json({ message: "Notification preferences saved." });
  }

  return NextResponse.json({ error: "Unsupported settings action." }, { status: 400 });
}
