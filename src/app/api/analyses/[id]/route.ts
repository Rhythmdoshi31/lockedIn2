import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("analyses").delete().eq("id", id).eq("user_id", user.id);
  return error
    ? NextResponse.json({ error: "The analysis could not be deleted." }, { status: 500 })
    : new NextResponse(null, { status: 204 });
}
