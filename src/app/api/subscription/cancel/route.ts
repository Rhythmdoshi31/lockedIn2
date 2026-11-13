import { NextResponse } from "next/server";

import { createDodoClient } from "@/lib/dodo";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth", request.url));

  const { data, error: lookupError } = await supabase.from("subscriptions")
    .select("provider_subscription_id")
    .eq("user_id", user.id)
    .in("status", ["active", "renewed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "The subscription could not be verified." }, { status: 500 });
  if (!data) return NextResponse.redirect(new URL("/profile", request.url), 303);

  try {
    await createDodoClient().subscriptions.update(data.provider_subscription_id, {
      cancel_at_next_billing_date: true,
    });
  } catch {
    return NextResponse.json(
      { error: "The subscription provider could not schedule cancellation. Please try again." },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabase.from("subscriptions")
    .update({ cancel_at_next_billing_date: true })
    .eq("provider_subscription_id", data.provider_subscription_id)
    .eq("user_id", user.id);
  if (updateError) {
    return NextResponse.json(
      { error: "Cancellation was scheduled, but the account status could not be refreshed yet." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
