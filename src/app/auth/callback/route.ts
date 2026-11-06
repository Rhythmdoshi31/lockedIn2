import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const isEmailConfirmation = url.searchParams.get("flow") === "email-confirmation";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (isEmailConfirmation) {
      if (!error) await supabase.auth.signOut();
      const authUrl = new URL("/auth", url.origin);
      authUrl.searchParams.set("verified", error ? "error" : "1");
      authUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(authUrl);
    }
  }
  if (isEmailConfirmation) {
    const authUrl = new URL("/auth", url.origin);
    authUrl.searchParams.set("verified", "error");
    authUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(authUrl);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
