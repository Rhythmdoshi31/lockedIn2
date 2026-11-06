import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

function validSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]);
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  if (!profile?.avatar_path) return NextResponse.json({ error: "No uploaded avatar" }, { status: 404 });
  const { data, error } = await supabase.storage.from("avatars").download(profile.avatar_path);
  if (error) return NextResponse.json({ error: "Avatar unavailable" }, { status: 404 });
  return new NextResponse(data, { headers: { "content-type": data.type || "image/jpeg", "cache-control": "private, max-age=300" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const file = (await request.formData()).get("avatar");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_AVATAR_BYTES || !TYPES.has(file.type)) return NextResponse.json({ error: "Choose a JPG, PNG or WebP image up to 2 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(file.type, bytes)) return NextResponse.json({ error: "The selected image is invalid or damaged." }, { status: 400 });
  const admin = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const path = `${user.id}/${crypto.randomUUID()}.${TYPES.get(file.type)}`;
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "The profile picture could not be uploaded." }, { status: 500 });
  const { error: updateError } = await admin.from("profiles").update({ avatar_path: path, avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (updateError) { await admin.storage.from("avatars").remove([path]); return NextResponse.json({ error: "The profile picture could not be saved." }, { status: 500 }); }
  if (profile?.avatar_path) await admin.storage.from("avatars").remove([profile.avatar_path]);
  return NextResponse.json({ message: "Profile picture updated.", avatarUrl: `/api/settings/avatar?v=${Date.now()}` });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: objects, error: listError } = await admin.storage.from("avatars").list(user.id, { limit: 100 });
  if (listError) return NextResponse.json({ error: "The profile picture could not be removed." }, { status: 500 });
  const paths = objects?.map((object) => `${user.id}/${object.name}`) ?? [];
  if (paths.length) { const { error } = await admin.storage.from("avatars").remove(paths); if (error) return NextResponse.json({ error: "The profile picture could not be removed." }, { status: 500 }); }
  const { error } = await admin.from("profiles").update({ avatar_path: null, avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
  return error ? NextResponse.json({ error: "The profile picture could not be removed." }, { status: 500 }) : NextResponse.json({ message: "Profile picture removed." });
}
