import { notFound,redirect } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { AnalysisResults } from "@/app/page";
import { analysisResultSchema } from "@/schemas/analysis";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function AnalysisPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const {data}=await supabase.from("analyses").select("result,resume_id").eq("id",id).eq("user_id",user.id).single();const parsed=analysisResultSchema.safeParse(data?.result);if(!parsed.success)notFound();let resumeName:string|null=null;const resumeId=data?.resume_id;if(resumeId){const {data:resume}=await supabase.from("resumes").select("file_name").eq("id",resumeId).eq("user_id",user.id).maybeSingle();resumeName=resume?.file_name||null;}return <PageChrome><div className="saved-report"><AnalysisResults result={parsed.data} resumeName={resumeName}/></div></PageChrome>}
