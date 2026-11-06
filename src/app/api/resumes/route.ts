import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateResumeUpload } from "@/lib/resume-upload";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ resumes: [] });
  const { data, error } = await supabase.from("resumes").select("id,file_name,mime_type,size_bytes,created_at").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: "Saved résumés could not be loaded." }, { status: 500 }) : NextResponse.json({ resumes: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const validated = await validateResumeUpload((await request.formData()).get("resume"));
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.${validated.extension}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(path, validated.bytes, { contentType: validated.file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "The résumé could not be uploaded." }, { status: 500 });
  const { data, error } = await supabase.from("resumes").insert({ id, user_id: user.id, file_name: validated.file.name, storage_path: path, mime_type: validated.file.type, size_bytes: validated.file.size }).select("id,file_name,mime_type,size_bytes,created_at").single();
  if (error) { await supabase.storage.from("resumes").remove([path]); return NextResponse.json({ error: "The résumé could not be saved." }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
