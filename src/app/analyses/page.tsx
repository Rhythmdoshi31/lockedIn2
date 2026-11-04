import Link from "next/link";
import { redirect } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { DeleteAnalysisButton } from "@/components/delete-analysis-button";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function AnalysesPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const {data}=await supabase.from("analyses").select("id,job_title,company_name,match_score,created_at").order("created_at",{ascending:false});return <PageChrome><section className="content-panel"><p className="eyebrow">Your considered applications</p><h1>My Analyses</h1><p className="page-intro">Return to every original report, exactly as it was composed.</p><div className="analysis-card-list">{data?.length?data.map(a=><Link className="analysis-history-card" href={`/analyses/${a.id}`} key={a.id}><div><span>{a.company_name||"Company not specified"}</span><h2>{a.job_title}</h2><time>{new Intl.DateTimeFormat("en",{dateStyle:"medium"}).format(new Date(a.created_at))}</time></div><strong>{a.match_score}<small>/100</small></strong><DeleteAnalysisButton id={a.id}/></Link>):<p className="empty-state">No saved analyses yet.</p>}</div><Link className="primary-link" href="/">Analyse a new job →</Link></section></PageChrome>}
