import { normalizeComplexity } from "@leettrack/core";
import { z } from "zod";

/** What gets sent: the solution and the problem's name. Never the problem statement. */
export interface AnalysisInput {
  slug: string;
  title?: string;
  frontendId?: string;
  language?: string;
  code: string;
}

/** A model's complexity estimate, normalised to chip notation. */
export interface ComplexitySuggestion {
  time?: string;
  space?: string;
  optimalTime?: string;
  optimalSpace?: string;
  /** Which model produced it, shown next to the suggestion. */
  model: string;
}

export const analysisSchema = z.object({
  time: z.string().describe("Worst-case time complexity of this code, e.g. O(n log n)"),
  space: z.string().describe("Extra space this code uses, e.g. O(1)"),
  optimalTime: z.string().describe("Best known time complexity for this problem"),
  optimalSpace: z.string().describe("Space used by that best known solution"),
});
export type RawAnalysis = z.infer<typeof analysisSchema>;

/** The same shape as a JSON schema, for providers that constrain output to a schema. */
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    Object.entries(analysisSchema.shape).map(([k, v]) => [
      k,
      { type: "string", description: v.description ?? "" },
    ]),
  ),
  required: Object.keys(analysisSchema.shape),
  additionalProperties: false,
};

/** LeetCode solutions are short; anything this long is probably not one. */
export const MAX_CODE_CHARS = 20_000;

export const SYSTEM_PROMPT = `You estimate the Big-O complexity of solutions to LeetCode problems.

Reply with a JSON object and nothing else, in exactly this shape:
{"time": "O(n log n)", "space": "O(n)", "optimalTime": "O(n)", "optimalSpace": "O(1)"}

- "time": worst-case time complexity of the given code.
- "space": extra space the code uses, counting recursion depth and auxiliary structures but not the input or the returned output.
- "optimalTime" / "optimalSpace": the best known complexity for this problem, based on its name and the code. Give your best estimate even if unsure.
- Write each value as Big-O with lower-case variables: O(1), O(log n), O(n), O(n log n), O(n^2), O(2^n), O(n*m). Use n for the main input size. Use other letters (m, k, V, E) only when the cost genuinely depends on them, following the problem's usual notation.
- Account for the cost of library calls (sorting, slicing, string concatenation, hash operations) and amortised behaviour (sliding windows, union-find, monotonic stacks).`;

export function userPrompt(input: AnalysisInput): string {
  const name = [input.frontendId && `${input.frontendId}.`, input.title ?? input.slug]
    .filter(Boolean)
    .join(" ");
  const lang = input.language ?? "unknown";
  return `Problem: ${name} (${input.slug})\nLanguage: ${lang}\n\n\`\`\`${lang}\n${input.code}\n\`\`\``;
}

/** Pull a JSON object out of a model's text reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model's reply had no JSON in it.");
  return JSON.parse(text.slice(start, end + 1));
}

export function toSuggestion(raw: RawAnalysis, model: string): ComplexitySuggestion {
  const out: ComplexitySuggestion = { model };
  for (const key of ["time", "space", "optimalTime", "optimalSpace"] as const) {
    const v = normalizeComplexity(raw[key]);
    if (v) out[key] = v;
  }
  return out;
}
