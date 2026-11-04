import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisResult } from "@/schemas/analysis";

interface ReportDetails { resumeName?: string | null; generatedAt?: Date; }

function reportLines(result: AnalysisResult): Array<{ text: string; heading?: boolean }> {
  const lines: Array<{ text: string; heading?: boolean }> = [
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

export async function createDocx(result: AnalysisResult, details: ReportDetails = {}) {
  const date=(details.generatedAt||new Date()).toLocaleDateString("en",{dateStyle:"long"});
  const children=[
    new Paragraph({heading:HeadingLevel.TITLE,spacing:{after:140},children:[new TextRun({text:"Gap Analysis Report",bold:true,color:"17231D",size:48,font:"Georgia"})]}),
    new Paragraph({spacing:{after:80},children:[new TextRun({text:result.jobTitle,bold:true,color:"8E2E24",size:26,font:"Georgia"})]}),
    new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:8,color:"8E2E24"}},spacing:{after:260},children:[new TextRun({text:`${result.companyName||"Company not specified"}  •  Match score ${result.score}/100`,color:"50584F",size:20})]}),
    new Paragraph({spacing:{after:60},children:[new TextRun({text:`Résumé: ${details.resumeName||"Uploaded résumé"}`,color:"6C7064",size:18})]}),
    new Paragraph({spacing:{after:260},children:[new TextRun({text:`Prepared ${date}`,color:"6C7064",size:18})]}),
    ...reportLines(result).map((line)=>new Paragraph({heading:line.heading?HeadingLevel.HEADING_2:undefined,spacing:{before:line.heading?160:0,after:line.heading?100:180},children:[new TextRun({text:line.text,bold:line.heading,color:line.heading?"8E2E24":"17231D",font:line.heading?"Georgia":"Arial",size:line.heading?26:20})]})),
  ];
  return Packer.toBuffer(new Document({styles:{default:{document:{run:{font:"Arial",size:20},paragraph:{spacing:{line:276}}}}},sections:[{properties:{page:{margin:{top:900,right:820,bottom:850,left:820}}},headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"D5CFC0"}},spacing:{after:120},children:[new TextRun({text:"LOCKEDIN  /  RÉSUMÉ INTELLIGENCE",bold:true,color:"8E2E24",size:16,characterSpacing:30})]})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"LockedIn  •  Confidential report  •  ",color:"6C7064",size:16}),new TextRun({children:[PageNumber.CURRENT],color:"6C7064",size:16})]})]})},children}]}));
}

export async function createPdf(result: AnalysisResult, details: ReportDetails = {}) {
  const pdf=await PDFDocument.create(); const regular=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.TimesRomanBold); const margin=54; const width=612-margin*2;
  const addPage=(first=false)=>{const next=pdf.addPage([612,792]);next.drawText("LOCKEDIN",{x:margin,y:750,size:11,font:bold,color:rgb(.56,.18,.14)});next.drawText("RÉSUMÉ INTELLIGENCE",{x:432,y:750,size:7,font:regular,color:rgb(.42,.44,.39)});next.drawLine({start:{x:margin,y:740},end:{x:612-margin,y:740},thickness:.7,color:rgb(.72,.69,.63)});return {page:next,y:first?704:716};};
  let {page,y}=addPage(true); const date=(details.generatedAt||new Date()).toLocaleDateString("en",{dateStyle:"long"});
  page.drawText("Gap Analysis Report",{x:margin,y,size:29,font:bold,color:rgb(.09,.14,.11)});y-=36;page.drawText(result.jobTitle.slice(0,70),{x:margin,y,size:15,font:bold,color:rgb(.56,.18,.14)});y-=22;page.drawText(`${result.companyName||"Company not specified"}  •  Match score ${result.score}/100`,{x:margin,y,size:10,font:regular,color:rgb(.31,.35,.31)});y-=18;page.drawText(`Résumé: ${(details.resumeName||"Uploaded résumé").slice(0,70)}  •  Prepared ${date}`,{x:margin,y,size:8,font:regular,color:rgb(.42,.44,.39)});y-=18;page.drawLine({start:{x:margin,y},end:{x:612-margin,y},thickness:1.2,color:rgb(.56,.18,.14)});y-=28;
  for(const line of reportLines(result)){ const font=line.heading?bold:regular; const size=line.heading?15:10; const color=line.heading?rgb(.56,.18,.14):rgb(.09,.14,.11); const words=line.text.split(/\s+/); let row=""; const rows:string[]=[]; for(const word of words){const candidate=row?`${row} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)>width){rows.push(row);row=word}else row=candidate} if(row)rows.push(row); const needed=rows.length*(size+4)+(line.heading?10:6); if(y-needed<55){({page,y}=addPage());} for(const text of rows){page.drawText(text,{x:margin,y,size,font,color});y-=size+4;} y-=line.heading?10:6; }
  const pages=pdf.getPages();pages.forEach((pdfPage,index)=>pdfPage.drawText(`LockedIn  •  Confidential report  •  ${index+1} / ${pages.length}`,{x:margin,y:28,size:7,font:regular,color:rgb(.42,.44,.39)}));
  return Buffer.from(await pdf.save());
}
