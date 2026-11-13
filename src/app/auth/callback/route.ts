import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = safeInternalPath(url.searchParams.get("next"));
  const isEmailConfirmation = url.searchParams.get("flow") === "email-confirmation";
  const isPasswordReset = url.searchParams.get("flow") === "password-reset";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (isEmailConfirmation) {
      if (!error) await supabase.auth.signOut({ scope: "local" });
      const authUrl = new URL("/auth", url.origin);
      authUrl.searchParams.set("verified", error ? "error" : "1");
      authUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(authUrl);
    }
    if (isPasswordReset && error) {
      const authUrl = new URL("/auth", url.origin);
      authUrl.searchParams.set("mode", "forgot");
      authUrl.searchParams.set("recovery", "error");
      return NextResponse.redirect(authUrl);
    }
  }
  if (isEmailConfirmation) {
    const authUrl = new URL("/auth", url.origin);
    authUrl.searchParams.set("verified", "error");
    authUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(authUrl);
  }
  if (isPasswordReset) {
    const authUrl = new URL("/auth", url.origin);
    authUrl.searchParams.set("mode", "forgot");
    authUrl.searchParams.set("recovery", "error");
    return NextResponse.redirect(authUrl);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
