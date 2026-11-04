import { NextResponse } from "next/server";
import { analysisResultSchema } from "@/schemas/analysis";
import { createClient } from "@/lib/supabase/server";
import { createDocx, createPdf } from "@/lib/report-export";

export async function POST(request:Request){ const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null); const parsed=analysisResultSchema.safeParse(body?.result); if(!parsed.success)return NextResponse.json({error:"Invalid report"},{status:400}); const format=body?.format;
  if(format==="docx"){const data=await createDocx(parsed.data);return new NextResponse(new Uint8Array(data),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","content-disposition":"attachment; filename=lockedin-analysis.docx"}})}
  if(format==="pdf"){const data=await createPdf(parsed.data);return new NextResponse(new Uint8Array(data),{headers:{"content-type":"application/pdf","content-disposition":"attachment; filename=lockedin-analysis.pdf"}})} return NextResponse.json({error:"Unsupported format"},{status:400}); }
