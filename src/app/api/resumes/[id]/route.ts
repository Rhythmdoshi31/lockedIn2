import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateResumeUpload } from "@/lib/resume-upload";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, resume } = await ownedResume(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const validated = await validateResumeUpload((await request.formData()).get("resume"));
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
  const newPath = `${user.id}/${id}-${crypto.randomUUID()}.${validated.extension}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(newPath, validated.bytes, { contentType: validated.file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "The replacement résumé could not be uploaded." }, { status: 500 });
  const { data, error } = await supabase.from("resumes").update({ file_name: validated.file.name, storage_path: newPath, mime_type: validated.file.type, size_bytes: validated.file.size }).eq("id", id).eq("user_id", user.id).select("id,file_name,mime_type,size_bytes,created_at").single();
  if (error) { await supabase.storage.from("resumes").remove([newPath]); return NextResponse.json({ error: "The replacement résumé could not be saved." }, { status: 500 }); }
  await supabase.storage.from("resumes").remove([resume.storage_path]);
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, resume } = await ownedResume(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = createAdminClient();
  const { data: objects } = await admin.storage.from("resumes").list(user.id, { limit: 1000 });
  const paths = objects?.filter((object) => object.name === resume.storage_path.split("/").pop() || object.name.startsWith(`${id}-`)).map((object) => `${user.id}/${object.name}`) ?? [resume.storage_path];
  const { error: storageError } = await admin.storage.from("resumes").remove(paths.length ? paths : [resume.storage_path]);
  if (storageError) return NextResponse.json({ error: "The résumé file could not be removed." }, { status: 500 });
  const { error } = await supabase.from("resumes").delete().eq("id", id).eq("user_id", user.id);
  return error ? NextResponse.json({ error: "The résumé record could not be deleted." }, { status: 500 }) : new NextResponse(null, { status: 204 });
}
