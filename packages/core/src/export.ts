import { z } from "zod";
import {
  attemptSchema,
  customListSchema,
  mockInterviewSchema,
  problemSchema,
  settingsSchema,
} from "./schema";
import type { Attempt, CustomList, MockInterview, Problem, Settings } from "./types";

export const EXPORT_SCHEMA_VERSION = 1;

export const exportFileSchema = z.object({
  app: z.literal("leettrack"),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  problems: z.array(problemSchema),
  attempts: z.array(attemptSchema),
  settings: settingsSchema.optional(),
  // Added in M4; older exports have none.
  customLists: z.array(customListSchema).optional(),
  // Added in M7.
  mocks: z.array(mockInterviewSchema).optional(),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export function buildExport(
  data: {
    problems: Problem[];
    attempts: Attempt[];
    settings: Settings;
    customLists?: CustomList[];
    mocks?: MockInterview[];
  },
  now = new Date(),
): ExportFile {
  return {
    app: "leettrack",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...data,
  };
}

export type ParseResult = { ok: true; data: ExportFile } | { ok: false; error: string };

export function parseExport(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  const result = exportFileSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `Not a LeetTrack export: ${issue?.path.join(".") || "root"}: ${issue?.message}`,
    };
  }
  return { ok: true, data: result.data as ExportFile };
}
