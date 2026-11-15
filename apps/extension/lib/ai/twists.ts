import { z } from "zod";

/** What goes out to draft twists: just the problem's name. */
export interface TwistInput {
  slug: string;
  title?: string;
  frontendId?: string;
}

export const twistsSchema = z.object({
  twists: z.array(z.string()).min(1).max(5),
});

export const TWISTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    twists: {
      type: "array",
      items: { type: "string" },
      description: "Three what-if questions, one sentence each",
    },
  },
  required: ["twists"],
  additionalProperties: false,
};

export const TWISTS_SYSTEM_PROMPT = `You write "twist" questions for LeetCode problems, used after someone re-solves a problem they know well, to test whether they understand the solution rather than remember it.

Reply with a JSON object and nothing else: {"twists": ["What if ...?", "What if ...?", "What if ...?"]}

- Write exactly three. Each is one sentence starting with "What if" and changes one thing: a constraint (sorted, negative numbers, duplicates, very large input), the setting (data arrives as a stream, many queries, only O(1) extra memory), or the output (return all answers, count them, return indices instead of values).
- Each should change the best solution in an interesting way. Don't hint at the original solution or name its technique.
- Keep each under 25 words.`;

export function twistsPrompt(input: TwistInput): string {
  const name = [input.frontendId && `${input.frontendId}.`, input.title ?? input.slug]
    .filter(Boolean)
    .join(" ");
  return `Problem: ${name} (${input.slug})`;
}
