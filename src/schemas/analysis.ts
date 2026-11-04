import { z } from "zod";

const boundedText = z.string().trim().min(1).max(700);
const conciseText = z.string().trim().min(1).max(240);
const optionalConciseText = z.string().trim().max(240);
const optionalBoundedText = z.string().trim().max(700);

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
  companyName: optionalConciseText,
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

const rubricExplanationSchema = z.object({
  explanation: boundedText,
});

export const modelAnalysisSchema = z.object({
  summaryTitle: z.string().trim().min(1).max(120),
  personalizedAssessment: boundedText,
  gaps: z
    .array(
      z.object({
        requirement: conciseText,
        category: requirementCategorySchema,
        priority: z.enum(["Critical", "Important", "Optional"]),
        status: z.enum(["missing", "partial", "matched"]),
        jobRequires: boundedText,
        resumeEvidence: boundedText,
        whyItMatters: boundedText,
        improvement: boundedText,
        suggestedWording: optionalBoundedText,
      }),
    )
    .max(20),
  matchingSkills: z.array(conciseText).max(30),
  competitiveStrengths: z
    .array(
      z.object({
        capability: conciseText,
        technologies: z.array(conciseText).max(12),
        resumeEvidence: boundedText,
        relevance: boundedText,
      }),
    )
    .min(3)
    .max(5),
  rubric: z.object({
    skills: z.number().int().min(0).max(45),
    experience: z.number().int().min(0).max(30),
    education: z.number().int().min(0).max(10),
    roleAlignment: z.number().int().min(0).max(15),
  }),
  rubricExplanations: z.object({
    skills: rubricExplanationSchema,
    experience: rubricExplanationSchema,
    education: rubricExplanationSchema,
    roleAlignment: rubricExplanationSchema,
  }),
  keywords: z.object({
    alreadyDemonstrated: z
      .array(z.object({ keyword: conciseText, evidence: boundedText }))
      .max(30),
    insufficientlyDemonstrated: z
      .array(
        z.object({
          keyword: conciseText,
          evidence: boundedText,
          suggestion: boundedText,
        }),
      )
      .max(20),
    notFound: z
      .array(
        z.object({
          keyword: conciseText,
          importance: z.enum(["required", "preferred"]),
          howToAddress: boundedText,
        }),
      )
      .max(20),
  }),
  actionPlan: z
    .array(
      z.object({
        priority: z.number().int().min(1).max(5),
        type: z.enum(["resume_wording", "skill_or_experience"]),
        action: boundedText,
        rationale: boundedText,
      }),
    )
    .min(3)
    .max(5),
  finalAssessment: z.object({
    strongestArea: boundedText,
    biggestGap: boundedText,
    nextActions: z.array(boundedText).length(3),
  }),
});

export const resumeEnhancementSchema = z.object({
  enhancements: z
    .array(
      z.object({
        type: z.enum(["bullet", "professional_summary", "project_description"]),
        section: conciseText,
        original: boundedText,
        improved: boundedText,
        explanation: boundedText,
      }),
    )
    .min(1)
    .max(8),
});

export const analysisResultSchema = modelAnalysisSchema.extend({
  score: z.number().int().min(0).max(100),
  jobTitle: conciseText,
  companyName: optionalConciseText,
  requirementsAnalyzed: z.number().int().min(1).max(40),
  resumeEnhancements: resumeEnhancementSchema.shape.enhancements,
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
