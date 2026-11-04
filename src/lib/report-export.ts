import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResult } from "@/schemas/analysis";

function reportLines(result: AnalysisResult): Array<{ text: string; heading?: boolean }> {
  const lines: Array<{ text: string; heading?: boolean }> = [
    { text: `Gap Analysis: ${result.jobTitle}`, heading: true },
    { text: `${result.companyName || "Company not specified"} · Match score ${result.score}/100` },
    { text: result.personalizedAssessment },
    { text: "Missing requirements and actionable improvements", heading: true },
  ];
  result.gaps.forEach((g) => lines.push({ text: `${g.priority} · ${g.status}: ${g.requirement}`, heading: true }, { text: `Job requires: ${g.jobRequires}` }, { text: `Résumé evidence: ${g.resumeEvidence}` }, { text: `Why it matters: ${g.whyItMatters}` }, { text: `How to improve: ${g.improvement}` }, ...(g.suggestedWording ? [{ text: `Suggested wording: ${g.suggestedWording}` }] : [])));
  lines.push({ text: "Score breakdown", heading: true });
  for (const [name, score, total, explanation] of [["Skills",result.rubric.skills,45,result.rubricExplanations.skills.explanation],["Experience",result.rubric.experience,30,result.rubricExplanations.experience.explanation],["Education",result.rubric.education,10,result.rubricExplanations.education.explanation],["Role alignment",result.rubric.roleAlignment,15,result.rubricExplanations.roleAlignment.explanation]] as const) lines.push({text:`${name}: ${score}/${total}`,heading:true},{text:explanation});
  lines.push({ text: "Competitive strengths", heading: true });
  result.competitiveStrengths.forEach((s)=>lines.push({text:s.capability,heading:true},{text:`Technologies: ${s.technologies.join(", ")}`},{text:`Evidence: ${s.resumeEvidence}`},{text:`Relevance: ${s.relevance}`}));
  lines.push({text:"Matching skills",heading:true},{text:result.matchingSkills.join(", ") || "None identified"},{text:"Résumé enhancements",heading:true});
  result.resumeEnhancements.forEach((e)=>lines.push({text:`${e.section} · ${e.type.replaceAll("_"," ")}`,heading:true},{text:`Original: ${e.original}`},{text:`Improved: ${e.improved}`},{text:`Why: ${e.explanation}`}));
  lines.push({text:"Keyword guidance",heading:true},{text:`Already demonstrated: ${result.keywords.alreadyDemonstrated.map(k=>k.keyword).join(", ") || "None"}`},{text:`Insufficiently demonstrated: ${result.keywords.insufficientlyDemonstrated.map(k=>`${k.keyword} — ${k.suggestion}`).join("; ") || "None"}`},{text:`Not found: ${result.keywords.notFound.map(k=>`${k.keyword} — ${k.howToAddress}`).join("; ") || "None"}`},{text:"Action plan",heading:true});
  result.actionPlan.forEach((a)=>lines.push({text:`${a.priority}. ${a.action}`,heading:true},{text:a.rationale}));
  lines.push({text:"Final assessment",heading:true},{text:`Strongest area: ${result.finalAssessment.strongestArea}`},{text:`Biggest gap: ${result.finalAssessment.biggestGap}`},{text:"Recommended next actions",heading:true},...result.finalAssessment.nextActions.map((text,index)=>({text:`${index+1}. ${text}`})));
  return lines;
}

export async function createDocx(result: AnalysisResult) {
  const children=reportLines(result).map((line)=>new Paragraph({heading:line.heading?HeadingLevel.HEADING_2:undefined,spacing:{after:line.heading?100:180},children:[new TextRun({text:line.text,bold:line.heading,color:line.heading?"8E2E24":"17231D"})]}));
  return Packer.toBuffer(new Document({sections:[{properties:{},children}]}));
}

export async function createPdf(result: AnalysisResult) {
  const pdf=await PDFDocument.create(); const regular=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.TimesRomanBold); const margin=54; const width=612-margin*2; let page=pdf.addPage([612,792]); let y=738;
  for(const line of reportLines(result)){ const font=line.heading?bold:regular; const size=line.heading?15:10; const color=line.heading?rgb(.56,.18,.14):rgb(.09,.14,.11); const words=line.text.split(/\s+/); let row=""; const rows:string[]=[]; for(const word of words){const candidate=row?`${row} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)>width){rows.push(row);row=word}else row=candidate} if(row)rows.push(row); const needed=rows.length*(size+4)+(line.heading?10:6); if(y-needed<48){page=pdf.addPage([612,792]);y=738;} for(const text of rows){page.drawText(text,{x:margin,y,size,font,color});y-=size+4;} y-=line.heading?10:6; }
  return Buffer.from(await pdf.save());
}
