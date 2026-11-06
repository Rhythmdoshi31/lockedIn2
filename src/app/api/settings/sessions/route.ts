import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.auth.signOut({ scope: "global" });
  return error ? NextResponse.json({ error: "All sessions could not be signed out." }, { status: 500 }) : NextResponse.json({ message: "All devices have been signed out." });
}
