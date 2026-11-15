import { z } from "zod";

// Runtime validation for data crossing a trust boundary (JSON import, page messages, storage).

const isoDate = z.string().min(1);

export const difficultySchema = z.enum(["Easy", "Medium", "Hard"]);
export const outcomeSchema = z.enum(["solved_independently", "solved_with_help", "not_solved"]);
export const helpLevelSchema = z.enum([
  "none",
  "hint",
  "approach",
  "partial_code",
  "full_solution",
]);
export const optimalitySchema = z.enum(["optimal", "suboptimal", "unsure"]);
export const ratingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const problemStatusSchema = z.enum([
  "unseen",
  "in_progress",
  "solved_with_help",
  "fully_solved",
  "mastered",
]);

export const submissionSchema = z.object({
  at: isoDate,
  status: z.string(),
  runtimeMs: z.number().optional(),
  memoryMb: z.number().optional(),
  runtimePercentile: z.number().optional(),
  memoryPercentile: z.number().optional(),
});

export const checkpointSchema = z.object({
  at: isoDate,
  activeSeconds: z.number().nonnegative(),
  time: z.string().optional(),
  space: z.string().optional(),
});

export const problemSchema = z.object({
  slug: z.string().min(1),
  frontendId: z.string(),
  title: z.string(),
  difficulty: difficultySchema,
  url: z.string(),
  leetcodeTopics: z.array(z.string()),
  patterns: z.array(z.string()),
  suggestedPatterns: z.array(z.string()),
  lists: z.array(z.string()),
  twists: z.array(z.string()).optional(),
  statusOverride: z
    .object({ status: problemStatusSchema, optimality: optimalitySchema.optional(), at: isoDate })
    .optional(),
  updatedAt: isoDate,
});

export const attemptSchema = z.object({
  id: z.string().min(1),
  problemSlug: z.string().min(1),
  startedAt: isoDate,
  endedAt: isoDate,
  activeSeconds: z.number().nonnegative(),
  secondsToApproach: z.number().nonnegative().optional(),
  isCold: z.boolean(),
  kind: z.enum(["full", "quick"]),
  outcome: outcomeSchema,
  helpLevel: helpLevelSchema,
  viewedSolutionDetected: z.boolean(),
  optimality: optimalitySchema.optional(),
  complexityAchieved: z.string().optional(),
  complexityOptimal: z.string().optional(),
  checkpoints: z.array(checkpointSchema).optional(),
  suggestedRating: ratingSchema,
  rating: ratingSchema,
  patternClue: z.string().optional(),
  stuckNote: z.string().optional(),
  notes: z.string().optional(),
  code: z.string().optional(),
  language: z.string().optional(),
  submissions: z.array(submissionSchema),
  twistAnswer: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const customListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slugs: z.array(z.string()),
  deleted: z.boolean().optional(),
  updatedAt: isoDate,
});

export const settingsSchema = z.object({
  panelAutoOpen: z.enum(["accepted", "every_submission", "manual"]),
  customPatterns: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  patternRenames: z.record(z.string(), z.string()).optional(),
  patternMerges: z.record(z.string(), z.string()).optional(),
  // Added in M2; older exports lack them, so they default.
  dailyNewLimit: z.number().int().min(0).max(50).default(3),
  dailyReviewLimit: z.number().int().min(0).max(500).default(20),
  desiredRetention: z.number().min(0.7).max(0.97).default(0.9),
  activeLists: z.array(z.string()).default(["neetcode150"]),
  hideTopicsWhileSolving: z.boolean().default(false),
  github: z
    .object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      branch: z.string().min(1),
      includeNotes: z.boolean().default(true),
    })
    .optional(),
  // Added in M6.
  targetDates: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(80),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        listIds: z.array(z.string()),
        createdAt: isoDate.optional(),
      }),
    )
    .optional(),
  targetBufferDays: z.number().int().min(0).max(14).default(2),
  targetNoNewDays: z.number().int().min(0).max(14).default(2),
  targetRetention: z.number().min(0.7).max(0.99).default(0.95),
  updatedAt: isoDate,
});
