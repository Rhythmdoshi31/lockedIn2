import { NextResponse } from "next/server";

import { validatePublicJobUrl } from "@/lib/job-scraper";
import { createClient } from "@/lib/supabase/server";
import { analysisResultSchema } from "@/schemas/analysis";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const result = analysisResultSchema.safeParse(body?.result);
  const requestId = typeof body?.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) ? body.requestId : null;
  if (!result.success || typeof body?.jobUrl !== "string" || body.jobUrl.length > 2_048 || !requestId) {
    return NextResponse.json({ error: "Invalid analysis" }, { status: 400 });
  }

  let sourceUrl: string;
  try { sourceUrl = validatePublicJobUrl(body.jobUrl).toString(); }
  catch { return NextResponse.json({ error: "Invalid job posting URL" }, { status: 400 }); }

  const { data: existing, error: existingError } = await supabase.from("analyses")
    .select("id").eq("user_id", user.id).eq("request_id", requestId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "The analysis could not be saved." }, { status: 500 });
  if (existing) return NextResponse.json(existing, { status: 200 });

  const { data: job, error: jobError } = await supabase.from("job_descriptions").insert({
    user_id: user.id,
    source_url: sourceUrl,
    job_title: result.data.jobTitle,
    company_name: result.data.companyName || null,
  }).select("id").single();
  if (jobError || !job) return NextResponse.json({ error: "The analysis could not be saved." }, { status: 500 });

  const { data, error } = await supabase.from("analyses").insert({
    user_id: user.id,
    job_description_id: job.id,
    job_title: result.data.jobTitle,
    company_name: result.data.companyName || null,
    match_score: result.data.score,
    result: result.data,
    request_id: requestId,
  }).select("id").single();
  if (error) {
    await supabase.from("job_descriptions").delete().eq("id", job.id).eq("user_id", user.id);
    if (error.code === "23505") {
      const { data: duplicate } = await supabase.from("analyses")
        .select("id").eq("user_id", user.id).eq("request_id", requestId).maybeSingle();
      if (duplicate) return NextResponse.json(duplicate, { status: 200 });
    }
    return NextResponse.json({ error: "The analysis could not be saved." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
