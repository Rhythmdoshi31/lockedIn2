import { notFound,redirect } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { AnalysisResults } from "@/app/page";
import { analysisResultSchema } from "@/schemas/analysis";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function AnalysisPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const {data}=await supabase.from("analyses").select("result").eq("id",id).eq("user_id",user.id).single();const parsed=analysisResultSchema.safeParse(data?.result);if(!parsed.success)notFound();return <PageChrome><div className="saved-report"><AnalysisResults result={parsed.data}/></div></PageChrome>}
