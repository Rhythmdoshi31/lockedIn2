import { z } from "zod";

const boundedText = z.string().trim().min(1).max(500);

export const modelAnalysisSchema = z.object({
  summaryTitle: z.string().trim().min(1).max(100),
  matchingSkills: z.array(boundedText).max(20),
  missingSkills: z
    .array(
      z.object({
        skill: boundedText,
        status: z.enum(["missing", "unverified"]),
        explanation: boundedText,
      }),
    )
    .max(15),
  strengths: z.array(boundedText).min(1).max(8),
  gaps: z.array(boundedText).min(1).max(8),
  recommendations: z.array(boundedText).min(1).max(8),
  sectionFeedback: z
    .array(
      z.object({
        section: boundedText,
        assessment: boundedText,
      }),
    )
    .max(8),
  rubric: z.object({
    skills: z.number().int().min(0).max(45),
    experience: z.number().int().min(0).max(30),
    education: z.number().int().min(0).max(10),
    roleAlignment: z.number().int().min(0).max(15),
  }),
});

export const analysisResultSchema = modelAnalysisSchema.extend({
  score: z.number().int().min(0).max(100),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const analyzeErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type AnalyzeError = z.infer<typeof analyzeErrorSchema>;
