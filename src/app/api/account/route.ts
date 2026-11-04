import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const raw = request.headers.get("cookie")?.match(/(?:^|; )lockedin_anon_used=(\d)/)?.[1];
    return NextResponse.json({ authenticated: false, credits: Math.max(0, 3 - Number(raw || 0)), premium: false });
  }
  const { data } = await supabase.from("profiles").select("free_credits,paid_credits,plan,avatar_url").eq("id", user.id).single();
  return NextResponse.json({ authenticated: true, credits: (data?.free_credits ?? 0) + (data?.paid_credits ?? 0), premium: data?.plan === "premium", userId: user.id, avatarUrl: data?.avatar_url });
}
