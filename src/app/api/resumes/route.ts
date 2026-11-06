import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateResumeUpload } from "@/lib/resume-upload";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ resumes: [], defaultResumeId: null });
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.from("resumes").select("id,file_name,mime_type,size_bytes,created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("default_resume_id").eq("id", user.id).single(),
  ]);
  return error ? NextResponse.json({ error: "Saved résumés could not be loaded." }, { status: 500 }) : NextResponse.json({ resumes: data, defaultResumeId: profile?.default_resume_id ?? null });
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
  const { data: profile } = await supabase.from("profiles").select("default_resume_id").eq("id", user.id).single();
  if (!profile?.default_resume_id) await createAdminClient().from("profiles").update({ default_resume_id: id, updated_at: new Date().toISOString() }).eq("id", user.id);
  return NextResponse.json({ ...data, isDefault: !profile?.default_resume_id }, { status: 201 });
}
