import { z } from "zod";

const boundedText = z.string().trim().min(1).max(700);
const conciseText = z.string().trim().min(1).max(240);

export const requirementCategorySchema = z.enum([
  "skill",
  "experience",
  "project",
  "qualification",
  "certification",
  "responsibility",
]);

export const jobRequirementsSchema = z.object({
  postingStatus: z.enum(["direct", "incomplete", "search_results"]),
  statusReason: conciseText,
  jobTitle: conciseText,
  requirements: z
    .array(
      z.object({
        requirement: conciseText,
        category: requirementCategorySchema,
        importance: z.enum(["required", "preferred"]),
        jobEvidence: boundedText,
      }),
    )
    .max(40),
});

export const modelAnalysisSchema = z.object({
  summaryTitle: z.string().trim().min(1).max(120),
  gaps: z
    .array(
      z.object({
        requirement: conciseText,
        category: requirementCategorySchema,
        priority: z.enum(["Critical", "Important", "Optional"]),
        status: z.enum(["missing", "partial", "unverified"]),
        jobRequires: boundedText,
        resumeEvidence: boundedText,
        improvement: boundedText,
      }),
    )
    .max(20),
  matchingSkills: z.array(conciseText).max(20),
  strengths: z.array(boundedText).max(8),
  rubric: z.object({
    skills: z.number().int().min(0).max(45),
    experience: z.number().int().min(0).max(30),
    education: z.number().int().min(0).max(10),
    roleAlignment: z.number().int().min(0).max(15),
  }),
});

export const analysisResultSchema = modelAnalysisSchema.extend({
  score: z.number().int().min(0).max(100),
  jobTitle: conciseText,
  requirementsAnalyzed: z.number().int().min(1).max(40),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const analyzeErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export type AnalyzeError = z.infer<typeof analyzeErrorSchema>;
