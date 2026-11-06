import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_FREE_LIMIT = 3;

function utcDate() { return new Date().toISOString().slice(0, 10); }
function accountResponse(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const raw = request.headers.get("cookie")?.match(/(?:^|; )lockedin_anon_used=(\d)/)?.[1];
    return accountResponse({ authenticated: false, credits: Math.max(0, 3 - Number(raw || 0)), premium: false });
  }
  const { data, error } = await supabase.from("profiles").select("daily_free_used,daily_free_usage_date,paid_credits,plan,avatar_url,avatar_path,updated_at").eq("id", user.id).single();
  if (error || !data) {
    const { data: fallback } = await supabase.from("profiles").select("paid_credits,plan,avatar_url").eq("id", user.id).maybeSingle();
    return accountResponse({
      authenticated: true,
      credits: fallback?.paid_credits ?? 0,
      paidCredits: fallback?.paid_credits ?? 0,
      premium: fallback?.plan === "premium",
      userId: user.id,
      avatarUrl: fallback?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      usageAvailable: false,
    });
  }
  const premium = data?.plan === "premium";
  const usedToday = data?.daily_free_usage_date === utcDate() ? data.daily_free_used : 0;
  const dailyRemaining = premium ? 0 : Math.max(0, DAILY_FREE_LIMIT - usedToday);
  const paidCredits = data.paid_credits;
  return accountResponse({ authenticated: true, credits: dailyRemaining + paidCredits, dailyRemaining, paidCredits, premium, userId: user.id, avatarUrl: data.avatar_path ? `/api/settings/avatar?v=${encodeURIComponent(data.updated_at)}` : data.avatar_url, usageAvailable: true });
}
