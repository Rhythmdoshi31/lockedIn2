import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ownedResume(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, resume: null };
  const { data: resume } = await supabase.from("resumes").select("id,file_name,mime_type,storage_path,size_bytes,created_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  return { supabase, user, resume };
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, resume } = await ownedResume(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: file, error } = await supabase.storage.from("resumes").download(resume.storage_path);
  if (error) return NextResponse.json({ error: "The résumé file is unavailable." }, { status: 404 });
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(file, { headers: { "content-type": resume.mime_type, "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(resume.file_name)}` } });
}
