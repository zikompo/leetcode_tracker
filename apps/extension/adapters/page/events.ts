import { z } from "zod";

/**
 * Normalized events the adapter emits. These shapes are the adapter's public contract:
 * nothing outside the site adapters sees a site's raw payloads.
 */
export const submissionStartedSchema = z.object({
  type: z.literal("submission-started"),
  slug: z.string(),
  submissionId: z.string(),
  at: z.string(),
  lang: z.string().optional(),
  code: z.string().optional(),
});

export const submissionResultSchema = z.object({
  type: z.literal("submission-result"),
  slug: z.string().optional(),
  submissionId: z.string().optional(),
  at: z.string(),
  status: z.string(),
  accepted: z.boolean(),
  lang: z.string().optional(),
  runtimeMs: z.number().optional(),
  memoryMb: z.number().optional(),
  runtimePercentile: z.number().optional(),
  memoryPercentile: z.number().optional(),
  /** "network" from intercepted requests, "dom" from the fallback observer. */
  source: z.enum(["network", "dom"]),
});

export const editorCodeSchema = z.object({
  type: z.literal("editor-code"),
  requestId: z.string(),
  code: z.string().optional(),
  lang: z.string().optional(),
});

export const pageEventSchema = z.discriminatedUnion("type", [
  submissionStartedSchema,
  submissionResultSchema,
  editorCodeSchema,
]);

export type SubmissionStarted = z.infer<typeof submissionStartedSchema>;
export type SubmissionResult = z.infer<typeof submissionResultSchema>;
export type EditorCode = z.infer<typeof editorCodeSchema>;
export type PageEvent = z.infer<typeof pageEventSchema>;

import { CONTENT_SOURCE, PAGE_SOURCE } from "./constants";
export { CONTENT_SOURCE, PAGE_SOURCE };

export interface PageEnvelope {
  source: typeof PAGE_SOURCE;
  event: PageEvent;
}

export interface ContentRequest {
  source: typeof CONTENT_SOURCE;
  type: "request-editor-code";
  requestId: string;
}
